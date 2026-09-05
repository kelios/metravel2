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
 *   node scripts/scan-quest-point-roles.js                       # весь прод
 *   node scripts/scan-quest-point-roles.js --quest-id=brest-lantern
 *   node scripts/scan-quest-point-roles.js --source=scripts/brest-quest-data.js
 *   node scripts/scan-quest-point-roles.js --json
 *
 * Exit code 1, если найдено хотя бы одно расхождение.
 */

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { findRoleMismatches, endsWithOptional } = require('./lib/questPointRoles')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

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

  const bundles = source
    ? loadLocalBundles(source, questId)
    : await fetchQuestBundles(apiUrl, questId)

  const mismatches = []
  const openEnded = []
  for (const bundle of bundles) {
    const steps = parseSteps(bundle)
    mismatches.push(...findRoleMismatches(bundle, steps))
    if (endsWithOptional(steps)) openEnded.push(bundle.quest_id)
  }

  if (asJson) {
    console.log(JSON.stringify({
      scanned: bundles.length,
      mismatches,
      questsEndingWithOptionalPoint: openEnded,
    }, null, 2))
  } else {
    console.log(`Проверено квестов: ${bundles.length}`)
    if (mismatches.length === 0) {
      console.log('✅ Роли точек совпадают с тем, что обещает заголовок')
    } else {
      console.log(`❌ Расхождений: ${mismatches.length}`)
      for (const row of mismatches) {
        console.log(`  ${row.questId} | order ${row.order} | ${row.stepId} | ${row.have} → ${row.want} | ${row.title.slice(0, 60)}`)
      }
    }
    if (openEnded.length > 0) {
      // Не нарушение: у такого квеста финальной точки нет по замыслу автора, и
      // выбирать её за него скрипт не должен. Но знать об этом полезно.
      console.log(`\nℹ️  Квесты, заканчивающиеся точкой «по желанию» (финал не проставлен): ${openEnded.join(', ')}`)
    }
  }

  process.exitCode = mismatches.length > 0 ? 1 : 0
}

main().catch((error) => {
  console.error('❌', error.message)
  process.exit(2)
})
