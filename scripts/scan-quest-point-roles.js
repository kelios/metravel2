#!/usr/bin/env node
/**
 * Гвардия структурных ролей точек квеста (#1802).
 *
 * Ловит два расхождения между тем, что игрок ЧИТАЕТ, и тем, что стоит в
 * `quest_steps.point_role`:
 *   - точка обещает «(по желанию)», а подписана «Обязательная точка»;
 *   - последняя точка маршрута не помечена финалом.
 *
 * Правило классификации — общее с бэкфиллом, живёт в
 * `scripts/lib/questPointRoles.js`: вторая копия однажды разойдётся, и гейт
 * начнёт проверять не то, что чинит скрипт.
 *
 * Два режима проверяют РАЗНОЕ, потому что у входов разная форма (#1810):
 *   - прод: у шага есть `point_role`, сверяем поле с ожидаемой ролью;
 *   - `--source`: у авторского файла роли нет вовсе, её проставит заливщик.
 *     Сверять там пустое поле не с чем — вместо этого ловим необязательность,
 *     выведенную косвенно (иконка привала + свободный ответ) вместо честного
 *     «(по желанию)» в заголовке.
 *
 *   node scripts/scan-quest-point-roles.js                       # весь прод
 *   node scripts/scan-quest-point-roles.js --quest-id=brest-lantern
 *   node scripts/scan-quest-point-roles.js --source=scripts/brest-quest-data.js
 *   node scripts/scan-quest-point-roles.js --json
 *   node scripts/scan-quest-point-roles.js --source=… --baseline=scripts/quest-point-roles-baseline.json
 *   node scripts/scan-quest-point-roles.js --update-baseline
 *
 * Exit code 1, если найдено хотя бы одно расхождение.
 */

const path = require('path')

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const {
  localQuestDataFiles,
  loadBaseline,
  splitByBaseline,
  writeBaseline,
} = require('./lib/scanBaseline')
const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')
const {
  findRoleMismatches,
  findAuthoringRoleIssues,
  endsWithOptional,
} = require('./lib/questPointRoles')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

const BASELINE_PATH = 'scripts/quest-point-roles-baseline.json'
const BASELINE_CONTRACT_VERSION = 1

/** Ключ находки: квест + слаг шага, а не текст заголовка — правка текста не должна её «терять». */
const findingKey = (finding) => `${finding.questId}|${finding.stepId}`

/**
 * Перезапись baseline по всем локальным данным квестов — единственный способ его
 * пополнить. Записанное считается осознанным: точка-привал без «(по желанию)» в
 * заголовке остаётся необязательной по типу ответа, и переписывать чужие
 * авторские заголовки задним числом скрипт не должен.
 */
function updateBaseline(rootDir) {
  const known = {}
  let total = 0
  for (const file of localQuestDataFiles(rootDir, QUEST_DATA_FILE_PATTERN)) {
    const findings = loadLocalBundles(file, null)
      .flatMap((bundle) => findAuthoringRoleIssues(bundle, parseSteps(bundle)))
    if (!findings.length) continue
    known[file] = findings.map(findingKey).sort()
    total += findings.length
  }
  const baselinePath = path.join(rootDir, BASELINE_PATH)
  writeBaseline(baselinePath, {
    contractVersion: BASELINE_CONTRACT_VERSION,
    note: 'Осознанные исключения: точка-привал, необязательность которой держится на типе ответа, '
      + 'а не на словах в заголовке. Такие заголовки написаны до правила, и переписывать их задним '
      + 'числом скрипт не должен. Снимается по файлам данных в РАБОЧЕМ ДЕРЕВЕ, поэтому обновлять '
      + 'надо на дереве без чужих незавершённых правок: иначе чужая точка уедет в файл как '
      + 'принятое исключение и перестанет ронять гейт молча. '
      + 'Обновлять: npm run quest:scan-point-roles:baseline',
    known,
  })
  return { baselinePath, files: Object.keys(known).length, total }
}

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const get = (key, fallback) => {
  const found = args.find((arg) => arg.startsWith(`--${key}=`))
  return found ? found.split('=').slice(1).join('=') : fallback
}

async function main() {
  const source = get('source')
  const questId = get('quest-id')
  const apiUrl = get('api-url', DEFAULT_API)
  const baselineArg = get('baseline')

  if (args.includes('--update-baseline')) {
    const result = updateBaseline(process.cwd())
    console.log(`Baseline перезаписан: ${BASELINE_PATH} — ${result.total} исключений в ${result.files} файлах.`)
    return
  }

  const bundles = source
    ? loadLocalBundles(source, questId)
    : await fetchQuestBundles(apiUrl, questId)

  const isLocalSource = Boolean(source)
  const findIssues = isLocalSource ? findAuthoringRoleIssues : findRoleMismatches

  const found = []
  const openEnded = []
  for (const bundle of bundles) {
    const steps = parseSteps(bundle)
    found.push(...findIssues(bundle, steps))
    if (endsWithOptional(steps)) openEnded.push(bundle.quest_id)
  }

  // Baseline применим только к авторскому режиму: у прод-режима исключений нет,
  // там любое расхождение — незабэкфиленная строка (#1802), а не решение автора.
  const { fresh: mismatches, known: knownFindings } =
    isLocalSource && baselineArg
      ? splitByBaseline(
          found,
          loadBaseline(path.resolve(process.cwd(), baselineArg), BASELINE_CONTRACT_VERSION)
            .known?.[source],
          (finding) => [findingKey(finding)],
        )
      : { fresh: found, known: [] }

  if (asJson) {
    // `knownFindings` печатается наравне с `mismatches` — как у соседних сканов
    // (`scan-quest-compound-spelling-gap`). Без него `--json --baseline` отдаёт
    // пустой список и на чистом файле, и на файле, где всё вычтено baseline'ом:
    // машинный потребитель отличить их не может.
    console.log(JSON.stringify({
      mode: isLocalSource ? 'source' : 'production',
      scanned: bundles.length,
      mismatches,
      knownFindings,
      questsEndingWithOptionalPoint: openEnded,
    }, null, 2))
  } else {
    console.log(`Проверено квестов: ${bundles.length}`)
    if (mismatches.length === 0) {
      console.log(
        isLocalSource
          ? '✅ Необязательные точки названы необязательными в заголовке'
          : '✅ Роли точек совпадают с тем, что обещает заголовок',
      )
    } else {
      console.log(`❌ Расхождений: ${mismatches.length}`)
      for (const row of mismatches) {
        // `order` есть только у прод-бандла: в авторском файле порядок задаёт
        // сам файл, и печатать «NaN» вместо номера нечестно.
        const position = row.order === null || row.order === undefined ? '—' : row.order
        console.log(`  ${row.questId} | order ${position} | ${row.stepId} | ${row.have} → ${row.want} | ${row.title.slice(0, 60)}`)
      }
    }
    if (knownFindings.length > 0) {
      console.log(`Учтено baseline (осознанные исключения): ${knownFindings.length}`)
    }
    if (openEnded.length > 0) {
      // Не нарушение: у такого квеста финальной точки нет по замыслу автора, и
      // выбирать её за него скрипт не должен. Но знать об этом полезно.
      console.log(`\nℹ️  Квесты, заканчивающиеся точкой «по желанию» (финал не проставлен): ${openEnded.join(', ')}`)
    }
  }

  process.exitCode = mismatches.length > 0 ? 1 : 0
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌', error.message)
    process.exit(2)
  })
}

module.exports = { BASELINE_PATH, BASELINE_CONTRACT_VERSION, findingKey }
