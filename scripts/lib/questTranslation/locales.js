'use strict'

/**
 * scripts/lib/questTranslation/locales.js
 * Целевые локали перевода квестов — из `i18n/config.ts`, без собственного списка.
 *
 * Набор языков приложения живёт в одном месте (`LOCALE_REGISTRY`). Конвейер
 * перевода, который держал бы свою копию списка кодов, разошёлся
 * бы с ним в день добавления шестого языка: интерфейс уже предлагает язык, а
 * `quest:translate next` о нём не знает и отчитывается «всё переведено».
 *
 * В проекте нет TS-загрузчика для `scripts/` (см. `questAnswerNormalize.js`),
 * поэтому конфиг транспилируется на лету и исполняется в пустом контексте: он
 * обязан оставаться без импортов на уровне модуля — иначе загрузка упадёт здесь,
 * а не тихо вернёт пустой набор.
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const ts = require('typescript')

const CONFIG_PATH = path.resolve(__dirname, '..', '..', '..', 'i18n', 'config.ts')

let cached = null

function loadLocaleConfig(configPath = CONFIG_PATH) {
  const source = fs.readFileSync(configPath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const moduleShim = { exports: {} }
  vm.runInNewContext(outputText, {
    module: moduleShim,
    exports: moduleShim.exports,
    require: (id) => {
      throw new Error(`i18n/config.ts must not import "${id}" at module scope`)
    },
  })
  const supported = Array.from(moduleShim.exports.SUPPORTED_LOCALES || [])
  const sourceLocale = moduleShim.exports.DEFAULT_LOCALE
  if (!supported.length || typeof sourceLocale !== 'string' || !supported.includes(sourceLocale)) {
    throw new Error('i18n/config.ts: SUPPORTED_LOCALES / DEFAULT_LOCALE не прочитаны')
  }
  return { sourceLocale, supported, targets: supported.filter((code) => code !== sourceLocale) }
}

/** Локаль источника (русский) и целевые локали перевода — в порядке реестра. */
function getQuestContentLocales() {
  if (!cached) cached = loadLocaleConfig()
  return cached
}

module.exports = { CONFIG_PATH, getQuestContentLocales, loadLocaleConfig }
