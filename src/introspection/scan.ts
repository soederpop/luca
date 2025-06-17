import { Feature } from '../feature.js';
import type { FeatureState, FeatureOptions } from '../feature.js';
import type { HelperIntrospection, MethodIntrospection, EventIntrospection } from './index.js';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface IntrospectionScannerState extends FeatureState {
  scanResults: HelperIntrospection[];
  lastScanTime: Date | null;
  scannedFiles: string[];
}

export interface IntrospectionScannerOptions extends FeatureOptions {
  src?: string[];
  outputPath?: string;
  includePrivate?: boolean;
}

export class IntrospectionScannerFeature extends Feature<IntrospectionScannerState, IntrospectionScannerOptions> {
  static override shortcut = 'introspectionScanner';
  static override description = 'Scans TypeScript files for Helper classes and generates introspection data using AST analysis';

  override get initialState(): IntrospectionScannerState {
    return {
      ...super.initialState,
      scanResults: [],
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
      const scannedFiles: string[] = [];

      for (const srcDir of this.options.src || []) {
        const files = await this.findTypeScriptFiles(srcDir);
        scannedFiles.push(...files);

        for (const file of files) {
          const introspections = await this.analyzeFile(file);
          results.push(...introspections);
        }
      }

      this.setState({
        scanResults: results,
        lastScanTime: new Date(),
        scannedFiles
      });

      const duration = Date.now() - startTime;
      this.emit('scanCompleted', { 
        results: results.length, 
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
      results = await this.scan();
    }

    const script = this.createRegistryScript(results);
    
    if (this.options.outputPath) {
      await fs.promises.writeFile(this.options.outputPath, script);
      this.emit('scriptGenerated', { path: this.options.outputPath });
    }

    return script;
  }

  private async findTypeScriptFiles(srcDir: string): Promise<string[]> {
    const pattern = path.join(srcDir, '**/*.ts');
    return await glob(pattern, { 
      ignore: ['**/*.d.ts', '**/node_modules/**'] 
    });
  }

  private async analyzeFile(filePath: string): Promise<HelperIntrospection[]> {
    const sourceCode = await fs.promises.readFile(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const results: HelperIntrospection[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) {
        const introspection = this.analyzeClass(node, sourceFile);
        if (introspection) {
          results.push(introspection);
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return results;
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
    const events = this.extractEvents(classNode, sourceFile);
    const state = this.extractStateProperties(classNode, sourceFile);

    return {
      id: shortcut,
      description: description || `${className} helper`,
      shortcut,
      methods,
      events,
      state
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

  private extractJSDocParamDescriptions(method: ts.MethodDeclaration): Record<string, string> {
    const paramDescriptions: Record<string, string> = {};
    
    // Use the same logic as extractJSDocDescription to get the JSDoc comment
    const sourceFile = method.getSourceFile();
    const fullText = sourceFile.getFullText();
    
    // Get the text range for the method including leading trivia (comments)
    const ranges = ts.getLeadingCommentRanges(fullText, method.getFullStart());
    
    if (ranges && ranges.length > 0) {
      // Find the last JSDoc comment (the one immediately before the method)
      for (let i = ranges.length - 1; i >= 0; i--) {
        const range = ranges[i];
        if (range) {
          const commentText = fullText.substring(range.pos, range.end);
          
          // Check if it's a JSDoc comment (starts with /**)
          if (commentText.startsWith('/**')) {
            // Extract the content between /** and */
            const content = commentText.slice(3, -2);
            
            // Look for @param lines
            const lines = content.split('\n');
            for (const line of lines) {
              const cleaned = line.replace(/^\s*\*\s?/, '').trim();
              
              // Match @param {type} paramName - description
              const paramMatch = cleaned.match(/^@param\s+\{[^}]*\}\s+(\w+)\s*-?\s*(.+)$/);
              if (paramMatch && paramMatch[1] && paramMatch[2]) {
                const paramName = paramMatch[1];
                const description = paramMatch[2];
                paramDescriptions[paramName] = description.trim();
              }
            }
            break; // Stop after finding the first JSDoc comment
          }
        }
      }
    }
    
    return paramDescriptions;
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

  private extractParameters(method: ts.MethodDeclaration): Record<string, { type: string, description: string }> {
    const parameters: Record<string, { type: string, description: string }> = {};

    // Extract JSDoc parameter descriptions
    const paramDescriptions = this.extractJSDocParamDescriptions(method);

    for (const param of method.parameters) {
      const paramName = param.name.getText();
      const type = param.type ? param.type.getText() : 'any';
      
      // Use JSDoc description if available, otherwise fallback to generic description
      const description = paramDescriptions[paramName] || `Parameter ${paramName}`;

      parameters[paramName] = { type, description };
    }

    return parameters;
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

  private extractStateProperties(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): Record<string, { type: string, description: string }> {
    const state: Record<string, { type: string, description: string }> = {};

    // Look for state interface references in class generics
    if (classNode.typeParameters) {
      // This is a simplified approach - in a real implementation you'd want to
      // resolve the actual state interface and extract its properties
    }

    return state;
  }

  private createRegistryScript(results: HelperIntrospection[]): string {
    const imports = `import { __INTROSPECTION__ } from './index.js';\n\n`;
    
    const registrations = results.map(result => {
      const data = JSON.stringify(result, null, 2);
      return `__INTROSPECTION__.set('${result.id}', ${data});`;
    }).join('\n\n');

    const exportStatement = `\nexport const introspectionData = ${JSON.stringify(results, null, 2)};\n`;

    return `${imports}// Auto-generated introspection registry data\n// Generated at: ${new Date().toISOString()}\n\n${registrations}${exportStatement}`;
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
