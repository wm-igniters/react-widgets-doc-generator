# How to Use Generated Documentation in Storybook Stories

## Overview

The documentation generator creates JSON files with complete component information. Here's how to use them in your Storybook stories.

## Example: Button Component

### 1. Generate the documentation

```bash
cd doc-generator
npm run dev -- generate --component button --output ../rn-widgets-storybook/docs
```

### 2. Import in your story file

```tsx
import buttonDocs from '../../docs/button.json';

// Extract what you need
const buttonProps = buttonDocs.props;
const buttonEvents = buttonDocs.events;
const buttonMethods = buttonDocs.methods;
```

### 3. Generate prop tables dynamically

```tsx
const meta = {
  title: "Form/Button",
  component: WmButton,
  parameters: {
    docs: {
      description: {
        component: generateComponentDocs(buttonDocs),
      }
    }
  },
  argTypes: generateArgTypes(buttonDocs.props),
} satisfies Meta<typeof WmButton>;
```

### 4. Helper Functions

Create a `docs-helpers.ts` file:

```typescript
import { ComponentDoc, PropInfo } from '../doc-generator/src/types';

/**
 * Generate markdown documentation from JSON
 */
export function generateComponentDocs(docs: ComponentDoc): string {
  const { componentName, props, methods, events, styles } = docs;

  let markdown = `# ${componentName} Component\n\n`;

  // Props table
  markdown += '## Props\n\n';
  markdown += '| Prop | Type | Default | Required | Inherited |\n';
  markdown += '|------|------|---------|----------|------------|\n';

  props.forEach(prop => {
    const inherited = prop.inherited ? `✓ (${prop.inheritedFrom})` : '';
    const required = prop.optional ? '' : '✓';
    markdown += `| ${prop.name} | \`${prop.type}\` | \`${prop.defaultValue || '-'}\` | ${required} | ${inherited} |\n`;
  });

  // Events table
  if (events.length > 0) {
    markdown += '\n## Events\n\n';
    markdown += '| Event | Parameters | Description |\n';
    markdown += '|-------|------------|-------------|\n';

    events.forEach(event => {
      markdown += `| ${event.name} | \`${event.parameters}\` | ${event.description || '-'} |\n`;
    });
  }

  // Methods table
  if (methods.length > 0) {
    markdown += '\n## Methods\n\n';
    markdown += '| Method | Parameters | Returns | Description |\n';
    markdown += '|--------|------------|---------|-------------|\n';

    methods.forEach(method => {
      const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
      markdown += `| ${method.name} | \`(${params})\` | \`${method.returnType}\` | ${method.description || '-'} |\n`;
    });
  }

  // Styles
  if (styles.length > 0) {
    markdown += '\n## Style Classes\n\n';
    styles.forEach(style => {
      markdown += `- \`${style.className}\`${style.description ? ` - ${style.description}` : ''}\n`;
    });
  }

  return markdown;
}

/**
 * Generate Storybook argTypes from props
 */
export function generateArgTypes(props: PropInfo[]) {
  const argTypes: Record<string, any> = {};

  props.forEach(prop => {
    // Skip inherited props for cleaner UI (optional)
    // if (prop.inherited) return;

    argTypes[prop.name] = {
      description: prop.inherited
        ? `Inherited from ${prop.inheritedFrom}`
        : undefined,
      table: {
        type: { summary: prop.type },
        defaultValue: { summary: prop.defaultValue },
      },
    };

    // Auto-detect control types
    if (prop.type === 'boolean') {
      argTypes[prop.name].control = 'boolean';
    } else if (prop.type === 'number') {
      argTypes[prop.name].control = 'number';
    } else if (prop.type === 'string') {
      argTypes[prop.name].control = 'text';
    } else if (prop.type.includes('|')) {
      // Union types - create select
      const options = prop.type
        .split('|')
        .map(o => o.trim().replace(/['"]/g, ''));
      argTypes[prop.name].control = {
        type: 'select',
        options,
      };
    }
  });

  return argTypes;
}

/**
 * Filter props by category
 */
export function filterProps(props: PropInfo[], category: 'own' | 'inherited' | 'all' = 'all') {
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
export function getPropsByPattern(props: PropInfo[], pattern: RegExp) {
  return props.filter(p => pattern.test(p.name));
}
```

### 5. Complete Story Example

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { View } from "react-native";
import WmButton from "@wavemaker/app-rn-runtime/components/basic/button/button.component";
import { action } from "@storybook/addon-actions";

// Import generated docs
import buttonDocs from "../../docs/button.json";
import { generateComponentDocs, generateArgTypes } from "../../docs/helpers";

const meta = {
  title: "Form/Button",
  component: WmButton,
  decorators: [
    (Story) => (
      <View style={{ padding: 16 }}>
        <Story />
      </View>
    ),
  ],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: generateComponentDocs(buttonDocs),
      }
    }
  },
  argTypes: generateArgTypes(buttonDocs.props),
} satisfies Meta<typeof WmButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    caption: "Click me",
    classname: "btn-primary",
    onTap: action("onTap"),
  },
};

export const WithIcon: Story = {
  args: {
    caption: "Send",
    classname: "btn-primary",
    iconclass: "fa fa-send",
    iconposition: "left",
    onTap: action("onTap"),
  },
};
```

## Automation Workflow

### Option 1: Manual Generation

```bash
# Generate docs before working on stories
npm run generate:all
```

### Option 2: Watch Mode (Future Enhancement)

```bash
# Auto-regenerate on library updates
npm run docs:watch
```

### Option 3: Pre-commit Hook (Future Enhancement)

```bash
# Add to package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run generate:all"
    }
  }
}
```

## Benefits

1. **Single Source of Truth**: Props, types, and defaults come from actual component code
2. **No Manual Sync**: Documentation updates automatically when library updates
3. **Type Safety**: Import JSON with full TypeScript types
4. **Consistent Format**: All components documented in the same structure
5. **Easy Validation**: Compare story args against actual props

## Next Steps

- Create a `docs-helpers.ts` file with the helper functions
- Update existing stories to use generated JSON
- Add descriptions to a separate `descriptions.yaml` file
- Create CI job to auto-generate docs on library update
