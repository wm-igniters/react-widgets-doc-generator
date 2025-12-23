/**
 * TypeScript AST parser to extract props, methods, and other component information
 */

import * as ts from 'typescript';
import { PropInfo, MethodInfo, ParameterInfo } from './types.js';

export class TypeScriptParser {
  /**
   * Parse TypeScript source code and create AST
   */
  static createSourceFile(sourceCode: string, fileName: string = 'temp.tsx'): ts.SourceFile {
    return ts.createSourceFile(
      fileName,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );
  }

  /**
   * Extract props from a Props class or interface
   */
  static extractProps(sourceCode: string): {
    props: PropInfo[];
    className: string;
    baseClass?: string;
  } | null {
    const sourceFile = this.createSourceFile(sourceCode);
    let result: { props: PropInfo[]; className: string; baseClass?: string } | null = null;

    const visit = (node: ts.Node) => {
      // Handle class declarations (old format)
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;

        // Only process Props classes
        if (className.endsWith('Props')) {
          const props: PropInfo[] = [];
          let baseClass: string | undefined;

          // Get base class
          if (node.heritageClauses) {
            for (const heritage of node.heritageClauses) {
              if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
                const baseType = heritage.types[0];
                if (ts.isExpressionWithTypeArguments(baseType)) {
                  baseClass = baseType.expression.getText(sourceFile);
                }
              }
            }
          }

          // Extract properties
          node.members.forEach((member) => {
            if (ts.isPropertyDeclaration(member) && member.name) {
              const propName = member.name.getText(sourceFile);
              const optional = !!member.questionToken;
              let propType = 'any';
              let defaultValue: string | undefined;

              // Get type
              if (member.type) {
                propType = member.type.getText(sourceFile);
              }

              // Get default value
              if (member.initializer) {
                let initText = member.initializer.getText(sourceFile);
                // Clean up "null as any" patterns
                if (initText === 'null as any') {
                  defaultValue = 'null';
                } else if (initText.endsWith(' as any')) {
                  defaultValue = initText.replace(' as any', '');
                } else {
                  defaultValue = initText;
                }
              }

              props.push({
                name: propName,
                type: propType,
                optional,
                defaultValue,
                inherited: false,
              });
            }
          });

          result = { props, className, baseClass };
        }
      }

      // Handle interface declarations (new format)
      if (ts.isInterfaceDeclaration(node) && node.name) {
        const interfaceName = node.name.text;

        // Only process Props interfaces (WmButtonProps, etc.)
        if (interfaceName.endsWith('Props')) {
          const props: PropInfo[] = [];
          let baseClass: string | undefined;

          // Get base interface (extends)
          if (node.heritageClauses) {
            for (const heritage of node.heritageClauses) {
              if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
                const baseType = heritage.types[0];
                if (ts.isExpressionWithTypeArguments(baseType)) {
                  baseClass = baseType.expression.getText(sourceFile);
                }
              }
            }
          }

          // Extract properties from interface
          node.members.forEach((member) => {
            if (ts.isPropertySignature(member) && member.name) {
              const propName = member.name.getText(sourceFile);
              const optional = !!member.questionToken;
              let propType = 'any';

              // Get type
              if (member.type) {
                propType = member.type.getText(sourceFile);
              }

              props.push({
                name: propName,
                type: propType,
                optional,
                inherited: false,
              });
            }
          });

          result = { props, className: interfaceName, baseClass };
        }
      }

      // Handle type alias declarations (e.g., type WmButtonProps = {...})
      if (ts.isTypeAliasDeclaration(node) && node.name) {
        const typeName = node.name.text;

        // Only process Props types
        if (typeName.endsWith('Props') && ts.isTypeLiteralNode(node.type)) {
          const props: PropInfo[] = [];

          // Extract properties from type literal
          node.type.members.forEach((member) => {
            if (ts.isPropertySignature(member) && member.name) {
              const propName = member.name.getText(sourceFile);
              const optional = !!member.questionToken;
              let propType = 'any';

              // Get type
              if (member.type) {
                propType = member.type.getText(sourceFile);
              }

              props.push({
                name: propName,
                type: propType,
                optional,
                inherited: false,
              });
            }
          });

          result = { props, className: typeName };
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return result;
  }

  /**
   * Extract methods from component class
   */
  static extractMethods(sourceCode: string): {
    methods: MethodInfo[];
    className: string;
  } | null {
    const sourceFile = this.createSourceFile(sourceCode);
    let result: { methods: MethodInfo[]; className: string } | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;

        // Process component classes (not Props or Styles)
        if (!className.endsWith('Props') && !className.endsWith('Styles') && !className.endsWith('State')) {
          const methods: MethodInfo[] = [];

          node.members.forEach((member) => {
            if (ts.isMethodDeclaration(member) && member.name) {
              const methodName = member.name.getText(sourceFile);

              // Skip lifecycle methods and render methods (they're not public API)
              if (['constructor', 'render', 'componentDidMount', 'componentWillUnmount',
                   'shouldComponentUpdate', 'componentDidUpdate'].includes(methodName)) {
                return;
              }

              let visibility: 'public' | 'private' | 'protected' = 'public';

              // Check modifiers
              if (member.modifiers) {
                for (const modifier of member.modifiers) {
                  if (modifier.kind === ts.SyntaxKind.PrivateKeyword) {
                    visibility = 'private';
                  } else if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) {
                    visibility = 'protected';
                  }
                }
              }

              // Only include public methods
              if (visibility !== 'public') {
                return;
              }

              // Get return type
              let returnType = 'void';
              if (member.type) {
                returnType = member.type.getText(sourceFile);
              }

              // Get parameters
              const parameters: ParameterInfo[] = [];
              member.parameters.forEach((param) => {
                if (ts.isIdentifier(param.name)) {
                  const paramName = param.name.text;
                  const paramOptional = !!param.questionToken;
                  let paramType = 'any';

                  if (param.type) {
                    paramType = param.type.getText(sourceFile);
                  }

                  parameters.push({
                    name: paramName,
                    type: paramType,
                    optional: paramOptional,
                  });
                }
              });

              methods.push({
                name: methodName,
                visibility,
                returnType,
                parameters,
              });
            }
          });

          result = { methods, className };
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return result;
  }

  /**
   * Extract style class names from styles file
   */
  static extractStyleClasses(sourceCode: string): {
    defaultClass: string;
    styleClasses: string[];
  } | null {
    const sourceFile = this.createSourceFile(sourceCode);
    let defaultClass = '';
    const styleClasses: string[] = [];

    const visit = (node: ts.Node) => {
      // Look for DEFAULT_CLASS constant
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((declaration) => {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === 'DEFAULT_CLASS') {
            if (declaration.initializer && ts.isStringLiteral(declaration.initializer)) {
              defaultClass = declaration.initializer.text;
            }
          }
        });
      }

      // Look for addStyle calls to find all style classes
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        let isAddStyleCall = false;

        // Check if it's addStyle call (either as identifier or property access)
        if (ts.isIdentifier(expression) && expression.text === 'addStyle') {
          isAddStyleCall = true;
        } else if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'addStyle') {
          isAddStyleCall = true;
        }

        if (isAddStyleCall && node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (ts.isStringLiteral(firstArg)) {
            // Direct string literal: addStyle('link-primary', ...)
            const className = firstArg.text;
            if (!styleClasses.includes(className)) {
              styleClasses.push(className);
            }
          } else if (ts.isBinaryExpression(firstArg)) {
            // Handle cases like DEFAULT_CLASS + '-disabled'
            const text = firstArg.getText(sourceFile);

            // Try to resolve DEFAULT_CLASS references
            let resolvedClassName = text;
            if (text.includes('DEFAULT_CLASS') && defaultClass) {
              resolvedClassName = text.replace(/DEFAULT_CLASS/g, `'${defaultClass}'`);
              // Evaluate simple concatenations like 'app-button' + '-disabled'
              try {
                // Remove quotes and concatenate
                resolvedClassName = resolvedClassName
                  .replace(/['"`]/g, '')
                  .replace(/\s*\+\s*/g, '');
              } catch (e) {
                // Keep original if evaluation fails
                resolvedClassName = text;
              }
            }

            if (!styleClasses.includes(resolvedClassName)) {
              styleClasses.push(resolvedClassName);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    if (defaultClass || styleClasses.length > 0) {
      return { defaultClass, styleClasses };
    }

    return null;
  }

  /**
   * Extract event handlers (props that are Functions and start with 'on')
   */
  static extractEvents(props: PropInfo[]): Array<{ name: string; type: string }> {
    return props
      .filter(prop =>
        prop.name.startsWith('on') &&
        (prop.type === 'Function' || prop.type.includes('=>'))
      )
      .map(prop => ({
        name: prop.name,
        type: prop.type,
      }));
  }

  /**
   * Extract event callbacks from invokeEventCallback calls in JavaScript source
   * Pattern: invokeEventCallback('onTap', [e, target])
   */
  static extractEventCallbacks(sourceCode: string): Array<{ name: string; parameters: string }> {
    const events: Array<{ name: string; parameters: string }> = [];
    const eventSet = new Set<string>(); // To avoid duplicates

    // Match: invokeEventCallback('eventName', [params])
    // This regex captures the event name from invokeEventCallback calls
    const invokePattern = /invokeEventCallback\s*\(\s*['"](\w+)['"]\s*,\s*\[([^\]]*)\]\s*\)/g;

    let match;
    while ((match = invokePattern.exec(sourceCode)) !== null) {
      const eventName = match[1]; // e.g., 'onTap', 'onDoubletap', 'onLongtap'
      const params = match[2].trim(); // e.g., 'e, target'

      if (!eventSet.has(eventName)) {
        eventSet.add(eventName);

        // Clean up parameters - extract variable names
        const paramList = params
          .split(',')
          .map(p => p.trim())
          .filter(p => p && p !== 'this.props.target' && p !== 'target');

        events.push({
          name: eventName,
          parameters: paramList.length > 0 ? `(${paramList.join(', ')})` : '()'
        });
      }
    }

    return events;
  }
}
