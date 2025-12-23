/**
 * Helper functions to use generated documentation in Storybook stories
 */

export interface PropInfo {
  name: string;
  type: string;
  defaultValue?: string;
  optional: boolean;
  description?: string;
  inherited?: boolean;
  inheritedFrom?: string;
}

export interface MethodInfo {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  returnType: string;
  parameters: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;
  description?: string;
}

export interface EventInfo {
  name: string;
  type: string;
  parameters?: string;
  description?: string;
}

export interface StyleInfo {
  className: string;
  description?: string;
}

export interface ComponentDoc {
  componentName: string;
  componentPath: string;
  category: string;
  props: PropInfo[];
  methods: MethodInfo[];
  events: EventInfo[];
  styles: StyleInfo[];
  baseClass?: string;
  description?: string;
}

/**
 * Generate complete markdown documentation from ComponentDoc JSON
 */
export function generateComponentDocs(docs: ComponentDoc): string {
  const { componentName, props, methods, events, styles } = docs;

  let markdown = `# ${componentName} Component\n\n`;

  // Component description
  if (docs.description) {
    markdown += `${docs.description}\n\n`;
  }

  // Props table - separated by own and inherited
  const ownProps = props.filter(p => !p.inherited);
  const inheritedProps = props.filter(p => p.inherited);

  if (ownProps.length > 0) {
    markdown += '## Component Props\n\n';
    markdown += '| Prop | Type | Default | Required |\n';
    markdown += '|------|------|---------|----------|\n';

    ownProps.forEach(prop => {
      const required = prop.optional ? '' : '✓';
      markdown += `| ${prop.name} | \`${prop.type}\` | \`${prop.defaultValue || '-'}\` | ${required} |\n`;
    });
    markdown += '\n';
  }

  if (inheritedProps.length > 0) {
    markdown += '## Inherited Props\n\n';
    markdown += '| Prop | Type | Default | Inherited From |\n';
    markdown += '|------|------|---------|----------------|\n';

    inheritedProps.forEach(prop => {
      markdown += `| ${prop.name} | \`${prop.type}\` | \`${prop.defaultValue || '-'}\` | ${prop.inheritedFrom} |\n`;
    });
    markdown += '\n';
  }

  // Events table
  if (events.length > 0) {
    markdown += '## Events\n\n';
    markdown += '| Event | Parameters | Description |\n';
    markdown += '|-------|------------|-------------|\n';

    events.forEach(event => {
      markdown += `| ${event.name} | \`${event.parameters}\` | ${event.description || '-'} |\n`;
    });
    markdown += '\n';
  }

  // Methods table
  if (methods.length > 0) {
    markdown += '## Public Methods\n\n';
    markdown += '| Method | Parameters | Returns |\n';
    markdown += '|--------|------------|----------|\n';

    methods.forEach(method => {
      const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
      markdown += `| ${method.name} | \`(${params})\` | \`${method.returnType}\` |\n`;
    });
    markdown += '\n';
  }

  // Styles
  if (styles.length > 0) {
    markdown += '## Style Classes\n\n';
    markdown += 'Available style classes:\n\n';
    styles.forEach(style => {
      markdown += `- \`${style.className}\`${style.description ? ` - ${style.description}` : ''}\n`;
    });
  }

  return markdown;
}

/**
 * Generate Storybook argTypes from props
 */
export function generateArgTypes(
  props: PropInfo[],
  options: {
    includeInherited?: boolean;
    controlOverrides?: Record<string, any>;
  } = {}
) {
  const { includeInherited = true, controlOverrides = {} } = options;
  const argTypes: Record<string, any> = {};

  props
    .filter(prop => includeInherited || !prop.inherited)
    .forEach(prop => {
      argTypes[prop.name] = {
        description: prop.inherited
          ? `Inherited from ${prop.inheritedFrom}`
          : prop.description,
        table: {
          type: { summary: prop.type },
          defaultValue: { summary: prop.defaultValue },
          category: prop.inherited ? 'Inherited' : 'Props',
        },
      };

      // Apply control overrides if provided
      if (controlOverrides[prop.name]) {
        argTypes[prop.name].control = controlOverrides[prop.name];
        return;
      }

      // Auto-detect control types
      if (prop.type === 'boolean') {
        argTypes[prop.name].control = { type: 'boolean' };
      } else if (prop.type === 'number') {
        argTypes[prop.name].control = { type: 'number' };
      } else if (prop.type === 'string') {
        argTypes[prop.name].control = { type: 'text' };
      } else if (prop.type.includes('|') && !prop.type.includes('=>')) {
        // Union types (but not function types) - create select
        const options = prop.type
          .split('|')
          .map(o => o.trim().replace(/['"()]/g, ''))
          .filter(o => o && o !== 'undefined' && o !== 'null');

        if (options.length > 0 && options.length <= 10) {
          argTypes[prop.name].control = {
            type: 'select',
            options,
          };
        }
      } else if (prop.type === 'Function' || prop.type.includes('=>')) {
        // Disable control for functions
        argTypes[prop.name].control = false;
      }
    });

  return argTypes;
}

/**
 * Filter props by category
 */
export function filterProps(
  props: PropInfo[],
  category: 'own' | 'inherited' | 'all' = 'all'
): PropInfo[] {
  if (category === 'own') {
    return props.filter(p => !p.inherited);
  }
  if (category === 'inherited') {
    return props.filter(p => p.inherited);
  }
  return props;
}

/**
 * Get props by name pattern
 */
export function getPropsByPattern(props: PropInfo[], pattern: RegExp): PropInfo[] {
  return props.filter(p => pattern.test(p.name));
}

/**
 * Get event handlers from props
 */
export function getEventHandlers(props: PropInfo[]): PropInfo[] {
  return props.filter(p => p.name.startsWith('on') && p.type === 'Function');
}

/**
 * Generate prop table for a specific category
 */
export function generatePropTable(
  props: PropInfo[],
  options: {
    includeDefaults?: boolean;
    includeTypes?: boolean;
    includeRequired?: boolean;
  } = {}
): string {
  const { includeDefaults = true, includeTypes = true, includeRequired = true } = options;

  let headers = ['Prop'];
  if (includeTypes) headers.push('Type');
  if (includeDefaults) headers.push('Default');
  if (includeRequired) headers.push('Required');

  let markdown = '| ' + headers.join(' | ') + ' |\n';
  markdown += '|' + headers.map(() => '------').join('|') + '|\n';

  props.forEach(prop => {
    let row = [`${prop.name}`];
    if (includeTypes) row.push(`\`${prop.type}\``);
    if (includeDefaults) row.push(`\`${prop.defaultValue || '-'}\``);
    if (includeRequired) row.push(prop.optional ? '' : '✓');

    markdown += '| ' + row.join(' | ') + ' |\n';
  });

  return markdown;
}

/**
 * Create documentation sections
 */
export function createDocSections(docs: ComponentDoc) {
  return {
    overview: `# ${docs.componentName}\n\nCategory: ${docs.category}\nBase Class: ${docs.baseClass || 'None'}`,
    ownProps: generatePropTable(filterProps(docs.props, 'own')),
    inheritedProps: generatePropTable(filterProps(docs.props, 'inherited')),
    events: docs.events,
    methods: docs.methods,
    styles: docs.styles,
  };
}

/**
 * Validate story args against component props
 */
export function validateStoryArgs(
  args: Record<string, any>,
  docs: ComponentDoc
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const validPropNames = new Set(docs.props.map(p => p.name));

  Object.keys(args).forEach(argName => {
    if (!validPropNames.has(argName)) {
      errors.push(`Unknown prop: ${argName}`);
    }
  });

  // Check required props
  const requiredProps = docs.props.filter(p => !p.optional && !p.inherited);
  requiredProps.forEach(prop => {
    if (!(prop.name in args)) {
      errors.push(`Missing required prop: ${prop.name}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
