#!/usr/bin/env node
/**
 * Разовый бэкфилл структурных ролей точек на проде (#1802).
 *
 * Поле `quest_steps.point_role` появилось позже самих квестов: старые строки
 * получили `required` по умолчанию и никогда не пересчитывались. На 05.09.2026
 * это 318 точек в 164 квестах — привалы и кофейни, подписанные игроку
 * «Обязательная точка», и последние точки маршрута без пометки финала.
 *
 * Правило классификации общее со сканом-гвардией и живёт в
 * `scripts/lib/questPointRoles.js`.
 *
 * ЧТО МЕНЯЕТСЯ ДЛЯ ИГРОКА, кроме подписи. `utils/questCountModel.ts` считает
 * знаменатель прохождения по точкам с ролью `required`, а гейт финала — по
 * `required` + `final`. После бэкфилла точка «по желанию» перестаёт держать
 * зачёт: сегодня непройденная кофейня не даёт закрыть гейт финала, хотя квест
 * обещал, что идти туда необязательно. Контроль перед выкатом: ни у одного из
 * 183 квестов число `required` не падает до нуля (минимум 3), то есть зачёт
 * нигде не становится недостижимым.
 *
 *   node scripts/backfill-quest-point-roles.js                    # dry-run, отчёт
 *   node scripts/backfill-quest-point-roles.js --apply            # PATCH на прод
 *   node scripts/backfill-quest-point-roles.js --quest-id=<slug> --apply
 *
 * Токен: --token=, env METRAVEL_TOKEN, .secrets/metravel-token.json, ~/.metravel_token.
 * PATCH идемпотентен: повторный прогон по уже исправленному квесту не найдёт
 * расхождений и не сделает ни одного запроса.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const { fetchQuestBundles, parseSteps } = require('./lib/questBundles')
const { findRoleMismatches, endsWithOptional } = require('./lib/questPointRoles')

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const get = (key, fallback) => {
  const found = args.find((arg) => arg.startsWith(`--${key}=`))
  return found ? found.split('=').slice(1).join('=') : fallback
}

const API_BASE = get('api-url', process.env.METRAVEL_API_URL || 'https://metravel.by')
const QUEST_ID = get('quest-id')

function resolveToken() {
  const fromArg = get('token')
  if (fromArg) return fromArg
  if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN
  const secret = path.resolve(__dirname, '..', '.secrets', 'metravel-token.json')
  if (fs.existsSync(secret)) return JSON.parse(fs.readFileSync(secret, 'utf8')).token
  const home = path.join(os.homedir(), '.metravel_token')
  if (fs.existsSync(home)) return fs.readFileSync(home, 'utf8').trim()
  return null
}

const TOKEN = resolveToken()
if (apply && !TOKEN) {
  console.error('❌ нет токена, а --apply требует записи на прод')
  process.exit(1)
}

async function patchRole(stepDbId, role) {
  const response = await fetch(`${API_BASE}/api/quest-steps/${stepDbId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
    body: JSON.stringify({ point_role: role }),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }
  return response.json()
}

async function main() {
  const bundles = await fetchQuestBundles(API_BASE, QUEST_ID)

  const planned = []
  const openEnded = []
  for (const bundle of bundles) {
    const steps = parseSteps(bundle)
    planned.push(...findRoleMismatches(bundle, steps))
    if (endsWithOptional(steps)) openEnded.push(bundle.quest_id)
  }

  console.log(`Квестов проверено: ${bundles.length}`)
  console.log(`Точек к правке: ${planned.length}`)
  const byRole = planned.reduce((acc, row) => ({ ...acc, [row.want]: (acc[row.want] || 0) + 1 }), {})
  console.log(`Разбивка: ${JSON.stringify(byRole)}`)
  if (openEnded.length > 0) {
    console.log(`Квестов, заканчивающихся точкой «по желанию» (финал не ставим): ${openEnded.length}`)
  }

  if (!apply) {
    for (const row of planned.slice(0, 20)) {
      console.log(`  [DRY] ${row.questId} | ${row.stepId} | ${row.have} → ${row.want} | ${row.title.slice(0, 55)}`)
    }
    if (planned.length > 20) console.log(`  … и ещё ${planned.length - 20}`)
    console.log('\nЗапуск без --apply: на прод ничего не отправлено.')
    return
  }

  let ok = 0
  const failed = []
  for (const row of planned) {
    try {
      await patchRole(row.stepDbId, row.want)
      ok += 1
      if (ok % 25 === 0) console.log(`  … ${ok}/${planned.length}`)
    } catch (error) {
      // Один отказ не должен ронять весь прогон: остальные точки исправимы, а
      // список неудач нужен целиком, чтобы не гадать, что осталось.
      failed.push({ ...row, error: error.message })
    }
  }

  console.log(`\n✅ Исправлено: ${ok}`)
  if (failed.length > 0) {
    console.log(`❌ Не удалось: ${failed.length}`)
    for (const row of failed) {
      console.log(`  ${row.questId} | ${row.stepId} → ${row.want}: ${row.error}`)
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('❌', error.message)
  process.exit(2)
})
