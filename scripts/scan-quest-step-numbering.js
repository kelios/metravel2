#!/usr/bin/env node
/**
 * Гвардия нумерации точек квеста (#1804).
 *
 * Номер в кружке карточки — позиция точки в маршруте
 * (`components/quests/QuestWizard.tsx` передаёт `index={currentIndex}`,
 * `questWizardStepCard.tsx` его печатает). Номер в начале заголовка — часть
 * авторского текста, и связи между ними нет никакой. Пока маршрут состоит из
 * одних «квестовых» точек, они совпадают; стоит вставить в середину остановку
 * «по желанию» — и всё, что после неё, расходится на единицу. Ребёнок видит
 * кружок «8» и заголовок «7. Логово базилишка».
 *
 * Скан сравнивает эти два числа. Точки без номера в заголовке пропускаются:
 * привалы и остановки его не имеют по замыслу.
 *
 *   node scripts/scan-quest-step-numbering.js                       # весь прод
 *   node scripts/scan-quest-step-numbering.js --quest-id=warsaw-kids-bazyliszek
 *   node scripts/scan-quest-step-numbering.js --source=scripts/warsaw-kids-quest-data.js
 *   node scripts/scan-quest-step-numbering.js --json
 *
 * Exit code 1, если найдено хотя бы одно расхождение.
 */

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'
/** «7. Логово», «7) Логово» — номер, который игрок читает как номер точки. */
const LEADING_NUMBER = /^\s*(\d+)[.)]/

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const get = (key, fallback) => {
  const found = args.find((arg) => arg.startsWith(`--${key}=`))
  return found ? found.split('=').slice(1).join('=') : fallback
}

/** Расхождения «номер в заголовке ≠ позиция точки» в одном квесте. */
function findNumberingMismatches(bundle, steps) {
  const numbered = steps
    .filter((step) => !step.is_intro)
    .slice()
    .sort((a, b) => Number(a.order) - Number(b.order))

  const rows = []
  numbered.forEach((step, index) => {
    const match = LEADING_NUMBER.exec(String(step.title || ''))
    if (!match) return
    const titleNumber = Number(match[1])
    const position = index + 1
    if (titleNumber !== position) {
      rows.push({
        questId: bundle.quest_id,
        stepId: step.step_id,
        title: String(step.title || ''),
        titleNumber,
        position,
      })
    }
  })
  return rows
}

async function main() {
  const source = get('source')
  const questId = get('quest-id')
  const apiUrl = get('api-url', DEFAULT_API)

  const bundles = source
    ? loadLocalBundles(source, questId)
    : await fetchQuestBundles(apiUrl, questId)

  const mismatches = []
  let numberedTitles = 0
  for (const bundle of bundles) {
    const steps = parseSteps(bundle)
    numberedTitles += steps.filter((step) => !step.is_intro && LEADING_NUMBER.test(String(step.title || ''))).length
    mismatches.push(...findNumberingMismatches(bundle, steps))
  }

  if (asJson) {
    console.log(JSON.stringify({ scanned: bundles.length, numberedTitles, mismatches }, null, 2))
  } else {
    console.log(`Проверено квестов: ${bundles.length}, заголовков с номером: ${numberedTitles}`)
    if (mismatches.length === 0) {
      console.log('✅ Номер в заголовке совпадает с номером точки')
    } else {
      console.log(`❌ Расхождений: ${mismatches.length}`)
      for (const row of mismatches) {
        console.log(`  ${row.questId} | ${row.stepId} | заголовок ${row.titleNumber}, точка ${row.position} | ${row.title.slice(0, 55)}`)
      }
    }
  }

  process.exitCode = mismatches.length > 0 ? 1 : 0
}

module.exports = { findNumberingMismatches, LEADING_NUMBER }

if (require.main === module) {
  main().catch((error) => {
    console.error('❌', error.message)
    process.exit(2)
  })
}
