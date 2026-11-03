'use strict'

// Входы трансформа prod web-сборки, которых нет в собственном ключе кэша
// Metro (#2982). Metro ключует трансформ модуля его путём и содержимым,
// опциями трансформа, файлами трансформера, содержимым babel.config.js и
// transformer-конфигом (postcss, browserslist, minifierConfig, версии
// reanimated/worklets). Всё, что трансформ читает помимо этого, обязано войти
// в `config.cacheVersion`, иначе тёплый кэш выкатит модуль, собранный по
// старому входу. Холодный экспорт (#2013) эту дыру прятал ценой 100–800 с.
//
// EXPO_PUBLIC_* Expo сам сверяет по каждому модулю (VaryingCacheStore,
// `expoCacheVary`), здесь они продублированы целиком: значения на выкате не
// меняются, а проверка Expo отключается одной переменной EXPO_NO_CACHE_VARY.

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const sha256 = () => crypto.createHash('sha256')

const digestEntries = (entries) => {
  const digest = sha256()
  for (const entry of entries) digest.update(JSON.stringify(entry))
  return digest.digest('hex')
}

const readIfExists = (file) => {
  try {
    return fs.readFileSync(file)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

const fileDigest = (projectRoot, relativeFiles) => digestEntries(relativeFiles.map((relative) => {
  const content = readIfExists(path.join(projectRoot, relative))
  return [relative, content ? sha256().update(content).digest('hex') : null]
}))

// Сборочный инструментарий в node_modules: Babel-пресеты и плагины, typescript
// и @babel/parser, которыми читают исходники плагины i18n. Metro хэширует
// только собственные файлы трансформера, а версии пресетов и плагинов — нет.
// Postinstall дописывает node_modules скриптами и patch-package, поэтому его
// команда, скрипты и патчи — тоже часть инструментария.
const getToolchainRevision = (projectRoot) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  const postinstall = pkg.scripts?.postinstall || ''
  const postinstallScripts = [...postinstall.matchAll(/node\s+(?:\.\/)?(scripts\/[\w./-]+\.js)/g)].map((match) => match[1])
  const patchesDir = path.join(projectRoot, 'patches')
  const patches = fs.existsSync(patchesDir)
    ? fs.readdirSync(patchesDir).filter((name) => name.endsWith('.patch')).sort().map((name) => `patches/${name}`)
    : []
  return digestEntries([
    ['node', process.version],
    ['postinstall', postinstall],
    ['files', fileDigest(projectRoot, ['yarn.lock', 'node_modules/.yarn-integrity', ...postinstallScripts, ...patches])],
  ])
}

// Плагин реактивной локали решает, добавить ли `localeRevision` в зависимости
// useMemo/useCallback модуля A, по тому, возвращает ли импортированная из B
// функция локализованное значение. Вывод A зависит от содержимого B, а Metro
// ключует A только его содержимым. В ревизию входит каждый импорт файлов
// ROOTS, разрешившийся в «локализованный» экспорт. Ключ импорта — спецификатор
// (для относительного — ещё каталог импортёра), а не разрешённый путь: тогда
// новый файл `*.web.ts`, перекрывший разрешение, тоже меняет ревизию.
// Импорт обычного хелпера ревизию не трогает, иначе любая правка сбрасывала бы
// весь кэш.
const listSourceFiles = (directory, files = []) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) listSourceFiles(file, files)
    else if (/\.[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(file)
  }
  return files
}

// Полный разбор ~2000 модулей стоит 7–20 с в зависимости от нагрузки машины,
// поэтому решения запоминаются между запусками. Решение плагина — функция
// файловой системы: оно записывается вместе со всеми её наблюдениями
// (существование кандидатов разрешения, содержимое прочитанных файлов) и
// переиспользуется, только если каждое наблюдение повторилось. Отсюда
// точность: новый `*.web.ts` или правка любого прочитанного файла пересчитают
// решение.
const MEMO_VERSION = 1

const fileState = (originalStatSync, originalReadFileSync, file) => {
  try {
    const stat = originalStatSync(file)
    if (stat.isDirectory()) return 'dir'
    return sha256().update(originalReadFileSync(file)).digest('hex')
  } catch {
    return null
  }
}

const createFsObserver = () => {
  const original = { existsSync: fs.existsSync, statSync: fs.statSync, readFileSync: fs.readFileSync }
  const states = new Map()
  const exists = new Map()
  const currentState = (file) => {
    if (!states.has(file)) states.set(file, fileState(original.statSync, original.readFileSync, file))
    return states.get(file)
  }
  const currentExists = (file) => {
    if (!exists.has(file)) exists.set(file, original.existsSync(file))
    return exists.get(file)
  }
  const observe = (callback) => {
    const observations = new Map()
    fs.existsSync = (file, ...rest) => {
      const result = original.existsSync(file, ...rest)
      observations.set(`e\0${file}`, result)
      return result
    }
    fs.statSync = (file, ...rest) => {
      observations.set(`f\0${file}`, currentState(String(file)))
      return original.statSync(file, ...rest)
    }
    fs.readFileSync = (file, ...rest) => {
      observations.set(`f\0${file}`, currentState(String(file)))
      return original.readFileSync(file, ...rest)
    }
    try {
      return { value: callback(), observations: [...observations] }
    } finally {
      Object.assign(fs, original)
    }
  }
  const stillValid = (observations) => observations.every(([key, value]) => {
    const [kind, file] = key.split('\0')
    return kind === 'e' ? currentExists(file) === value : currentState(file) === value
  })
  return { observe, stillValid, currentState }
}

const defaultMemoFile = (projectRoot) => path.join(
  projectRoot, 'node_modules', '.cache', 'metravel-metro-cache-inputs',
  `${sha256().update(fs.realpathSync(projectRoot)).digest('hex').slice(0, 16)}.json`,
)

const readMemo = (file, salt) => {
  try {
    const memo = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (memo.version === MEMO_VERSION && memo.salt === salt) return memo
  } catch {
    // Нет или битый — считаем заново.
  }
  return { imports: {}, facts: {} }
}

const writeMemo = (file, memo) => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(memo))
    fs.renameSync(temporary, file)
  } catch {
    // Память — только ускорение, ревизию она не меняет.
  }
}

const readImports = (parser, source) => {
  let program
  try {
    program = parser.parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] }).program
  } catch {
    // Модуль, который не разбирается, не соберёт и сам Metro.
    return []
  }
  const imports = []
  for (const declaration of program.body) {
    if (declaration.type !== 'ImportDeclaration' || declaration.importKind === 'type') continue
    const names = []
    for (const specifier of declaration.specifiers) {
      if (specifier.importKind === 'type') continue
      const name = specifier.imported?.name || (specifier.type === 'ImportDefaultSpecifier' ? 'default' : null)
      if (name && !/^use[A-Z0-9]/.test(name)) names.push(name)
    }
    if (names.length) imports.push([declaration.source.value, names])
  }
  return imports
}

const getReactiveLocaleRevision = (projectRoot, { platform = 'web', memoFile = defaultMemoFile(projectRoot) } = {}) => {
  const parser = require('@babel/parser')
  const pluginFile = path.join(projectRoot, 'i18n/babel-reactive-locale-plugin.js')
  const plugin = require(pluginFile)
  const pluginRevision = fileDigest(projectRoot, ['i18n/babel-reactive-locale-plugin.js'])
  const salt = digestEntries([pluginRevision, getToolchainRevision(projectRoot), platform])
  const memo = memoFile ? readMemo(memoFile, salt) : { imports: {}, facts: {} }
  const next = { version: MEMO_VERSION, salt, imports: {}, facts: {} }
  const observer = createFsObserver()

  const files = []
  for (const root of [...plugin.ROOTS].sort()) {
    const directory = path.join(projectRoot, root)
    if (fs.existsSync(directory)) listSourceFiles(directory, files)
  }
  const localized = new Set()
  const decide = (dependency, name) => {
    const factKey = `${dependency}\0${name}`
    if (!next.facts[factKey]) {
      const remembered = memo.facts[factKey]
      if (remembered && observer.stillValid(remembered.observations)) {
        next.facts[factKey] = remembered
      } else {
        plugin.resetPresentationExportCache()
        const { value, observations } = observer.observe(() => plugin.localeReturningExport(dependency, name, projectRoot, platform))
        next.facts[factKey] = { result: Boolean(value), observations }
      }
    }
    return next.facts[factKey].result
  }
  for (const file of files) {
    const contentHash = observer.currentState(file)
    const imports = memo.imports[contentHash] || readImports(parser, fs.readFileSync(file, 'utf8'))
    next.imports[contentHash] = imports
    for (const [source, names] of imports) {
      const dependency = plugin.resolveImport(source, file, projectRoot, platform)
      if (!dependency) continue
      const scope = source.startsWith('.') ? path.relative(projectRoot, path.dirname(file)).replace(/\\/g, '/') : ''
      for (const name of names) {
        if (decide(dependency, name)) localized.add(`${scope}\0${source}\0${name}`)
      }
    }
  }
  if (memoFile) writeMemo(memoFile, next)
  return digestEntries([
    ['plugin', pluginRevision],
    ['localized-imports', [...localized].sort()],
  ])
}

// На web babel-preset-expo (expo-inline-manifest-plugin) вшивает публичный
// Expo-конфиг в expo-constants: app.json, app.config.js и всё, что тот читает
// из окружения и scripts/. Хэшируется вычисленный конфиг, а не файлы.
const getExpoPublicConfigRevision = (projectRoot) => {
  if (process.env.APP_MANIFEST) return digestEntries([['APP_MANIFEST', process.env.APP_MANIFEST]])
  const { getConfig } = require('expo/config')
  const { exp } = getConfig(projectRoot, { isPublicConfig: true, skipSDKVersionRequirement: true })
  return digestEntries([['exp', exp]])
}

const getPublicEnvRevision = (env = process.env) => digestEntries(
  Object.keys(env)
    .filter((name) => name.startsWith('EXPO_PUBLIC_') || name === 'NODE_ENV' || name === 'BABEL_ENV')
    .sort()
    .map((name) => [name, env[name]]),
)

// Ассет `foo.png` Metro трансформирует вместе с соседними вариантами
// (Assets.js getAbsoluteAssetRecord): масштабами `foo@2x.png` и платформенным
// `foo.web.png`, который на web заменяет исходный. Новый или изменённый
// вариант меняет вывод модуля, не меняя его содержимого. Обходится весь
// проект, кроме зависимостей и нативных/собранных каталогов: ассет может лежать
// рядом с любым модулем.
const ASSET_VARIANT = /(?:@\d+(?:\.\d+)?x(?:\.(?:web|native|ios|android))?|\.(?:web|native|ios|android))\.(?![cm]?[jt]sx?$|json$|css$)[a-z0-9]+$/i
const SKIPPED_ROOT_DIRECTORIES = new Set(['ios', 'android', 'dist'])

const getScaledAssetsRevision = (projectRoot) => {
  const files = []
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      if (directory === projectRoot && SKIPPED_ROOT_DIRECTORIES.has(entry.name)) continue
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (ASSET_VARIANT.test(entry.name)) files.push(path.relative(projectRoot, file).replace(/\\/g, '/'))
    }
  }
  walk(projectRoot)
  return fileDigest(projectRoot, files.sort())
}

// Порядок фиксирован: тест сверяет, что каждый вход меняет cacheVersion.
const TRANSFORM_CACHE_INPUTS = [
  ['locale-catalog', (projectRoot) => require(path.join(projectRoot, 'i18n/babel-inline-plugin.js')).getCatalogRevision(projectRoot)],
  ['reactive-locale', (projectRoot) => getReactiveLocaleRevision(projectRoot)],
  ['public-env', () => getPublicEnvRevision()],
  ['expo-public-config', (projectRoot) => getExpoPublicConfigRevision(projectRoot)],
  ['toolchain', (projectRoot) => getToolchainRevision(projectRoot)],
  ['scaled-assets', (projectRoot) => getScaledAssetsRevision(projectRoot)],
  ['metro-config', (projectRoot) => fileDigest(projectRoot, ['metro.config.js', 'scripts/lib/metroCacheInputs.js'])],
]

const getTransformCacheRevision = (projectRoot) => TRANSFORM_CACHE_INPUTS
  .map(([name, revision]) => `${name}:${revision(projectRoot)}`)
  .join(':')

module.exports = {
  TRANSFORM_CACHE_INPUTS,
  getExpoPublicConfigRevision,
  getPublicEnvRevision,
  getReactiveLocaleRevision,
  getScaledAssetsRevision,
  getToolchainRevision,
  getTransformCacheRevision,
}
