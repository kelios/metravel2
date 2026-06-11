/**
 * @jest-environment node
 *
 * Автостраж правил native-совместимости (docs/NATIVE_COMPAT_RULES.md).
 * Каждый кейс — реальный краш первого запуска native-приложения (2026-06-11).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIRS = ['app', 'components', 'hooks', 'utils', 'screens', 'context', 'services', 'stores', 'api'];

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walkSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = SRC_DIRS.flatMap((d) => walkSourceFiles(path.join(ROOT, d)));

describe('Native compatibility governance (docs/NATIVE_COMPAT_RULES.md)', () => {
  it('правило 2: каждый expo-* пакет существует в bundledNativeModules SDK и стоит blessed-версии (зомби типа expo-av ловятся здесь)', () => {
    const pkg = require(path.join(ROOT, 'package.json'));
    const blessed = require('expo/bundledNativeModules.json');
    const deps: Record<string, string> = pkg.dependencies ?? {};
    const expoPkgs = Object.keys(deps).filter((d) => d.startsWith('expo-'));

    const zombies = expoPkgs.filter((d) => !blessed[d]);
    const drifted = expoPkgs.filter((d) => blessed[d] && deps[d] !== blessed[d]);

    expect({ zombies, drifted }).toEqual({ zombies: [], drifted: [] });
  });

  it('правило 3: нет прямых .then/.catch/.finally на import(...) — только через Promise.resolve(...)', () => {
    // Ловим `import('x').then(` / `.catch(` / `.finally(` в т.ч. с переносами строк,
    // но не Promise.resolve(import('x')).then(...) — там чейн идёт после `)`.
    const direct = /(?<!Promise\.resolve\(\s{0,8})import\(\s*['"][^'"]+['"]\s*\)\s*[\r\n\s]*\.(then|catch|finally)\(/;
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, 'utf8');
      if (direct.test(text)) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('правило 1: babel применяет react-native-web только для web-платформы', () => {
    const babel = fs.readFileSync(path.join(ROOT, 'babel.config.js'), 'utf8');
    expect(babel).toMatch(/api\.caller\([\s\S]{0,80}?platform/);
    expect(babel).toMatch(/isWeb\s*&&\s*['"]react-native-web['"]/);
    expect(babel).not.toMatch(/!isTest\s*&&\s*['"]react-native-web['"]/);
  });

  it('правило 4: web-роль listitem не передаётся в View без Platform-гейта', () => {
    // Прямой JSX-атрибут role="listitem" валит Android; допустим только
    // условный спред вида Platform.OS === 'web' ? ({ role: 'listitem' }) : {}.
    const directAttr = /\brole=["']listitem["']/;
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      if (/\.web\.(ts|tsx)$/.test(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (directAttr.test(text)) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
