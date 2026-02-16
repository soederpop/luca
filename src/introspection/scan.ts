import { Feature } from '../feature.js';
import type { HelperIntrospection, MethodIntrospection, GetterIntrospection, EventIntrospection, ContainerIntrospection } from './index.js';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../schemas/base.js'

export const IntrospectionScannerStateSchema = FeatureStateSchema.extend({
  scanResults: z.array(z.any()).default([]),
  containerResults: z.array(z.any()).default([]),
  lastScanTime: z.date().nullable().default(null),
  scannedFiles: z.array(z.string()).default([]),
})

export const IntrospectionScannerOptionsSchema = FeatureOptionsSchema.extend({
  src: z.array(z.string()).optional(),
  outputPath: z.string().optional(),
  includePrivate: z.boolean().optional(),
})

export type IntrospectionScannerState = z.infer<typeof IntrospectionScannerStateSchema>
export type IntrospectionScannerOptions = z.infer<typeof IntrospectionScannerOptionsSchema>

export class IntrospectionScannerFeature extends Feature<IntrospectionScannerState, IntrospectionScannerOptions> {
  static override shortcut = 'introspectionScanner';
  static override description = 'Scans TypeScript files for Helper classes and generates introspection data using AST analysis';

  override get initialState(): IntrospectionScannerState {
    return {
      ...super.initialState,
      scanResults: [],
      containerResults: [],
      lastScanTime: null,
      scannedFiles: []
    };
  }

  override async enable(options: Partial<IntrospectionScannerOptions> = {}): Promise<this> {
    const fullOptions: IntrospectionScannerOptions = {
      src: [],
      outputPath: 'src/introspection/generated.ts',
      includePrivate: false,
      ...options
    };
    
    await super.enable(fullOptions);
    
    if (!this.options.src || this.options.src.length === 0) {
      throw new Error('IntrospectionScanner requires src directories to be specified');
    }

    return this;
  }

  /**
   * Scan the specified source directories for Helper classes and extract introspection data
   */
  async scan(): Promise<HelperIntrospection[]> {
    const startTime = Date.now();
    this.emit('scanStarted', { directories: this.options.src });

    try {
      const results: HelperIntrospection[] = [];
      const containerResults: Partial<ContainerIntrospection>[] = [];
      const scannedFiles: string[] = [];

      for (const srcDir of this.options.src || []) {
        const files = await this.findTypeScriptFiles(srcDir);
        scannedFiles.push(...files);

        for (const file of files) {
          const { helpers, containers } = await this.analyzeFile(file);
          results.push(...helpers);
          containerResults.push(...containers);
        }
      }

      this.setState({
        scanResults: results,
        containerResults,
        lastScanTime: new Date(),
        scannedFiles
      });

      const duration = Date.now() - startTime;
      this.emit('scanCompleted', {
        results: results.length,
        containers: containerResults.length,
        files: scannedFiles.length,
        duration
      });

      return results;
    } catch (error) {
      this.emit('scanFailed', error);
      throw error;
    }
  }

  /**
   * Generate a TypeScript file that populates the introspection registry
   */
  async generateRegistryScript(): Promise<string> {
    let results = this.state.get('scanResults');
    if (!results || results.length === 0) {
      await this.scan();
      results = this.state.get('scanResults');
    }

    const containerResults = this.state.get('containerResults') || [];
    const script = this.createRegistryScript(results!, containerResults);

    if (this.options.outputPath) {
      await fs.promises.writeFile(this.options.outputPath, script);
      this.emit('scriptGenerated', { path: this.options.outputPath });
    }

    return script;
  }

  private async findTypeScriptFiles(srcPath: string): Promise<string[]> {
    // If it's a direct .ts file path, return it directly (if it exists)
    if (srcPath.endsWith('.ts')) {
      try {
        await fs.promises.access(srcPath);
        return [srcPath];
      } catch {
        return [];
      }
    }

    const pattern = path.join(srcPath, '**/*.ts');
    return await glob(pattern, {
      ignore: ['**/*.d.ts', '**/node_modules/**']
    });
  }

  private async analyzeFile(filePath: string): Promise<{ helpers: HelperIntrospection[], containers: Partial<ContainerIntrospection>[] }> {
    const sourceCode = await fs.promises.readFile(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const helpers: HelperIntrospection[] = [];
    const containers: Partial<ContainerIntrospection>[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        if (this.extendsContainer(node)) {
          const containerData = this.analyzeContainerClass(node, sourceFile);
          if (containerData) {
            containers.push(containerData);
          }
        } else {
          const introspection = this.analyzeClass(node, sourceFile);
          if (introspection) {
            helpers.push(introspection);
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { helpers, containers };
  }

  private analyzeClass(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): HelperIntrospection | null {
    const className = classNode.name?.text;
    if (!className) return null;

    // Check if this extends Helper, Feature, Client, or Server
    const isHelperClass = this.extendsHelper(classNode);
    if (!isHelperClass) return null;

    const shortcut = this.extractShortcut(classNode);
    if (!shortcut) return null;

    const description = this.extractJSDocDescription(classNode);
    const methods = this.extractMethods(classNode, sourceFile);
    const getters = this.extractGetters(classNode, sourceFile);
    const events = this.extractEvents(classNode, sourceFile);

    // state and options are derived at runtime from Zod schemas
    // via interceptRegistration — no need to extract them at build time
    return {
      id: shortcut,
      description: description || `${className} helper`,
      shortcut,
      methods,
      getters,
      events,
      state: {},
      options: {}
    };
  }

  private extendsHelper(classNode: ts.ClassDeclaration): boolean {
    if (!classNode.heritageClauses) return false;

    for (const clause of classNode.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        for (const type of clause.types) {
          if (type.expression) {
            const typeName = type.expression.getText();
            if (['Helper', 'Feature', 'Client', 'Server'].some(base => typeName.includes(base))) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Container-specific getters to exclude from introspection.
   * These are framework internals (class references, utility objects) not useful in inspection.
   */
  private static CONTAINER_SKIP_GETTERS = new Set([
    'Feature', 'Helper', 'State', 'z', 'features',
  ]);

  private extendsContainer(classNode: ts.ClassDeclaration): boolean {
    const className = classNode.name?.text;
    const containerNames = ['Container', 'NodeContainer', 'WebContainer', 'AGIContainer'];

    // The root Container class itself is a container
    if (className && containerNames.includes(className)) return true;

    if (!classNode.heritageClauses) return false;

    for (const clause of classNode.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        for (const type of clause.types) {
          if (type.expression) {
            const typeName = type.expression.getText();
            if (containerNames.some(base => typeName.includes(base))) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Analyze a Container class and extract introspection data.
   * Container classes don't have a shortcut; they use className as the key.
   */
  private analyzeContainerClass(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): Partial<ContainerIntrospection> | null {
    const className = classNode.name?.text;
    if (!className) return null;

    const description = this.extractJSDocDescription(classNode);
    const methods = this.extractContainerMethods(classNode, sourceFile);
    const getters = this.extractContainerGetters(classNode, sourceFile);
    const events = this.extractEvents(classNode, sourceFile);

    return {
      className,
      description: description || `${className} container`,
      methods,
      getters,
      events,
    };
  }

  private extractContainerMethods(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): Record<string, MethodIntrospection> {
    const methods: Record<string, MethodIntrospection> = {};

    for (const member of classNode.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        const methodName = member.name.getText();

        // Skip private methods unless includePrivate is true
        const isPrivate = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword);
        if (isPrivate && !this.options.includePrivate) continue;

        // Skip static methods
        const isStatic = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
        if (isStatic) continue;

        // Skip methods starting with _ (internal methods like _hide)
        if (methodName.startsWith('_')) continue;

        const description = this.extractJSDocDescription(member) || '';
        const parameters = this.extractParameters(member);
        const required = this.extractRequiredParameters(member);
        const returns = this.extractReturnType(member);

        methods[methodName] = {
          description,
          parameters,
          required,
          returns
        };
      }
    }

    return methods;
  }

  private extractContainerGetters(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): Record<string, GetterIntrospection> {
    const getters: Record<string, GetterIntrospection> = {};

    for (const member of classNode.members) {
      if (ts.isGetAccessorDeclaration(member) && member.name) {
        const getterName = member.name.getText();

        // Skip container framework getters
        if (IntrospectionScannerFeature.CONTAINER_SKIP_GETTERS.has(getterName)) continue;

        // Skip private getters unless includePrivate is true
        const isPrivate = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword);
        if (isPrivate && !this.options.includePrivate) continue;

        // Skip static getters
        const isStatic = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
        if (isStatic) continue;

        const description = this.extractJSDocDescriptionFromAccessor(member) || '';
        const returns = member.type ? member.type.getText() : 'any';

        getters[getterName] = {
          description,
          returns
        };
      }
    }

    return getters;
  }

  private extractShortcut(classNode: ts.ClassDeclaration): string | null {
    // Look for static shortcut property
    for (const member of classNode.members) {
      if (ts.isPropertyDeclaration(member) && 
          member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword) &&
          member.name?.getText() === 'shortcut') {
        
        if (member.initializer) {
          if (ts.isStringLiteral(member.initializer)) {
            return member.initializer.text;
          } else if (ts.isAsExpression(member.initializer) && ts.isStringLiteral(member.initializer.expression)) {
            return member.initializer.expression.text;
          } else {
            // For cases like "features.fs" as const, extract the string part
            const text = member.initializer.getText();
            const match = text.match(/^"([^"]+)"/);
            if (match && match[1]) {
              return match[1];
            }
          }
        }
      }
    }
    return null;
  }

  private extractJSDocDescription(node: ts.ClassDeclaration | ts.MethodDeclaration): string | null {
    // Use TypeScript's built-in function to get leading comments
    const sourceFile = node.getSourceFile();
    const fullText = sourceFile.getFullText();
    
    // Get the text range for the node including leading trivia (comments)
    const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
    
    if (ranges && ranges.length > 0) {
      // Find the last JSDoc comment (the one immediately before the node)
      for (let i = ranges.length - 1; i >= 0; i--) {
        const range = ranges[i];
        if (!range) continue;
        const commentText = fullText.substring(range.pos, range.end);
        
        // Check if it's a JSDoc comment (starts with /**)
        if (commentText.startsWith('/**')) {
          // Extract the content between /** and */
          const content = commentText.slice(3, -2);
          
          // Clean up by removing * prefixes and extracting main description
          const lines = content.split('\n');
          const cleanLines: string[] = [];
          
          for (const line of lines) {
            const cleaned = line.replace(/^\s*\*\s?/, '').trim();
            if (cleaned && !cleaned.startsWith('@')) {
              cleanLines.push(cleaned);
            } else if (cleaned.startsWith('@')) {
              // Stop at first @tag
              break;
            }
          }
          
          const description = cleanLines.join(' ').trim();
          return description || null;
        }
      }
    }
    
    return null;
  }

  private extractJSDocParamDescriptions(method: ts.MethodDeclaration): {
    params: Record<string, string>,
    subProps: Record<string, Record<string, string>>
  } {
    const params: Record<string, string> = {};
    const subProps: Record<string, Record<string, string>> = {};

    const sourceFile = method.getSourceFile();
    const fullText = sourceFile.getFullText();

    const ranges = ts.getLeadingCommentRanges(fullText, method.getFullStart());

    if (ranges && ranges.length > 0) {
      for (let i = ranges.length - 1; i >= 0; i--) {
        const range = ranges[i];
        if (range) {
          const commentText = fullText.substring(range.pos, range.end);

          if (commentText.startsWith('/**')) {
            const content = commentText.slice(3, -2);

            const lines = content.split('\n');
            for (const line of lines) {
              const cleaned = line.replace(/^\s*\*\s?/, '').trim();

              // Match @param {type} name.subProp or @param {type} [name.subProp=default] - description
              const paramMatch = cleaned.match(/^@param\s+(?:\{[^}]*\}\s+)?\[?([\w.]+)(?:=[^\]]*)?\]?\s*-?\s*(.+)$/);
              if (paramMatch && paramMatch[1] && paramMatch[2]) {
                const fullName = paramMatch[1];
                const description = paramMatch[2].trim();

                if (fullName.includes('.')) {
                  // Sub-property: e.g. options.cached -> { options: { cached: "..." } }
                  const parts = fullName.split('.');
                  const parentName = parts[0]!;
                  const propName = parts.slice(1).join('.');
                  if (!subProps[parentName]) subProps[parentName] = {};
                  subProps[parentName]![propName] = description;
                } else {
                  params[fullName] = description;
                }
              }
            }
            break;
          }
        }
      }
    }

    return { params, subProps };
  }

  private extractMethods(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): Record<string, MethodIntrospection> {
    const methods: Record<string, MethodIntrospection> = {};

    for (const member of classNode.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        const methodName = member.name.getText();
        
        // Skip private methods unless includePrivate is true
        const isPrivate = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword);
        if (isPrivate && !this.options.includePrivate) continue;

        // Skip static methods (like attach)
        const isStatic = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
        if (isStatic) continue;

        const description = this.extractJSDocDescription(member) || '';
        const parameters = this.extractParameters(member);
        const required = this.extractRequiredParameters(member);
        const returns = this.extractReturnType(member);

        methods[methodName] = {
          description,
          parameters,
          required,
          returns
        };
      }
    }

    return methods;
  }

  /**
   * Base class getters that should be excluded from introspection output.
   * These are inherited from Helper/Feature and not specific to individual features.
   */
  private static BASE_GETTERS = new Set([
    'initialState', 'container', 'options', 'context', 'cacheKey', 'isEnabled', 'shortcut'
  ]);

  private extractGetters(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): Record<string, GetterIntrospection> {
    const getters: Record<string, GetterIntrospection> = {};

    for (const member of classNode.members) {
      if (ts.isGetAccessorDeclaration(member) && member.name) {
        const getterName = member.name.getText();

        // Skip base class getters
        if (IntrospectionScannerFeature.BASE_GETTERS.has(getterName)) continue;

        // Skip private getters unless includePrivate is true
        const isPrivate = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword);
        if (isPrivate && !this.options.includePrivate) continue;

        // Skip static getters
        const isStatic = member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
        if (isStatic) continue;

        const description = this.extractJSDocDescriptionFromAccessor(member) || '';
        const returns = member.type ? member.type.getText() : 'any';

        getters[getterName] = {
          description,
          returns
        };
      }
    }

    return getters;
  }

  private extractJSDocDescriptionFromAccessor(node: ts.GetAccessorDeclaration): string | null {
    const sourceFile = node.getSourceFile();
    const fullText = sourceFile.getFullText();

    const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());

    if (ranges && ranges.length > 0) {
      for (let i = ranges.length - 1; i >= 0; i--) {
        const range = ranges[i];
        if (!range) continue;
        const commentText = fullText.substring(range.pos, range.end);

        if (commentText.startsWith('/**')) {
          const content = commentText.slice(3, -2);
          const lines = content.split('\n');
          const cleanLines: string[] = [];

          for (const line of lines) {
            const cleaned = line.replace(/^\s*\*\s?/, '').trim();
            if (cleaned && !cleaned.startsWith('@')) {
              cleanLines.push(cleaned);
            } else if (cleaned.startsWith('@')) {
              break;
            }
          }

          const description = cleanLines.join(' ').trim();
          return description || null;
        }
      }
    }

    return null;
  }

  private static PRIMITIVE_TYPES = new Set([
    'string', 'number', 'boolean', 'any', 'void', 'undefined', 'null',
    'never', 'unknown', 'object', 'bigint', 'symbol',
  ]);

  private extractParameters(method: ts.MethodDeclaration): Record<string, { type: string, description: string, properties?: Record<string, { type: string, description: string }> }> {
    const parameters: Record<string, { type: string, description: string, properties?: Record<string, { type: string, description: string }> }> = {};

    // Extract JSDoc parameter descriptions (including sub-property descriptions)
    const { params: paramDescriptions, subProps } = this.extractJSDocParamDescriptions(method);
    const sourceFile = method.getSourceFile();

    for (const param of method.parameters) {
      const paramName = param.name.getText();
      const type = param.type ? param.type.getText() : 'any';

      // Use JSDoc description if available, otherwise fallback to generic description
      const description = paramDescriptions[paramName] || `Parameter ${paramName}`;

      const entry: { type: string, description: string, properties?: Record<string, { type: string, description: string }> } = { type, description };

      // Resolve non-primitive types to their member properties
      const baseType = type.replace(/\[\]$/, '').replace(/\s*\|.*$/, '').trim();
      if (!IntrospectionScannerFeature.PRIMITIVE_TYPES.has(baseType)) {
        const properties = this.resolveTypeProperties(baseType, sourceFile);
        if (properties) {
          entry.properties = properties;
        }
      }

      // Merge JSDoc sub-property descriptions (e.g. @param {boolean} [options.cached] - ...)
      // into the resolved type properties
      const jsdocSubProps = subProps[paramName];
      if (jsdocSubProps) {
        if (!entry.properties) entry.properties = {};
        for (const [propName, propDesc] of Object.entries(jsdocSubProps)) {
          if (entry.properties[propName]) {
            // Enrich existing property with JSDoc description if it was empty
            if (!entry.properties[propName].description) {
              entry.properties[propName].description = propDesc;
            }
          } else {
            entry.properties[propName] = { type: 'any', description: propDesc };
          }
        }
      }

      parameters[paramName] = entry;
    }

    return parameters;
  }

  /**
   * Resolves a type name to its member properties by searching the source file
   * for type alias or interface declarations.
   */
  private resolveTypeProperties(typeName: string, sourceFile: ts.SourceFile): Record<string, { type: string, description: string }> | null {
    for (const statement of sourceFile.statements) {
      // Handle: type Foo = { ... }
      if (ts.isTypeAliasDeclaration(statement) && statement.name.text === typeName) {
        if (ts.isTypeLiteralNode(statement.type)) {
          return this.extractTypeLiteralMembers(statement.type, sourceFile);
        }
      }
      // Handle: interface Foo { ... }
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === typeName) {
        return this.extractInterfaceMembers(statement, sourceFile);
      }
    }
    return null;
  }

  private extractTypeLiteralMembers(node: ts.TypeLiteralNode, sourceFile: ts.SourceFile): Record<string, { type: string, description: string }> {
    const members: Record<string, { type: string, description: string }> = {};

    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name) {
        const name = member.name.getText();
        const type = member.type ? member.type.getText() : 'any';
        const description = this.extractJSDocFromNode(member, sourceFile) || '';
        members[name] = { type, description };
      }
    }

    return Object.keys(members).length > 0 ? members : null as any;
  }

  private extractInterfaceMembers(node: ts.InterfaceDeclaration, sourceFile: ts.SourceFile): Record<string, { type: string, description: string }> {
    const members: Record<string, { type: string, description: string }> = {};

    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name) {
        const name = member.name.getText();
        const type = member.type ? member.type.getText() : 'any';
        const description = this.extractJSDocFromNode(member, sourceFile) || '';
        members[name] = { type, description };
      }
    }

    return Object.keys(members).length > 0 ? members : null as any;
  }

  /**
   * Extracts a JSDoc description from any node that may have leading comments.
   */
  private extractJSDocFromNode(node: ts.Node, sourceFile: ts.SourceFile): string | null {
    const fullText = sourceFile.getFullText();
    const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());

    if (ranges && ranges.length > 0) {
      for (let i = ranges.length - 1; i >= 0; i--) {
        const range = ranges[i];
        if (!range) continue;
        const commentText = fullText.substring(range.pos, range.end);

        if (commentText.startsWith('/**')) {
          const content = commentText.slice(3, -2);
          const lines = content.split('\n');
          const cleanLines: string[] = [];

          for (const line of lines) {
            const cleaned = line.replace(/^\s*\*\s?/, '').trim();
            if (cleaned && !cleaned.startsWith('@')) {
              cleanLines.push(cleaned);
            } else if (cleaned.startsWith('@')) {
              break;
            }
          }

          return cleanLines.join(' ').trim() || null;
        }

        // Handle single-line // comments
        if (commentText.startsWith('//')) {
          return commentText.replace(/^\/\/\s*/, '').trim() || null;
        }
      }
    }

    return null;
  }

  private extractRequiredParameters(method: ts.MethodDeclaration): string[] {
    return method.parameters
      .filter(param => !param.questionToken && !param.initializer)
      .map(param => param.name.getText());
  }

  private extractReturnType(method: ts.MethodDeclaration): string {
    if (method.type) {
      return method.type.getText();
    }
    return 'void';
  }

  private extractEvents(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): Record<string, EventIntrospection> {
    const events: Record<string, EventIntrospection> = {};

    // Look for this.emit() calls in methods
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && 
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          node.expression.name.text === 'emit') {
        
        if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
          const eventName = node.arguments[0].text;
          
          if (!events[eventName]) {
            events[eventName] = {
              name: eventName,
              description: `Event emitted by ${classNode.name?.text || 'class'}`,
              arguments: {}
            };
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    for (const member of classNode.members) {
      if (ts.isMethodDeclaration(member)) {
        visit(member);
      }
    }

    return events;
  }

  private createRegistryScript(results: HelperIntrospection[], containerResults: Partial<ContainerIntrospection>[] = []): string {
    const hasContainers = containerResults.length > 0;

    let imports = `import { setBuildTimeData`;
    if (hasContainers) {
      imports += `, setContainerBuildTimeData`;
    }
    imports += ` } from './index.js';\n\n`;

    const registrations = results.map(result => {
      const data = JSON.stringify(result, null, 2);
      return `setBuildTimeData('${result.id}', ${data});`;
    }).join('\n\n');

    let containerRegistrations = '';
    if (hasContainers) {
      containerRegistrations = '\n\n// Container introspection data\n' + containerResults.map(result => {
        const data = JSON.stringify(result, null, 2);
        return `setContainerBuildTimeData('${result.className}', ${data});`;
      }).join('\n\n');
    }

    const exportStatement = `\nexport const introspectionData = ${JSON.stringify(results, null, 2)};\n`;
    const containerExport = hasContainers ? `\nexport const containerIntrospectionData = ${JSON.stringify(containerResults, null, 2)};\n` : '';

    return `${imports}// Auto-generated introspection registry data\n// Generated at: ${new Date().toISOString()}\n\n${registrations}${containerRegistrations}${exportStatement}${containerExport}`;
  }
}

// Register the feature
import { features } from '../feature.js';

declare module '../feature.js' {
  interface AvailableFeatures {
    introspectionScanner: typeof IntrospectionScannerFeature;
  }
}

export default features.register('introspectionScanner', IntrospectionScannerFeature);
