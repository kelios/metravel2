/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(__dirname, '../..');
const adapterPath = '@/utils/travelPublicationStatus';
const legacyFields = new Set(['publish', 'moderation']);
const statusReaders = [
  ['utils/travelFormUtils.ts', 'resolveTravelPublicationStatus'],
  ['utils/travelFormNormalization.ts', 'resolveTravelPublicationStatus'],
  ['components/travel/useTravelPublishModeration.ts', 'resolveTravelPublicationStatus'],
  ['hooks/useTravelWizard.ts', 'resolveTravelPublicationStatus'],
  ['hooks/useTravelFormPersistence.ts', 'requireTravelPublicationStatus'],
  ['api/misc.ts', 'buildTravelPublicationWrite'],
  ['components/travel/upsert/useUpsertTravelController.ts', 'resolveTravelPublicationStatus'],
] as const;
const guardedPaths = [
  ...statusReaders.map(([file]) => file),
  'components/travel/TravelWizardStepPublish.tsx',
];
const readAdapters = new Set(['utils/travelFormUtils.ts', 'utils/travelFormNormalization.ts']);

function parse(source: string, file = 'contract.tsx'): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function visitAll(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node);
  ts.forEachChild(node, (child) => visitAll(child, visitor));
}

function propertyName(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return undefined;
}

function legacyField(node: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return legacyFields.has(node.name.text) ? node.name.text : undefined;
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const key = propertyName(node.argumentExpression);
    return key && legacyFields.has(key) ? key : undefined;
  }
  return undefined;
}

function publicationViolations(source: string, file: string): string[] {
  const tree = parse(source, file);
  const aliases = new Set<string>();
  visitAll(tree, (node) => {
    if (!ts.isBindingElement(node) || !ts.isObjectBindingPattern(node.parent)) return;
    const field = propertyName(node.propertyName ?? node.name);
    if (field && legacyFields.has(field) && ts.isIdentifier(node.name)) aliases.add(node.name.text);
  });
  const hasLegacyRead = (expression: ts.Node): boolean => {
    let found = false;
    visitAll(expression, (node) => {
      if (legacyField(node) || (ts.isIdentifier(node) && aliases.has(node.text))) found = true;
    });
    return found;
  };
  const violations: string[] = [];
  const add = (node: ts.Node, reason: string) => {
    const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
    violations.push(`${file}:${line} ${reason}`);
  };
  visitAll(tree, (node) => {
    const condition = ts.isIfStatement(node) ? node.expression : ts.isConditionalExpression(node) ? node.condition : undefined;
    if (condition && hasLegacyRead(condition)) {
      add(node, 'publication branch derives from legacy flags');
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind !== ts.SyntaxKind.EqualsToken && hasLegacyRead(node)) {
      add(node, 'publication expression derives from legacy flags');
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken && hasLegacyRead(node.operand)) {
      add(node, 'publication boolean derives from a legacy flag');
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Boolean'
      && node.arguments.some(hasLegacyRead)) add(node, 'publication boolean derives from legacy flags');
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && legacyField(node.left)) {
      add(node, 'legacy flag assignment outside the status adapter');
    }
    if (ts.isPropertyAssignment(node)) {
      const field = propertyName(node.name);
      if (!readAdapters.has(file) && field && legacyFields.has(field)) add(node, 'legacy flag object write outside the status adapter');
      if (!readAdapters.has(file) && field === 'publication_status' && ts.isStringLiteralLike(node.initializer)) {
        add(node, 'literal publication transition outside the command adapter');
      }
    }
  });
  return violations;
}

function adapterCalls(tree: ts.SourceFile): Map<ts.CallExpression, string> {
  const imports = new Map<string, string>();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteralLike(node.moduleSpecifier) || node.moduleSpecifier.text !== adapterPath) continue;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements) imports.set(binding.name.text, (binding.propertyName ?? binding.name).text);
  }
  const calls = new Map<ts.CallExpression, string>();
  visitAll(tree, (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length > 0) {
      const imported = imports.get(node.expression.text);
      if (imported) calls.set(node, imported);
    }
  });
  return calls;
}

describe('wizard publication contract governance (#2693)', () => {
  it.each(statusReaders)('%s actually calls the shared %s adapter', (file, requiredCall) => {
    const tree = parse(fs.readFileSync(path.join(root, file), 'utf8'), file);
    expect([...adapterCalls(tree).values()]).toContain(requiredCall);
  });

  it.each(guardedPaths)('%s does not reconstruct status or write legacy commands', (file) => {
    expect(publicationViolations(fs.readFileSync(path.join(root, file), 'utf8'), file)).toEqual([]);
  });

  it('serializes the status-builder result into the real full-save PUT body', () => {
    const tree = parse(fs.readFileSync(path.join(root, 'api/misc.ts'), 'utf8'), 'api/misc.ts');
    const calls = adapterCalls(tree);
    const builderResults = new Set<string>();
    const putBodies: ts.Expression[] = [];
    let saveFunction: ts.ArrowFunction | undefined;
    visitAll(tree, (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'saveFormData'
        && node.initializer && ts.isArrowFunction(node.initializer)) saveFunction = node.initializer;
    });
    if (!saveFunction) throw new Error('The full-save API entrypoint is missing');
    visitAll(saveFunction, (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
        && ts.isCallExpression(node.initializer) && calls.get(node.initializer) === 'buildTravelPublicationWrite') {
        builderResults.add(node.name.text);
      }
      if (!ts.isObjectLiteralExpression(node)) return;
      const method = node.properties.find((property) => ts.isPropertyAssignment(property)
        && propertyName(property.name) === 'method' && ts.isStringLiteralLike(property.initializer) && property.initializer.text === 'PUT');
      if (!method) return;
      const body = node.properties.find((property) => ts.isPropertyAssignment(property) && propertyName(property.name) === 'body');
      if (body && ts.isPropertyAssignment(body)) putBodies.push(body.initializer);
    });
    expect(putBodies.length).toBeGreaterThan(0);
    for (const body of putBodies) {
      expect(ts.isCallExpression(body) && ts.isPropertyAccessExpression(body.expression)
        && body.expression.expression.getText(tree) === 'JSON' && body.expression.name.text === 'stringify'
        && body.arguments.length === 1
        && (ts.isIdentifier(body.arguments[0]) && builderResults.has(body.arguments[0].text)
          || ts.isCallExpression(body.arguments[0]) && calls.get(body.arguments[0]) === 'buildTravelPublicationWrite')).toBe(true);
    }
  });

  it.each([
    'const pending = form.publish && !form.moderation;',
    'const draft = form["moderation"] ? false : !form["publish"];',
    'const { publish: isPublished } = form; const draft = !isPublished;',
    'const payload = { ...form, publish: false, moderation: false };',
    'form.publish = true;',
    'const command = { publication_status: "draft" };',
  ])('detects an actual adapter bypass: %s', (source) => {
    expect(publicationViolations(source, 'api/misc.ts').length).toBeGreaterThan(0);
  });

  it('does not accept an unused adapter import as evidence of wiring', () => {
    const tree = parse(`import { resolveTravelPublicationStatus } from '${adapterPath}'; const state = 'draft';`);
    expect(adapterCalls(tree).size).toBe(0);
  });

  it('allows canonical state conditions, DTO types and comments mentioning legacy flags', () => {
    expect(publicationViolations(`
      type LegacyDto = { publish?: boolean; moderation?: boolean };
      // Previous code: form.publish && !form.moderation
      const status = resolveTravelPublicationStatus(form);
      const pending = status === 'pending_review';
    `, 'hooks/useTravelWizard.ts')).toEqual([]);
  });
});
