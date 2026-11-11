/**
 * Таблица приёмки кандидата metravel-llm (#3267): «замер — база — кандидат — порог — пройдено».
 * Чистые функции над сохранёнными прогонами — их зовёт `accept.mjs` после сбора и после судьи.
 *
 * Пороги лежат в `acceptance.thresholds.json`, а не в тексте карточки: таблицу приёмки #2751 три
 * раза собирали руками из шести прогонов. Правила порога:
 *   all                — прошли все ходы;
 *   share_at_least     — доля не ниже `passes`/`of` (порог «9 из 10» на срезе из 44 случаев — 40);
 *   not_below_base     — доля кандидата не ниже доли базы;
 *   each_turn_at_least — каждый ход каждого вопроса прошёл не меньше `passes` повторов;
 *   report_only        — в отчёте без порога.
 * Замер с `judge: true` считается только по ходам с вердиктом судьи; пока судья не оценил нужное
 * число ходов, строка «не оценено», а приёмка — неполная.
 */

import { effectivePass, judgeAgreement, judgeKey } from './report.mjs'

export const baseCaseId = (id) => String(id).replace(/@\d+$/, '')
const share = (stats) => (stats.turns ? stats.passed / stats.turns : 0)
const cell = (stats) => `${stats.passed}/${stats.turns}`

/**
 * Сводка по ходам вопросов. `runs` — прогоны `{results, judges}`: контур с `--repeat N` — один прогон
 * с id вида `on01@2`, набор quality — N прогонов. `withJudge` оставляет только ходы с вердиктом.
 */
export function tallyTurns(runs, { withJudge = false, only = null } = {}) {
  const byKey = new Map()
  const stats = { passed: 0, turns: 0, judged: 0, total: 0, withoutModel: 0, byKey }
  for (const { results, judges = new Map() } of runs) {
    for (const result of results) {
      const id = baseCaseId(result.id)
      if (only && !only.has(id)) continue
      for (const [index, turn] of result.turns.entries()) {
        stats.total += 1
        const judge = judges.get(judgeKey(result.id, index))
        if (judge) stats.judged += 1
        if (withJudge && !judge) continue
        const key = `${id}#${index}`
        const entry = byKey.get(key) ?? { passed: 0, turns: 0 }
        const ok = withJudge ? effectivePass(turn, judge) : turn.eval.pass
        entry.turns += 1
        stats.turns += 1
        if (ok) {
          entry.passed += 1
          stats.passed += 1
          // Ход прошёл, но модель не отвечала (подбор не нашёл карточек, отказ фильтра тем): продуктовый
          // путь верный, о модели такой ход ничего не говорит — в таблице это отдельное число.
          if (!turn.observed?.modelCall) stats.withoutModel += 1
        }
        byKey.set(key, entry)
      }
    }
  }
  return stats
}

/** Срезы `eval.py`: строки `results.jsonl` → `{slice: {base, candidate}}`; `field` — `pass` или `pass_accept`. */
export function tallySlices(rows, field = 'pass') {
  const slices = new Map()
  for (const row of rows) {
    const entry = slices.get(row.slice) ?? { base: { passed: 0, turns: 0 }, candidate: { passed: 0, turns: 0 } }
    for (const [side, key] of [['base', 'base'], ['candidate', 'adapter']]) {
      const value = row[key]?.[field] ?? row[key]?.pass
      entry[side].turns += 1
      if (value) entry[side].passed += 1
    }
    slices.set(row.slice, entry)
  }
  return slices
}

export function evaluateRule(rule, base, candidate, { repeat = 1 } = {}) {
  if (rule.type === 'report_only') return { passed: null, threshold: 'без порога', note: '' }
  if (!candidate.turns) return { passed: 'pending', threshold: '', note: 'замера нет' }
  if (rule.type === 'all') return { passed: candidate.passed === candidate.turns, threshold: '100 %', note: '' }
  if (rule.type === 'share_at_least') {
    const need = Math.ceil((candidate.turns * rule.passes) / rule.of - 1e-9)
    return { passed: candidate.passed >= need, threshold: `≥ ${need}/${candidate.turns} (доля ${rule.passes}/${rule.of})`, note: '' }
  }
  if (rule.type === 'not_below_base') {
    if (!base.turns) return { passed: 'pending', threshold: 'не ниже базы', note: 'замера базы нет' }
    return { passed: share(candidate) + 1e-9 >= share(base), threshold: 'не ниже базы', note: '' }
  }
  if (rule.type === 'each_turn_at_least') {
    const short = [...candidate.byKey].filter(([, entry]) => entry.turns < repeat).map(([key]) => key)
    const failing = [...candidate.byKey].filter(([, entry]) => entry.passed < rule.passes).map(([key, entry]) => `${key} ${entry.passed}/${entry.turns}`)
    const threshold = `каждый ход ≥ ${rule.passes}/${repeat}`
    if (short.length) return { passed: 'pending', threshold, note: `повторов меньше ${repeat}: ${short.join(', ')}` }
    return { passed: failing.length === 0, threshold, note: failing.length ? `ниже порога: ${failing.join(', ')}` : '' }
  }
  throw new Error(`неизвестное правило порога ${rule.type}`)
}

const EMPTY = { passed: 0, turns: 0, judged: 0, total: 0, withoutModel: 0, byKey: new Map() }

/**
 * Таблица приёмки. `artifacts`: `{contour: {base: {run: {results, judges}}, candidate: …},
 * quality: {base: [{results, judges}], candidate: […]}, slices: [строки eval.py] | null}`.
 */
export function buildAcceptance(thresholds, artifacts) {
  const repeat = thresholds.repeat ?? 1
  const rows = []
  const sides = ['base', 'candidate']
  for (const row of thresholds.rows) {
    const out = { id: row.id, title: row.title, base: '—', candidate: '—', threshold: '', passed: null, note: '' }
    const notes = []
    let stats = { base: EMPTY, candidate: EMPTY }
    if (row.kind === 'contour' || row.kind === 'quality') {
      const only = row.only === 'targets' ? new Set(thresholds.targets) : null
      const runsOf = (side) => (row.kind === 'quality' ? artifacts.quality?.[side] ?? [] : [artifacts.contour?.[side]?.[row.run]].filter(Boolean))
      stats = Object.fromEntries(sides.map((side) => [side, tallyTurns(runsOf(side), { withJudge: Boolean(row.judge), only })]))
      for (const side of sides) if (stats[side].turns) out[side] = cell(stats[side])
      if (row.judge) {
        // Судья обязателен: строка считается только когда оценено нужное число повторов у обеих сторон.
        const judgeRepeats = Math.min(row.judgeRepeats ?? repeat, repeat)
        const pending = sides.filter((side) => !stats[side].total || stats[side].judged < Math.ceil((stats[side].total * judgeRepeats) / repeat))
        notes.push(`судья оценил ${sides.map((side) => `${side === 'base' ? 'база' : 'кандидат'} ${stats[side].judged}/${stats[side].total}`).join(', ')}`)
        if (pending.length) {
          rows.push({ ...out, threshold: 'судья обязателен', passed: 'pending', note: `${notes.join('; ')} — не оценено` })
          continue
        }
      } else {
        const silent = stats.candidate.withoutModel
        if (silent) notes.push(`из прошедших ходов кандидата без ответа модели — ${silent}`)
      }
      const contaminated = (thresholds.lineageContaminated?.ids ?? []).filter((id) => [...stats.candidate.byKey.keys()].some((key) => key.startsWith(`${id}#`)))
      if (contaminated.length) notes.push(`вопросы были в обучении линии ${thresholds.lineageContaminated.lineage}: ${contaminated.join(', ')}`)
    } else if (row.kind === 'slice') {
      const slices = artifacts.slices ? tallySlices(artifacts.slices) : new Map()
      const found = slices.get(row.slice)
      if (found) {
        stats = { base: { ...EMPTY, ...found.base }, candidate: { ...EMPTY, ...found.candidate } }
        for (const side of sides) out[side] = cell(stats[side])
        const legacy = tallySlices(artifacts.slices, 'pass_accept').get(row.slice)
        if (legacy && (legacy.base.passed !== found.base.passed || legacy.candidate.passed !== found.candidate.passed)) {
          notes.push(`прежняя метрика (схема и признаки): база ${cell(legacy.base)}, кандидат ${cell(legacy.candidate)}`)
        }
      }
    } else {
      throw new Error(`${row.id}: неизвестный вид замера ${row.kind}`)
    }
    const verdict = evaluateRule(row.rule, stats.base, stats.candidate, { repeat })
    if (verdict.note) notes.push(verdict.note)
    // Порог на малой выборке решается одним ответом — это видно в таблице, а не после решения.
    const cases = row.kind === 'slice' ? stats.candidate.turns : stats.candidate.byKey.size
    if (row.rule.type !== 'report_only' && cases && cases < (thresholds.smallSample ?? 30)) notes.push(`выборка ${cases} < ${thresholds.smallSample ?? 30}: один ответ меняет вердикт`)
    rows.push({ ...out, threshold: verdict.threshold, passed: verdict.passed, note: notes.join('; ') })
  }
  const gated = rows.filter((row) => row.passed !== null)
  const verdict = gated.some((row) => row.passed === 'pending') ? 'incomplete' : gated.every((row) => row.passed === true) ? 'go' : 'no-go'
  const agreement = Object.fromEntries(sides.map((side) => {
    const runs = [...Object.values(artifacts.contour?.[side] ?? {}), ...(artifacts.quality?.[side] ?? [])]
    const total = { turns: 0, judged: 0, bothPass: 0, bothFail: 0, autoPassJudgeFail: [], autoFailJudgePass: [] }
    for (const run of runs) {
      const one = judgeAgreement(run.results, run.judges ?? new Map())
      for (const key of ['turns', 'judged', 'bothPass', 'bothFail']) total[key] += one[key]
      total.autoPassJudgeFail.push(...one.autoPassJudgeFail)
      total.autoFailJudgePass.push(...one.autoFailJudgePass)
    }
    return [side, total]
  }))
  return { rows, verdict, agreement }
}

const VERDICT_RU = {
  go: 'пороги пройдены — замена модели остаётся решением владельца',
  'no-go': 'no-go: не пройден хотя бы один порог, модель продукта не меняется',
  incomplete: 'приёмка неполная: есть замеры без данных или без судьи',
}
const MARK = { true: 'да', false: 'нет', pending: 'не оценено', null: '—' }
const escapeCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()

export function renderAcceptance(meta, acceptance) {
  const lines = [`# Приёмка кандидата metravel-llm — ${meta.startedAt ?? ''}`.trim(), '']
  for (const [side, title] of [['base', 'База'], ['candidate', 'Кандидат']]) {
    const model = meta[side] ?? {}
    lines.push(`- ${title}: \`${model.file ?? model.model ?? '?'}\`${model.sha256 ? `, sha256 \`${model.sha256}\`` : ''} (${model.url ?? '?'}).`)
  }
  lines.push(`- Код: \`${meta.gitSha ?? '?'}\`${meta.dirty?.length ? `, незакоммиченные правки: ${meta.dirty.length} файлов` : ''}; пороги: \`${meta.thresholds ?? '?'}\`${meta.inventoryHash ? `, опись оценочных входов \`${meta.inventoryHash.slice(0, 12)}\`` : ''}.`)
  lines.push(`- Слепые метки судьи: ${meta.blind ? `${Object.entries(meta.blind).map(([label, side]) => `${label} — ${side === 'base' ? 'база' : 'кандидат'}`).join(', ')} (судье не сообщаются)` : 'не назначены'}.`, '')
  lines.push('| замер | база | кандидат | порог | пройдено | примечание |', '| --- | --- | --- | --- | --- | --- |')
  for (const row of acceptance.rows) {
    lines.push(`| ${escapeCell(row.title)} | ${row.base} | ${row.candidate} | ${escapeCell(row.threshold)} | ${MARK[String(row.passed)]} | ${escapeCell(row.note)} |`)
  }
  lines.push('', `**Итог: ${VERDICT_RU[acceptance.verdict]}.**`, '')
  for (const [side, title] of [['base', 'база'], ['candidate', 'кандидат']]) {
    const agreement = acceptance.agreement[side]
    if (!agreement.judged) lines.push(`- Сверка автопроверок с судьёй (${title}): судья не прогнан — смысл ответов не подтверждён.`)
    else {
      const list = (keys) => (keys.length ? ` (${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ', …' : ''})` : '')
      lines.push(`- Сверка автопроверок с судьёй (${title}): оценено ${agreement.judged}/${agreement.turns} ходов; автопроверки пропустили, судья снял — ${agreement.autoPassJudgeFail.length}${list(agreement.autoPassJudgeFail)}; автопроверки сняли, судья принял — ${agreement.autoFailJudgePass.length}${list(agreement.autoFailJudgePass)}.`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

/** Проверка файла порогов: ошибка в нём не должна выясняться после двух часов прогона. */
export function validateThresholds(thresholds) {
  const errors = []
  if (!Number.isInteger(thresholds.repeat) || thresholds.repeat < 1) errors.push('repeat — целое ≥ 1')
  if (!Array.isArray(thresholds.targets) || !thresholds.targets.length) errors.push('targets — непустой список id')
  const ids = new Set()
  for (const row of thresholds.rows ?? []) {
    if (!row.id || ids.has(row.id)) errors.push(`строка ${row.id}: нет id или повтор`)
    ids.add(row.id)
    if (!row.title) errors.push(`${row.id}: нет title`)
    if (!['contour', 'quality', 'slice'].includes(row.kind)) errors.push(`${row.id}: kind — contour, quality или slice`)
    if (row.kind === 'contour' && !thresholds.runs?.[row.run]) errors.push(`${row.id}: прогон ${row.run} не описан в runs`)
    if (row.kind === 'slice' && !row.slice) errors.push(`${row.id}: нет slice`)
    const rule = row.rule ?? {}
    if (!['all', 'share_at_least', 'not_below_base', 'each_turn_at_least', 'report_only'].includes(rule.type)) errors.push(`${row.id}: неизвестное правило ${rule.type}`)
    if (rule.type === 'share_at_least' && !(Number.isInteger(rule.passes) && Number.isInteger(rule.of) && rule.passes > 0 && rule.passes <= rule.of)) errors.push(`${row.id}: share_at_least — passes ≤ of`)
    if (rule.type === 'each_turn_at_least' && !(Number.isInteger(rule.passes) && rule.passes >= 1 && rule.passes <= thresholds.repeat)) errors.push(`${row.id}: each_turn_at_least — passes от 1 до repeat`)
  }
  if (!ids.size) errors.push('rows — непустой список')
  for (const [name, run] of Object.entries(thresholds.runs ?? {})) {
    if (!run.cases) errors.push(`runs.${name}: нет cases`)
    if (run.only !== undefined && run.only !== 'targets') errors.push(`runs.${name}: only — только "targets"`)
  }
  return errors
}
