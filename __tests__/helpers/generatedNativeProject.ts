import fs from 'fs';
import path from 'path';

/**
 * `android/` генерирует `expo prebuild`, каталог в `.gitignore`: в git worktree и
 * чистом клоне его нет. Проверки СГЕНЕРИРОВАННОГО проекта там пропускаются с
 * причиной в имени теста, а не краснеют чтением несуществующего файла (#3318).
 * В основном чекауте и перед Android-сборкой каталог есть — проверки идут.
 */
const ROOT = path.resolve(__dirname, '..', '..');

export const hasGeneratedAndroidProject = fs.existsSync(path.join(ROOT, 'android', 'app', 'build.gradle'));

const SKIP_REASON = 'пропуск: android/ не сгенерирован (expo prebuild, .gitignore)';

export function itWithGeneratedAndroid(name: string, fn: jest.ProvidesCallback): void {
  if (hasGeneratedAndroidProject) it(name, fn);
  else it.skip(`${name} [${SKIP_REASON}]`, fn);
}
