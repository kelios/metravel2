import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');

const getTrackedFiles = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);

const isAllowedPlaceholder = (filePath: string): boolean =>
  /(^|\/)\.env(?:\.[^/]+)?\.example$/.test(filePath);

describe('environment file tracking governance', () => {
  it('does not track real env or secret-store files', () => {
    const violations = getTrackedFiles().filter((filePath) => {
      // A working-tree deletion is the expected pre-commit state of a cleanup.
      // If such a file is committed or reintroduced, it exists and fails here.
      if (!fs.existsSync(path.join(repoRoot, filePath))) return false;
      const basename = path.posix.basename(filePath);
      if (filePath.startsWith('.secrets/')) return true;
      return basename.startsWith('.env') && !isAllowedPlaceholder(filePath);
    });

    expect(violations).toEqual([]);
  });

  it('uses deny-by-default ignore rules with explicit placeholder exceptions', () => {
    const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');

    expect(gitignore).toMatch(/^\.env\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
    expect(gitignore).toMatch(/^!\.env\.\*\.example$/m);
    expect(gitignore).toMatch(/^\.secrets\/$/m);
  });
});
