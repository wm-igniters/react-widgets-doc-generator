/**
 * Type definitions for component documentation generator
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
  parameters: ParameterInfo[];
  description?: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
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
  properties?: Record<string, any>;
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
  children?: ComponentDoc[];
  description?: string;
}

export interface SourceMapContent {
  version: number;
  sources: string[];
  sourcesContent: string[];
  names: string[];
  mappings: string;
}
