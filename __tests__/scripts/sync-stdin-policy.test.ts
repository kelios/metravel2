import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const { collectFilesRecursive } = require('./policy-test-utils');
const syncNames = new Set(['spawnSync', 'execFileSync', 'execSync']);
const processModules = new Set(['child_process', 'node:child_process']);

function violations(source: string, fileName = 'fixture.js'): number[] {
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const host = ts.createCompilerHost({ noLib: true, noResolve: true });
  host.getSourceFile = (name) => name === fileName ? ast : undefined;
  const program = ts.createProgram([fileName], { noLib: true, noResolve: true, allowJs: true }, host);
  const checker = program.getTypeChecker();
  const declarations = (node: ts.Node) => checker.getSymbolAtLocation(node)?.declarations || [];
  const propertyName = (node: ts.Node | undefined): string => {
    if (!node) return '';
    if (ts.isComputedPropertyName(node)) return propertyName(node.expression);
    return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : '';
  };
  const isProcessModule = (node: ts.Node | undefined): boolean => !!node && ts.isStringLiteral(node) && processModules.has(node.text);
  const isNamespace = (node: ts.Expression, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'require') return isProcessModule(node.arguments[0]);
    return declarations(node).some((decl) =>
      ts.isVariableDeclaration(decl) && !!decl.initializer ? isNamespace(decl.initializer, seen) :
      ts.isNamespaceImport(decl) && isProcessModule((decl.parent.parent as ts.ImportDeclaration).moduleSpecifier) ||
      ts.isImportClause(decl) && isProcessModule((decl.parent as ts.ImportDeclaration).moduleSpecifier));
  };
  const isSync = (node: ts.Expression, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (ts.isPropertyAccessExpression(node)) return syncNames.has(node.name.text) && isNamespace(node.expression);
    if (ts.isElementAccessExpression(node)) return syncNames.has(propertyName(node.argumentExpression)) && isNamespace(node.expression);
    return declarations(node).some((decl) => {
      if (ts.isVariableDeclaration(decl) && decl.initializer) return isSync(decl.initializer, seen);
      if (ts.isBindingElement(decl) && ts.isVariableDeclaration(decl.parent.parent)) {
        const init = decl.parent.parent.initializer;
        return syncNames.has(propertyName(decl.propertyName || decl.name)) && !!init && isNamespace(init);
      }
      return ts.isImportSpecifier(decl) && syncNames.has(propertyName(decl.propertyName || decl.name)) &&
        isProcessModule((decl.parent.parent.parent as ts.ImportDeclaration).moduleSpecifier);
    });
  };
  const hasInput = (node: ts.Expression, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (ts.isObjectLiteralExpression(node)) return node.properties.some((prop) =>
      ts.isSpreadAssignment(prop) ? hasInput(prop.expression, seen) : propertyName(prop.name) === 'input');
    return declarations(node).some((decl) => ts.isVariableDeclaration(decl) && !!decl.initializer && hasInput(decl.initializer, seen));
  };
  const found: number[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isSync(node.expression) && node.arguments.some((arg) => hasInput(arg))) {
      found.push(ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return found;
}

describe('synchronous stdin policy (#2844)', () => {
  it.each([
    'const {spawnSync: run}=require("child_process"); run("node", [], {input:"x"});',
    'const cp=require("node:child_process"); cp["execFileSync"]("node", [], {input});',
    'import {execSync as run} from "node:child_process"; const options={input}; run("node", options);',
    'import * as cp from "child_process"; const run=cp.spawnSync; const base={input}; run("node", [], {...base});',
    'import cp from "node:child_process"; const run=cp.execFileSync; run("node", [], {input});',
  ])('detects pipe input including aliases and shared options: %s', (source) => {
    expect(violations(source)).toHaveLength(1);
  });

  it('ignores comments, strings, async calls, shadowed functions and the file adapter', () => {
    const source = `
      const {spawnSync: run, spawn}=require('child_process');
      // run('node', [], {input});
      const example="run('node', [], {input})";
      function safe(run) { run('node', [], {input}); }
      spawn('node', [], {input});
      run('node', [], {timeout: 200});
      spawnSyncWithStdin('node', [], {input});
    `;
    expect(violations(source)).toEqual([]);
  });

  it('forbids pipe input in direct synchronous child_process calls throughout scripts', () => {
    const files: string[] = collectFilesRecursive(path.resolve(process.cwd(), 'scripts'));
    const found = files.filter((file) => /\.(?:[cm]?js|tsx?)$/.test(file)).flatMap((file) =>
      violations(fs.readFileSync(file, 'utf8'), file).map((line) => `${path.relative(process.cwd(), file)}:${line}`));
    expect(found).toEqual([]);
  });
});
