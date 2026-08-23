/**
 * scripts/lib/scanBaseline.js
 * Общий baseline для аудит-сканов квестов.
 *
 * Механизм появился в #1450 у скана достижимости и в #1488 понадобился скану
 * утечки ответа. Копия разошлась бы ровно там, где это дороже всего: у
 * инструмента, который существует ради ответа «нарушений нет», разъехавшийся
 * baseline означает молча пропущенную находку. Поэтому загрузка, вычитание и
 * запись живут здесь в одном экземпляре, а специфика скана передаётся
 * параметрами: свой путь, своя версия контракта, своя функция ключей.
 */

const fs = require('fs')
const path = require('path')

/** Локальные данные квестов — те же файлы, что уезжают на бэкенд заливкой. */
function localQuestDataFiles(rootDir, pattern) {
  return fs.readdirSync(path.join(rootDir, 'scripts'))
    .filter((name) => pattern.test(name))
    .sort()
    .map((name) => `scripts/${name}`)
}

function loadBaseline(baselinePath, contractVersion) {
  if (!fs.existsSync(baselinePath)) throw new Error(`baseline не найден: ${baselinePath}`)
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  if (baseline.contractVersion !== contractVersion) {
    throw new Error(`неподдерживаемая версия baseline: ${String(baseline.contractVersion)}`)
  }
  return baseline
}

/**
 * Делит находки на новые (за них гейт и падает) и уже записанные в baseline.
 *
 * `keysOf` отдаёт СПИСОК ключей находки, и находка считается известной, только
 * если известен каждый её ключ. У скана с одним значением на находку это тот же
 * единственный ключ, что и раньше. У скана утечки в находке может быть несколько
 * слов-ответов сразу, и склейка их в один ключ ломала бы гейт на частичной
 * правке: убрал автор одно слово из трёх — ключ меняется целиком, и остаток,
 * разобранный и записанный в baseline, приходит как «новая находка».
 */
function splitByBaseline(findings, knownKeys, keysOf) {
  const known = new Set(knownKeys || [])
  const fresh = []
  const seen = []
  for (const finding of findings) {
    const keys = keysOf(finding)
    const isKnown = keys.length > 0 && keys.every((key) => known.has(key))
    ;(isKnown ? seen : fresh).push(finding)
  }
  return { fresh, known: seen }
}

function writeBaseline(baselinePath, { contractVersion, note, known }) {
  fs.writeFileSync(baselinePath, `${JSON.stringify({ contractVersion, note, known }, null, 2)}\n`, 'utf8')
}

module.exports = { localQuestDataFiles, loadBaseline, splitByBaseline, writeBaseline }
