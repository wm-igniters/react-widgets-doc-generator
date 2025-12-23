/**
 * Extracts TypeScript source code from JavaScript source map files
 */

import * as fs from 'fs';
import * as path from 'path';
import { SourceMapContent } from './types.js';

export class SourceExtractor {
  /**
   * Read and parse a .js.map file
   */
  static readSourceMap(mapFilePath: string): SourceMapContent | null {
    try {
      const content = fs.readFileSync(mapFilePath, 'utf-8');
      return JSON.parse(content) as SourceMapContent;
    } catch (error) {
      console.error(`Error reading source map ${mapFilePath}:`, error);
      return null;
    }
  }

  /**
   * Extract TypeScript source content from source map
   */
  static extractSourceContent(mapFilePath: string, sourceIndex: number = 0): string | null {
    const sourceMap = this.readSourceMap(mapFilePath);

    if (!sourceMap) {
      return null;
    }

    if (!sourceMap.sourcesContent || sourceMap.sourcesContent.length === 0) {
      console.error(`No source content found in ${mapFilePath}`);
      return null;
    }

    if (sourceIndex >= sourceMap.sourcesContent.length) {
      console.error(`Source index ${sourceIndex} out of bounds for ${mapFilePath}`);
      return null;
    }

    return sourceMap.sourcesContent[sourceIndex];
  }

  /**
   * Get the original TypeScript filename from source map
   */
  static getSourceFileName(mapFilePath: string, sourceIndex: number = 0): string | null {
    const sourceMap = this.readSourceMap(mapFilePath);

    if (!sourceMap || !sourceMap.sources || sourceMap.sources.length === 0) {
      return null;
    }

    if (sourceIndex >= sourceMap.sources.length) {
      return null;
    }

    return sourceMap.sources[sourceIndex];
  }

  /**
   * Extract all source files from a component directory
   * Supports both old format (.js.map files) and new format (direct .tsx/.ts files)
   */
  static extractComponentSources(componentDir: string): {
    props?: string;
    component?: string;
    styles?: string;
  } {
    const sources: {
      props?: string;
      component?: string;
      styles?: string;
    } = {};

    const files = fs.readdirSync(componentDir);

    // Check for new format first (index.tsx or index.ts)
    const indexTsx = files.find(f => f === 'index.tsx' || f === 'index.ts');
    if (indexTsx) {
      // Read the TypeScript file directly
      const indexPath = path.join(componentDir, indexTsx);
      try {
        const content = fs.readFileSync(indexPath, 'utf-8');
        // For new format, the index file contains both props and component
        sources.component = content;
        sources.props = content; // Same file contains props interface/type
      } catch (error) {
        console.error(`Error reading ${indexPath}:`, error);
      }

      // Check for separate types file
      const typesFile = files.find(f => f === 'types.ts' || f === 'types.tsx' || f.endsWith('.types.ts'));
      if (typesFile) {
        const typesPath = path.join(componentDir, typesFile);
        try {
          const typesContent = fs.readFileSync(typesPath, 'utf-8');
          sources.props = typesContent; // Override with dedicated types file
        } catch (error) {
          console.error(`Error reading ${typesPath}:`, error);
        }
      }

      // Check for styles file
      const stylesFile = files.find(f =>
        f === 'styles.ts' ||
        f === 'styles.tsx' ||
        f.endsWith('.styles.ts') ||
        f.endsWith('.styles.tsx')
      );
      if (stylesFile) {
        const stylesPath = path.join(componentDir, stylesFile);
        try {
          sources.styles = fs.readFileSync(stylesPath, 'utf-8');
        } catch (error) {
          console.error(`Error reading ${stylesPath}:`, error);
        }
      }

      return sources;
    }

    // Fall back to old format (.js.map files)
    // Extract props
    const propsMap = files.find(f => f.endsWith('.props.js.map'));
    if (propsMap) {
      const content = this.extractSourceContent(path.join(componentDir, propsMap));
      if (content) sources.props = content;
    }

    // Extract component
    const componentMap = files.find(f => f.endsWith('.component.js.map'));
    if (componentMap) {
      const content = this.extractSourceContent(path.join(componentDir, componentMap));
      if (content) sources.component = content;
    }

    // Extract styles
    const stylesMap = files.find(f => f.endsWith('.styles.js.map'));
    if (stylesMap) {
      const content = this.extractSourceContent(path.join(componentDir, stylesMap));
      if (content) sources.styles = content;
    }

    return sources;
  }
}
