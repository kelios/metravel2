#!/usr/bin/env node

// #2742: tracked `ios/` воспроизводится из конфига. Скрипт генерирует проект
// `expo prebuild --clean --platform ios --no-install` во временном каталоге и
// сверяет его с рабочим деревом: каждый сгенерированный файл совпадает байт в
// байт, а `project.pbxproj` — с точностью до интеграции CocoaPods (её добавляет
// `pod install`, которого в генерации нет). Расхождение означает ручную правку
// tracked-проекта или правку конфига без перегенерации `ios/`.

const { spawnSync } = require('child_process');
const { spawnSyncWithStdin } = require('./lib/runSyncWithStdin');
const fs = require('fs');
const os = require('os');
const path = require('path');
const xcode = require('xcode');

const ROOT = path.resolve(__dirname, '..');
const PBXPROJ = 'ios/metravel.xcodeproj/project.pbxproj';
// Появляются только после `pod install`.
const POD_INSTALL_FILES = new Set([
  'ios/Podfile.lock',
  'ios/metravel.xcworkspace/contents.xcworkspacedata',
]);
// Объекты, которые CocoaPods и expo-modules-autolinking добавляют при
// `pod install`: фазы `[CP]`/`[Expo]`, xcconfig и библиотека подов,
// ExpoModulesProvider и их группы.
const POD_OBJECT_PATTERN = /Pods|\[CP\]|\[Expo\] Configure project|ExpoModulesProvider/;
// Build settings, которые выставляют `react_native_post_install` и
// expo-modules при `pod install`.
const POD_BUILD_SETTINGS = new Set([
  'LIBRARY_SEARCH_PATHS',
  'OTHER_CFLAGS',
  'OTHER_CPLUSPLUSFLAGS',
  'OTHER_SWIFT_FLAGS',
  'PODFILE_DIR',
  'REACT_NATIVE_PATH',
  'SWIFT_ACTIVE_COMPILATION_CONDITIONS',
  'USE_HERMES',
]);

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}

function isDotenvFile(name) {
  return /^\.env(\.[\w-]+)?$/.test(name) && !name.endsWith('.example');
}

function ignoredFiles(files) {
  const result = spawnSyncWithStdin('git', ['check-ignore', '--stdin'], {
    cwd: ROOT,
    encoding: 'utf8',
    input: files.join('\n'),
    timeout: 20000,
    killSignal: 'SIGKILL',
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git check-ignore failed: ${result.stderr || result.signal}`);
  }
  return new Set(result.stdout.split('\n').filter(Boolean));
}

function trackedIosFiles() {
  const result = spawnSync('git', ['ls-files', 'ios'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.split('\n').filter(Boolean);
}

function generateIosProject(workDir) {
  for (const file of ['app.json', 'app.config.js', 'package.json']) {
    fs.copyFileSync(path.join(ROOT, file), path.join(workDir, file));
  }
  fs.cpSync(path.join(ROOT, 'plugins'), path.join(workDir, 'plugins'), { recursive: true });
  // `app.config.js` подключает Meta SDK по ключам из `.env` и читает
  // `scripts/android-firebase-config.js`.
  const links = ['node_modules', 'assets', 'scripts', ...fs.readdirSync(ROOT).filter(isDotenvFile)];
  for (const link of links) {
    fs.symlinkSync(path.join(ROOT, link), path.join(workDir, link));
  }
  const result = spawnSync(
    'npx',
    ['expo', 'prebuild', '--clean', '--platform', 'ios', '--no-install'],
    {
      cwd: workDir,
      encoding: 'utf8',
      env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    },
  );
  if (result.status !== 0) {
    throw new Error(`expo prebuild failed:\n${result.stdout}\n${result.stderr}`);
  }
}

function parseProject(filePath) {
  const project = xcode.project(filePath);
  project.parseSync();
  return project.hash.project.objects;
}

function objectIds(objects) {
  const ids = new Map();
  for (const [section, entries] of Object.entries(objects)) {
    for (const id of Object.keys(entries)) {
      if (!id.endsWith('_comment')) ids.set(id, section);
    }
  }
  return ids;
}

function describeObject(objects, section, id) {
  const value = objects[section][id];
  return [objects[section][`${id}_comment`], value.name, value.path].filter(Boolean).join(' ');
}

function stripPodSettings(value) {
  const clone = JSON.parse(JSON.stringify(value));
  if (clone.buildSettings) {
    for (const key of POD_BUILD_SETTINGS) delete clone.buildSettings[key];
  }
  return clone;
}

// Убирает из tracked-объекта то, что добавил `pod install`, чтобы сравнить его
// со сгенерированным.
function withoutPodIntegration(value, podIds) {
  const clone = stripPodSettings(value);
  for (const key of ['children', 'files', 'buildPhases']) {
    if (Array.isArray(clone[key])) {
      clone[key] = clone[key].filter((item) => !podIds.has(item.value));
    }
  }
  if (podIds.has(clone.baseConfigurationReference)) {
    delete clone.baseConfigurationReference;
    delete clone.baseConfigurationReference_comment;
  }
  return clone;
}

// CocoaPods пере-сериализует проект: меняет порядок ключей и объектов в
// секциях, но не элементов списков. Порядок в списках значим (очерёдность
// build phases, файлов, регионов) и сравнивается как есть.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
    );
  }
  // Сериализация CocoaPods и библиотеки `xcode` различается кавычками вокруг
  // простых значений и экранированием переводов строк.
  if (typeof value === 'string') {
    const unquoted = /^"[\s\S]*"$/.test(value) ? value.slice(1, -1) : value;
    return unquoted.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  return value;
}

function compareProjects(trackedPath, generatedPath) {
  const problems = [];
  const tracked = parseProject(trackedPath);
  const generated = parseProject(generatedPath);
  const trackedIds = objectIds(tracked);
  const generatedIds = objectIds(generated);

  const podIds = new Set();
  for (const [id, section] of trackedIds) {
    if (generatedIds.has(id)) continue;
    if (POD_OBJECT_PATTERN.test(describeObject(tracked, section, id))) podIds.add(id);
  }
  // Группа ExpoModulesProviders содержит подгруппу с именем таргета.
  for (const [id, section] of trackedIds) {
    if (generatedIds.has(id) || podIds.has(id) || section !== 'PBXGroup') continue;
    const children = tracked.PBXGroup[id].children || [];
    if (children.length > 0 && children.every((child) => podIds.has(child.value))) podIds.add(id);
  }

  for (const [id, section] of trackedIds) {
    if (!generatedIds.has(id) && !podIds.has(id)) {
      problems.push(`${PBXPROJ}: object ${id} (${describeObject(tracked, section, id)}) is not generated by prebuild`);
    }
  }
  for (const [id, section] of generatedIds) {
    if (!trackedIds.has(id)) {
      problems.push(`${PBXPROJ}: generated object ${id} (${describeObject(generated, section, id)}) is missing`);
      continue;
    }
    // Фазы `[CP]` шаблон резервирует пустыми, их содержимое пишет CocoaPods.
    if (POD_OBJECT_PATTERN.test(describeObject(generated, section, id))) continue;
    const expected = canonical(stripPodSettings(generated[section][id]));
    const actual = canonical(withoutPodIntegration(tracked[trackedIds.get(id)][id], podIds));
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      problems.push(
        `${PBXPROJ}: object ${id} (${describeObject(generated, section, id)}) differs from prebuild output`,
      );
    }
  }
  return problems;
}

function checkIosParity() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-ios-parity-'));
  try {
    generateIosProject(workDir);
    const generatedRoot = path.join(workDir, 'ios');
    const generatedFiles = listFiles(generatedRoot).map((file) => path.join('ios', file));
    // Игнорируемое `ios/.gitignore` (project.xcworkspace и т.п.) не сверяется.
    const ignored = ignoredFiles(generatedFiles);
    const generated = new Set(generatedFiles.filter((file) => !ignored.has(file)));
    const tracked = new Set(trackedIosFiles());
    const problems = [];

    for (const file of tracked) {
      if (!generated.has(file) && !POD_INSTALL_FILES.has(file)) {
        problems.push(`${file}: tracked but not generated by prebuild`);
      }
    }
    for (const file of generated) {
      if (!tracked.has(file)) {
        problems.push(`${file}: generated by prebuild but not tracked`);
      } else if (file === PBXPROJ) {
        problems.push(...compareProjects(path.join(ROOT, file), path.join(workDir, file)));
      } else if (!fs.readFileSync(path.join(ROOT, file)).equals(fs.readFileSync(path.join(workDir, file)))) {
        problems.push(`${file}: differs from prebuild output`);
      }
    }
    return problems;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const problems = checkIosParity();
  if (problems.length > 0) {
    console.error('iOS native project is not reproducible from config (#2742):');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('Regenerate: npx expo prebuild --clean --platform ios && (cd ios && pod install)');
    process.exit(1);
  }
  console.log('iOS native project matches expo prebuild output.');
}

module.exports = { checkIosParity, compareProjects, ignoredFiles };
