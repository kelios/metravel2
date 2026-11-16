import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { formatHttpStatus } from '@/api/httpStatus';

describe('formatHttpStatus', () => {
  it.each([500, 502, 503, 504, 599])('keeps only the %i code without a reason phrase', (status) => {
    expect(formatHttpStatus(status, '')).toBe(String(status));
    expect(formatHttpStatus(status, ' \t ')).toBe(String(status));
  });

  it('preserves a supplied reason phrase', () => {
    expect(formatHttpStatus(502, 'Bad Gateway')).toBe('502 Bad Gateway');
  });

  it('prevents English status fallbacks anywhere in the API layer', () => {
    const violations: string[] = [];
    const scan = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          scan(file);
        } else if (/\.[jt]sx?$/.test(file)) {
          const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
          const visit = (node: ts.Node) => {
            if (ts.isBinaryExpression(node) &&
              [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind) &&
              /(?:^|\.)statusText$/.test(node.left.getText(source)) &&
              ts.isStringLiteralLike(node.right) && node.right.text === 'Unknown error') {
              violations.push(path.relative(process.cwd(), file));
            }
            ts.forEachChild(node, visit);
          };
          visit(source);
        }
      }
    };
    scan(path.join(process.cwd(), 'api'));
    expect(violations).toEqual([]);
  });
});
