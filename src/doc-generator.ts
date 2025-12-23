/**
 * Main documentation generator that combines extraction and parsing
 */

import * as fs from 'fs';
import * as path from 'path';
import { SourceExtractor } from './source-extractor.js';
import { TypeScriptParser } from './ts-parser.js';
import { ComponentDoc, PropInfo, EventInfo, StyleInfo, MethodInfo } from './types.js';
import { GeneratorConfig, DEFAULT_CONFIG } from './config.js';

export class DocumentationGenerator {
  private componentsPath: string;
  private basePropsCache: PropInfo[] | null = null;
  private config: GeneratorConfig;

  constructor(componentsPath: string, config: Partial<GeneratorConfig> = {}) {
    this.componentsPath = componentsPath;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get and cache BaseProps properties
   */
  private getBaseProps(): PropInfo[] {
    if (this.basePropsCache) {
      return this.basePropsCache;
    }

    try {
      // Try old format first (.js.map file)
      const baseComponentPath = path.join(this.componentsPath, 'core', 'base.component.js.map');
      if (fs.existsSync(baseComponentPath)) {
        const baseSource = SourceExtractor.extractSourceContent(baseComponentPath);

        if (baseSource) {
          const propsInfo = TypeScriptParser.extractProps(baseSource);
          if (propsInfo && propsInfo.className === 'BaseProps') {
            this.basePropsCache = propsInfo.props;
            return this.basePropsCache;
          }
        }
      }

      // Try new format (looking for BaseProps type/interface in a TypeScript file)
      // This might be in a different location, but we'll search common locations
      const possiblePaths = [
        path.join(this.componentsPath, 'core', 'base.ts'),
        path.join(this.componentsPath, 'core', 'base.tsx'),
        path.join(this.componentsPath, 'common', 'base.ts'),
        path.join(this.componentsPath, 'common', 'base.tsx'),
      ];

      for (const basePath of possiblePaths) {
        if (fs.existsSync(basePath)) {
          const baseSource = fs.readFileSync(basePath, 'utf-8');
          const propsInfo = TypeScriptParser.extractProps(baseSource);
          if (propsInfo && propsInfo.className === 'BaseProps') {
            this.basePropsCache = propsInfo.props;
            return this.basePropsCache;
          }
        }
      }
    } catch (error) {
      // BaseProps might be from external package, which is fine
      // console.warn('Could not extract BaseProps (might be from external package)');
    }

    return [];
  }

  /**
   * Get inherited props from a base class - dynamically resolves ANY parent class
   */
  private getInheritedProps(baseClassName: string): PropInfo[] {
    const inheritedProps: PropInfo[] = [];

    // Handle BaseProps (special case - use cached props)
    if (baseClassName === 'BaseProps') {
      return this.getBaseProps().map(prop => ({
        ...prop,
        inherited: true,
        inheritedFrom: 'BaseProps',
      }));
    }

    const parentPropsPath = this.findParentPropsFile(baseClassName);
    console.log(`Debug: Resolving parent ${baseClassName} -> ${parentPropsPath}`);

    if (!parentPropsPath) {
      console.warn(`Could not find props file for parent class: ${baseClassName}`);
      return inheritedProps;
    }

    try {
      const source = SourceExtractor.extractSourceContent(parentPropsPath);
      // console.log(`Debug: Source length for ${baseClassName}: ${source?.length}`);

      if (source) {
        const propsInfo = TypeScriptParser.extractProps(source);
        if (propsInfo) {
          console.log(`Debug: Extracted ${propsInfo.props.length} props for ${baseClassName}. Base: ${propsInfo.baseClass}`);
          // propsInfo.props.forEach(p => console.log(`  - ${p.name}`));

          // Add parent's own props
          inheritedProps.push(
            ...propsInfo.props.map(prop => ({
              ...prop,
              inherited: true,
              inheritedFrom: baseClassName,
            }))
          );

          // Recursively get grandparent props
          if (propsInfo.baseClass) {
            inheritedProps.push(...this.getInheritedProps(propsInfo.baseClass));
          }
        }
      }
    } catch (error) {
      console.error(`Error extracting ${baseClassName}:`, error);
    }

    return inheritedProps;
  }

  /**
   * Find the props file for a parent class by searching the library
   * Handles BaseInputProps, BaseChartComponentProps, etc.
   */
  /**
   * Find the props file for a parent class by searching the library
   * Handles BaseInputProps, BaseChartComponentProps, etc.
   */
  private findParentPropsFile(className: string): string | null {
    // 1. Clean the class name (remove Props/Component suffixes)
    const baseName = className
      .replace(/Props$/, '')
      .replace(/Component$/, '');

    // 2. Generate candidate file names
    const candidates: string[] = [];

    // Strategy A: Direct lowercase (e.g. BaseInput -> baseinput)
    candidates.push(baseName.toLowerCase());

    // Strategy B: Kebab case (e.g. PieChart -> pie-chart)
    const toKebab = (str: string) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    candidates.push(toKebab(baseName));

    // Strategy C: Remove 'Wm' prefix and try both above
    // (e.g. WmPieChart -> PieChart -> piechart, pie-chart)
    if (baseName.startsWith('Wm')) {
      const noPrefix = baseName.substring(2);
      candidates.push(noPrefix.toLowerCase());
      candidates.push(toKebab(noPrefix));
    }

    // Deduplicate
    const uniqueCandidates = [...new Set(candidates)];
    // console.log(`Looking for parent ${className} in:`, uniqueCandidates);

    // Search in common locations
    const searchPaths = [
      path.join(this.componentsPath, 'components'),
      path.join(this.componentsPath, 'core'),
    ];

    for (const fileName of uniqueCandidates) {
      const propsFileName = `${fileName}.props.js.map`;

      for (const searchPath of searchPaths) {
        if (!fs.existsSync(searchPath)) continue;

        const found = this.searchForFile(searchPath, propsFileName);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  /**
   * Recursively search for a file in a directory
   */
  private searchForFile(dir: string, targetFileName: string): string | null {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const found = this.searchForFile(fullPath, targetFileName);
          if (found) return found;
        } else if (entry.isFile() && entry.name === targetFileName) {
          return fullPath;
        }
      }
    } catch (error) {
      // Ignore permission errors, etc.
    }

    return null;
  }

  /**
   * Apply configuration filters to component documentation
   */
  private filterComponentDoc(doc: ComponentDoc): ComponentDoc {
    const config = this.config.documentation;

    // Filter props
    const filteredProps = doc.props.filter(prop => {
      // Check global exclusions
      if (config.excludeProps.includes(prop.name)) return false;

      // Check inherited exclusions
      if (prop.inherited && config.excludeInheritedProps.includes(prop.name)) {
        return false;
      }

      // Check component-specific exclusions
      const overrides = config.componentOverrides[doc.componentName];
      if (overrides?.excludeProps?.includes(prop.name)) return false;

      return true;
    });

    // Filter methods
    const filteredMethods = doc.methods.filter(method => {
      if (config.excludeMethods.includes(method.name)) return false;

      const overrides = config.componentOverrides[doc.componentName];
      if (overrides?.excludeMethods?.includes(method.name)) return false;

      return true;
    });

    // Filter style classes
    const filteredStyles = doc.styles.filter(style => {
      if (config.excludeStyleClasses.includes(style.className)) return false;

      const overrides = config.componentOverrides[doc.componentName];
      if (overrides?.excludeStyleClasses?.includes(style.className)) return false;

      return true;
    });

    return {
      ...doc,
      props: filteredProps,
      methods: filteredMethods,
      styles: filteredStyles,
    };
  }

  /**
   * Generate documentation for a single component
   */
  generateComponentDoc(componentPath: string, category: string): ComponentDoc | null {
    try {
      // Extract sources
      const sources = SourceExtractor.extractComponentSources(componentPath);

      if (!sources.props && !sources.component) {
        console.warn(`No source files found for ${componentPath}`);
        return null;
      }

      const componentName = path.basename(componentPath);

      // Parse props
      let allProps: PropInfo[] = [];
      let baseClass: string | undefined;

      if (sources.props) {
        const propsInfo = TypeScriptParser.extractProps(sources.props);
        if (propsInfo) {
          allProps = propsInfo.props;
          baseClass = propsInfo.baseClass;

          // Get inherited props
          if (baseClass) {
            const inheritedProps = this.getInheritedProps(baseClass);
            allProps.push(...inheritedProps);
          }
        }
      }

      // Parse methods
      let methods: MethodInfo[] = [];
      if (sources.component) {
        const methodsInfo = TypeScriptParser.extractMethods(sources.component);
        if (methodsInfo) {
          methods = methodsInfo.methods;
        }
      }

      // Extract events from both props and invokeEventCallback calls
      const propsEvents: EventInfo[] = TypeScriptParser.extractEvents(allProps).map(e => ({
        name: e.name,
        type: e.type,
        parameters: this.extractEventParameters(e.type),
      }));

      // Extract events from JavaScript invokeEventCallback calls
      // We need to scan both the component itself and any referenced components it uses
      const jsFile = path.join(componentPath, `${componentName}.component.js`);
      let callbackEvents: EventInfo[] = [];

      if (fs.existsSync(jsFile)) {
        const jsContent = fs.readFileSync(jsFile, 'utf-8');

        // Extract events from this component
        const events = TypeScriptParser.extractEventCallbacks(jsContent);
        events.forEach(e => {
          callbackEvents.push({
            name: e.name,
            type: 'Function',
            parameters: e.parameters,
          });
        });

        // Find all referenced component files that this component imports/uses
        // Look for patterns like: import { Tappable } from '...path.../tappable.component'
        // or React.createElement(Tappable, ...)
        const referencedComponents = this.findReferencedComponents(jsContent);

        // Extract events from referenced components
        for (const refComponentPath of referencedComponents) {
          if (fs.existsSync(refComponentPath)) {
            const refContent = fs.readFileSync(refComponentPath, 'utf-8');
            const refEvents = TypeScriptParser.extractEventCallbacks(refContent);
            refEvents.forEach(e => {
              // Only add if not already present
              if (!callbackEvents.find(existing => existing.name === e.name)) {
                callbackEvents.push({
                  name: e.name,
                  type: 'Function',
                  parameters: e.parameters,
                });
              }
            });
          }
        }
      }

      // Merge events, preferring callback events over prop events (more accurate parameters)
      const eventMap = new Map<string, EventInfo>();
      propsEvents.forEach(e => eventMap.set(e.name, e));
      callbackEvents.forEach(e => eventMap.set(e.name, e)); // Overwrites if duplicate
      const events: EventInfo[] = Array.from(eventMap.values());

      // Parse styles
      let styles: StyleInfo[] = [];
      if (sources.styles) {
        const styleInfo = TypeScriptParser.extractStyleClasses(sources.styles);
        if (styleInfo) {
          styles = [
            {
              className: styleInfo.defaultClass,
              description: 'Default style class',
            },
            ...styleInfo.styleClasses
              .filter(cls => cls !== styleInfo.defaultClass)
              .map(cls => ({
                className: cls,
              })),
          ];
        }
      }

      // Check for child components
      const childData: ComponentDoc[] = [];
      const childConfig = this.config.childComponents[componentName];

      if (childConfig) {
        // console.log(`Processing children for ${componentName}...`, Object.keys(childConfig));
        for (const [childName, relativePath] of Object.entries(childConfig)) {
          const childPath = path.resolve(componentPath, relativePath);

          if (fs.existsSync(childPath)) {
            // Generate docs for the child
            // Note: We use the same category as the parent
            const childDoc = this.generateComponentDoc(childPath, category);
            if (childDoc) {
              // Override the name to match the key in config if needed, or keep extracted name
              // Here we keep the extracted name but maybe we should ensure it matches
              childData.push(childDoc);
            }
          } else {
            console.warn(`Child component path not found: ${childPath} (for ${childName} in ${componentName})`);
          }
        }
      }

      const doc: ComponentDoc = {
        componentName,
        componentPath,
        category,
        props: allProps,
        methods,
        events,
        styles,
        baseClass,
        children: childData.length > 0 ? childData : undefined,
      };

      // Apply filters before returning
      return this.filterComponentDoc(doc);
    } catch (error) {
      console.error(`Error generating docs for ${componentPath}:`, error);
      return null;
    }
  }

  /**
   * Find all referenced component files that this component imports/uses
   * Looks for import statements to find dependencies
   */
  private findReferencedComponents(jsContent: string): string[] {
    const componentPaths: string[] = [];

    // Match import statements like: import { Tappable } from '@wavemaker/app-rn-runtime/core/tappable.component'
    // or: from '@wavemaker/app-rn-runtime/components/basic/animatedview.component'
    const importPattern = /from\s+['"]@wavemaker\/app-rn-runtime\/((?:core|components)\/[^'"]+)['"]/g;

    let match;
    while ((match = importPattern.exec(jsContent)) !== null) {
      const relativePath = match[1]; // e.g., 'core/tappable.component'

      // Build full path
      const fullPath = path.join(this.componentsPath, relativePath + '.js');
      componentPaths.push(fullPath);
    }

    return componentPaths;
  }

  /**
   * Extract parameter information from event type
   */
  private extractEventParameters(eventType: string): string {
    // Simple extraction for now - can be enhanced
    if (eventType === 'Function') {
      return '()';
    }

    // Try to extract parameters from function signature
    const match = eventType.match(/\((.*?)\)\s*=>/);
    if (match) {
      return `(${match[1]})`;
    }

    return eventType;
  }

  /**
   * Find all component directories in library
   */
  /**
   * Recursive function to find components in a directory
   */
  private findComponentsInDir(dirPath: string, category: string, components: Array<{ path: string; category: string }>): void {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    // Check if this directory itself is a component
    // Support both old format (.component.js.map, .props.js.map) and new format (index.tsx)
    const hasComponentFiles = items.some(item =>
      item.isFile() && (
        item.name.endsWith('.component.js.map') ||
        item.name.endsWith('.props.js.map') ||
        item.name === 'index.tsx' ||
        item.name === 'index.ts'
      )
    );

    if (hasComponentFiles) {
      // It's a component!
      const componentName = path.basename(dirPath);

      // Check inclusions based on folder name
      // If includeComponents is empty or not configured, include all components
      // Otherwise, use the whitelist
      if (this.config.includeComponents.length === 0 || this.config.includeComponents.includes(componentName)) {
        components.push({ path: dirPath, category });
      } else {
        // console.log(`Skipping ${componentName} (not in includeComponents)`);
      }

      // We don't stop here, because nested components might exist (though unlikely in this specific structure, but safe to traverse)
    }

    // Recurse into subdirectories
    for (const item of items) {
      if (item.isDirectory()) {
        // Skip node_modules or hidden folders
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;

        this.findComponentsInDir(path.join(dirPath, item.name), category, components);
      }
    }
  }

  /**
   * Find all component directories in source path
   */
  findAllComponents(): Array<{ path: string; category: string }> {
    const components: Array<{ path: string; category: string }> = [];

    if (!fs.existsSync(this.componentsPath)) {
      console.error(`Components path not found: ${this.componentsPath}`);
      return components;
    }

    // Check if we should search directly in componentsPath or in a components subdirectory
    const categoriesPath = fs.existsSync(path.join(this.componentsPath, 'components'))
      ? path.join(this.componentsPath, 'components')
      : this.componentsPath;

    console.log(`Scanning categories in: ${categoriesPath}`);

    const categories = fs.readdirSync(categoriesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => !this.config.excludeCategories.includes(name)); // Exclude configured categories

    console.log(`Found ${categories.length} categories:`, categories.join(', '));

    for (const category of categories) {
      const categoryPath = path.join(categoriesPath, category);
      const beforeCount = components.length;
      this.findComponentsInDir(categoryPath, category, components);
      const afterCount = components.length;
      console.log(`  ${category}: found ${afterCount - beforeCount} components`);
    }

    console.log(`\nTotal components found: ${components.length}`);

    if (components.length === 0 && this.config.includeComponents.length > 0) {
      console.warn('\nWarning: No components found. This might be because:');
      console.warn('1. The includeComponents whitelist is filtering out all components');
      console.warn('2. The component directory structure is different than expected');
      console.warn('3. Components don\'t have index.tsx/index.ts files');
      console.warn('\nTip: Set includeComponents to an empty array [] to include all components');
    }

    // Filter duplicates if any (though path key should be unique)
    return components;
  }

  /**
   * Generate documentation for all components
   */
  generateAllDocs(): ComponentDoc[] {
    const components = this.findAllComponents();
    const docs: ComponentDoc[] = [];

    console.log(`Found ${components.length} components`);

    for (const { path: componentPath, category } of components) {
      const componentName = path.basename(componentPath);
      console.log(`Generating docs for ${category}/${componentName}...`);

      const doc = this.generateComponentDoc(componentPath, category);
      if (doc) {
        docs.push(doc);
      }
    }

    return docs;
  }

  /**
   * Save documentation to JSON file
   */
  saveDocsToFile(docs: ComponentDoc[], outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2), 'utf-8');
    console.log(`Documentation saved to ${outputPath}`);
  }

  /**
   * Save individual component doc to separate JSON file
   */
  saveComponentDoc(doc: ComponentDoc, outputDir: string): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `${doc.componentName}.json`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8');
    console.log(`Saved ${fileName}`);
  }
}
