/**
 * Configuration for documentation generator
 */

import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export interface GeneratorConfig {
  /**
   * Components to include in documentation generation (whitelist)
   */
  includeComponents: string[];

  /**
   * Child components mapping: Parent -> { ChildName: RelativePath }
   */
  childComponents: {
    [parentName: string]: {
      [childName: string]: string;
    };
  };

  /**
   * Categories to exclude from documentation generation
   */
  excludeCategories: string[];

  /**
   * Specific component names to exclude (regardless of category)
   */
  excludeComponents: string[];

  /**
   * Documentation content filtering
   */
  documentation: {
    /**
     * Props to exclude from all components
     */
    excludeProps: string[];

    /**
     * Inherited props to exclude (reduces clutter)
     */
    excludeInheritedProps: string[];

    /**
     * Methods to exclude (internal/private methods)
     */
    excludeMethods: string[];

    /**
     * Style classes to exclude
     */
    excludeStyleClasses: string[];

    /**
     * Component-specific overrides
     */
    componentOverrides: {
      [componentName: string]: {
        excludeProps?: string[];
        excludeMethods?: string[];
        excludeStyleClasses?: string[];
      };
    };
  };

  /**
   * LLM generation settings
   */
  llm: {
    /**
     * AI provider to use
     */
    provider: "claude" | "openai" | "ollama";

    /**
     * Model to use (optional, uses provider default)
     */
    model?: string;

    /**
     * Base path where generated markdown will be saved
     * Files will be saved to: {storybookPath}/components/{ComponentName}/{componentName}.auto.md
     */
    storybookPath: string;

    /**
     * Number of components to process in parallel
     * Higher values = faster but may hit rate limits
     * Recommended: 5-10
     */
    batchSize: number;
  };

  /**
   * Path to component source directory
   * e.g., ../react-widgets-storybook/src/components
   */
  componentsSourcePath: string;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: GeneratorConfig = {
  // Component discovery exclusions
  includeComponents: [

    'accordion',
    'anchor',
    'audio',
    'bar-chart',
    'bottomsheet',
    'bubble-chart',
    'button',
    'button-group',
    'calendar',
    'camera', // device/camera
    'card',
    'carousel',
    'checkbox',
    'checkboxset',
    'chips',
    'column-chart',
    'currency',
    'date',
    'datetime',
    'dialog', // mapped from 'Design dialog'
    'donut-chart',
    'fileupload',
    'form',
    'icon',
    'picture', // picture -> mapped to image/picture? No, folder is 'picture'. User asked for 'Picture'.
    'label',
    'layoutgrid',
    'line-chart',
    'linearlayout', // User asked for 'LinearLayout'
    'list',
    'liveform',
    'login',
    'lottie',
    'menu',
    'message',
    'modal', // User asked for 'Design dialog'? No 'Design dialog' -> dialogs/dialog. 'Modal' -> basic/modal.
    'navbar',
    'number',
    'panel',
    'pie-chart',
    'popover',
    'progress-bar',
    'progress-circle',
    'radioset',
    'rating',
    'search',
    'select',
    'selectlocale', // Not found in scanning
    'slider',
    'spinner',
    'switch',
    'tabs',
    'text',
    'textarea',
    'tile',
    'time',
    'toggle',
    'tooltip',
    'video',
    'webview',
    'wizard',
    'barcodescanner', // device/barcodescanner
    'alertdialog', // dialogs/alertdialog
    'confirmdialog', // dialogs/confirmdialog
    'area-chart', // chart/area-chart
  ],

  childComponents: {
    'accordion': {
      'accordion-pane': './accordionpane',
    },
    'dialog': {
      'dialog-content': '../dialogcontent',
      'dialog-actions': '../dialogactions',
    }
  },

  excludeCategories: [
    'node_modules',
    '.git',
    'dist',
    'coverage',
    'prefabs',
    'page'
  ],

  excludeComponents: [
    // Deprecated by includeComponents, keeping for reference or mixed usage if needed
  ],

  // Documentation content filtering
  documentation: {
    // Common props that clutter documentation
    excludeProps: [],

    // Inherited props that are rarely used in stories
    excludeInheritedProps: [
      "listener", // Internal lifecycle
      "showskeletonchildren", // Advanced feature
      "deferload", // Advanced feature
      "isdefault", // Internal flag
      "key", // React internal
      "id",
      "name",
      "children"
    ],

    // Internal methods not meant for public use
    excludeMethods: [
      "renderWidget", // Internal render
      "renderSkeleton", // Internal skeleton render
      "prepareIcon", // Internal helper
      "prepareBadge", // Internal helper
      "updateState", // Internal state
      "componentDidMount", // React lifecycle
      "componentWillUnmount", // React lifecycle
      "componentDidUpdate", // React lifecycle
    ],

    // Style classes that are internal
    excludeStyleClasses: [],

    // Per-component overrides
    componentOverrides: {},
  },

  // LLM settings (read from environment variables)
  llm: {
    provider: (process.env.AI_PROVIDER || "claude") as
      | "claude"
      | "openai"
      | "ollama",
    model: process.env.AI_MODEL || "claude-3-7-sonnet-20250219",
    storybookPath: process.env.STORYBOOK_PATH || "../react-widgets-storybook",
    batchSize: parseInt(process.env.BATCH_SIZE || "5"),
  },

  // Path to component source directory (should point to the components root directory)
  componentsSourcePath: "../react-widgets-storybook/src/components",
};

/**
 * Get API key for the configured provider
 */
export function getApiKey(
  provider: "claude" | "openai" | "ollama"
): string | undefined {
  switch (provider) {
    case "claude":
      return process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "ollama":
      return undefined; // Ollama doesn't need API key
    default:
      return undefined;
  }
}
