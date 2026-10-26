/**
 * Отчёт контура оценки ассистента (#2710): сводка по группам и слоям, список
 * провалов, задание судье-агенту и слияние его вердиктов. Чистые функции над
 * `results.jsonl` — их зовёт `run.mjs` после прогона и `run.mjs --report <папка>`
 * после судьи.
 */

import { LAYERS, LAYER_RU } from './checks.mjs'

export const GROUP_RU = {
  on_topic: 'по теме',
  multi_turn: 'диалог',
  languages: 'языки',
  borderline: 'по теме на грани',
  off_topic: 'не по теме',
  injection: 'попытки сломать',
  escalation: 'эскалация',
}

const pct = (part, total) => (total ? `${Math.round((part / total) * 100)} %` : '—')
const escapeCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()

/** Вердикт хода с учётом судьи: судья может только уронить ход, прошедший автопроверки, или подтвердить провал. */
export const effectivePass = (turn, judge) => {
  if (!turn.eval.pass) return false
  return judge ? judge.verdict !== 'fail' : true
}

export const judgeKey = (caseId, turnIndex) => `${caseId}#${turnIndex}`

/** A supplied fixed-context verdict must actually grade its full contract. */
export function validateQualityJudges(results, judges) {
  const errors = []
  const knownKeys = new Set()
  for (const result of results) for (const [index, turn] of result.turns.entries()) {
    const key = judgeKey(result.id, index)
    knownKeys.add(key)
    const judge = judges.get(key)
    if (!judge) continue // Partial reports remain visibly preliminary.
    if (!['instruction', 'usefulness', 'language'].every((score) => [0, 1, 2].includes(judge[score]))) errors.push(`${key}: нужны все три оценки качества`)
    const conditions = turn.criteria?.conditions
    if (!conditions?.length) continue
    const graded = judge.condition_results
    if (!Array.isArray(graded) || graded.length !== conditions.length || new Set(graded.map((condition) => condition?.id)).size !== conditions.length || graded.some((condition) => !condition || !conditions.some((expected) => expected.id === condition.id) || typeof condition.met !== 'boolean' || typeof condition.note !== 'string' || !condition.note.trim())) {
      errors.push(`${key}: нужны все точные condition id, met:boolean и note`)
    } else if (judge.verdict === 'pass' && graded.some((condition) => !condition.met)) errors.push(`${key}: pass противоречит невыполненному условию`)
  }
  for (const key of judges.keys()) if (!knownKeys.has(key)) errors.push(`${key}: неизвестный ход судьи`)
  return errors
}

export function summarize(results, judges = new Map()) {
  const byGroup = new Map()
  const byLayer = Object.fromEntries(LAYERS.map((layer) => [layer, 0]))
  const byCheck = new Map()
  let turns = 0
  let passed = 0
  for (const result of results) {
    for (const [index, turn] of result.turns.entries()) {
      const judge = judges.get(judgeKey(result.id, index))
      const ok = effectivePass(turn, judge)
      turns += 1
      if (ok) passed += 1
      const group = byGroup.get(result.group) ?? { turns: 0, passed: 0 }
      group.turns += 1
      if (ok) group.passed += 1
      byGroup.set(result.group, group)
      if (!ok) {
        const layer = turn.eval.primaryLayer ?? judge?.layer ?? 'model'
        byLayer[layer] = (byLayer[layer] ?? 0) + 1
      }
      for (const failure of turn.eval.failures) byCheck.set(failure.check, (byCheck.get(failure.check) ?? 0) + 1)
      if (judge?.verdict === 'fail' && turn.eval.pass) byCheck.set('judge_fail', (byCheck.get('judge_fail') ?? 0) + 1)
    }
  }
  return { turns, passed, byGroup, byLayer, byCheck }
}

export function renderReport(meta, results, judges = new Map()) {
  const summary = summarize(results, judges)
  const lines = []
  const fixedContext = meta.mode === 'fixed_context'
  let qualityComplete = false
  lines.push(`# Оценка ассистента ${fixedContext ? 'на фиксированных материалах' : '/assistant'} — ${meta.label ?? meta.startedAt}`, '')
  const target = fixedContext ? 'фиксированные карточки, рабочий промпт и генератор; без поиска и UI' : `экран: ${meta.baseUrl}/assistant`
  lines.push(`- Модель: \`${meta.model ?? '?'}\` (${meta.modelUrl}); ${target}; дерево \`${meta.tree ?? '.'}\`, коммит \`${meta.gitSha ?? '?'}\`.`)
  if (meta.dirty?.length) lines.push(`- Незакоммиченные правки в замере: ${meta.dirty.map((item) => `\`${item.trim()}\``).join(', ')}.`)
  lines.push(`- Начало ${meta.startedAt}, длительность ${meta.durationSec ?? '?'} с; вопросов ${results.length}, ходов ${summary.turns}.`)
  lines.push(`- Судья: ${judges.size ? `${judges.size} вердиктов` : 'не прогнан (задание — judge-task.md)'}.`, '')
  if (fixedContext) {
    lines.push('- Приоритет оценки: 1) следование запросу; 2) полезность и точность; 3) язык и естественность.')
    lines.push('- Автопроверки ищут обязательные факты и ссылки. Смысл, отрицания и естественность требуют отдельного вердикта судьи; эталон не сравнивается посимвольно.', '')
    const judgedTurns = results.flatMap((result) => result.turns.map((_, index) => judges.get(judgeKey(result.id, index)))).filter((judge) => judge && ['instruction', 'usefulness', 'language'].every((key) => [0, 1, 2].includes(judge[key]))).length
    qualityComplete = summary.turns > 0 && judgedTurns === summary.turns
    if (judgedTurns < summary.turns) lines.push(`**Смысловая оценка не завершена: судья проверил ${judgedTurns}/${summary.turns} ходов.**`, '')
    lines.push('## Три оценки качества (судья)', '', '| приоритет | критерий | баллы / максимум | оценено ходов |', '| --- | --- | --- | --- |')
    for (const [index, key, title] of [[1, 'instruction', 'Следование запросу'], [2, 'usefulness', 'Полезность и точность'], [3, 'language', 'Язык и естественность']]) {
      const scores = results.flatMap((result) => result.turns.map((_, turnIndex) => judges.get(judgeKey(result.id, turnIndex))?.[key])).filter((score) => [0, 1, 2].includes(score))
      lines.push(`| ${index} | ${title} | ${scores.length ? `${scores.reduce((sum, value) => sum + value, 0)} / ${scores.length * 2}` : 'ещё не оценено'} | ${scores.length}/${summary.turns} |`)
    }
    lines.push('')
    const judgments = results.flatMap((result) => result.turns.map((turn, index) => ({ automatic: turn.eval.pass, judge: judges.get(judgeKey(result.id, index)) }))).filter((row) => row.judge)
    const semanticPassed = judgments.filter((row) => row.judge.verdict === 'pass').length
    const falseNegatives = judgments.filter((row) => !row.automatic && row.judge.verdict === 'pass').length
    const falsePositives = judgments.filter((row) => row.automatic && row.judge.verdict === 'fail').length
    const automaticPassed = results.flatMap((result) => result.turns).filter((turn) => turn.eval.pass).length
    lines.push(`- Автопроверки: ${automaticPassed}/${summary.turns}; независимая смысловая оценка: ${semanticPassed}/${judgments.length} оценённых ходов.`)
    lines.push(`- Калибровка оценщика против судьи: ложных автопровалов ${falseNegatives}, ложных автопрохождений ${falsePositives}. Разногласия требуют разбора критерия или вердикта, а не автоматической подгонки ответа.`, '')
    const conditions = results.flatMap((result) => result.turns.flatMap((turn, index) => (turn.criteria?.conditions ?? []).map((condition) => ({ key: judgeKey(result.id, index), condition, grade: judges.get(judgeKey(result.id, index))?.condition_results?.find((item) => item.id === condition.id) }))))
    if (conditions.length) {
      lines.push('## Условия запроса (судья)', '', `Выполнено ${conditions.filter((item) => item.grade?.met === true).length}/${conditions.length}; оценено ${conditions.filter((item) => item.grade).length}/${conditions.length}.`, '', '| ход | условие | выполнено | причина |', '| --- | --- | --- | --- |')
      for (const { key, condition, grade } of conditions) lines.push(`| ${escapeCell(key)} | ${escapeCell(`${condition.id}: ${condition.description}`)} | ${grade ? (grade.met ? 'да' : 'нет') : 'не оценено'} | ${escapeCell(grade?.note)} |`)
      lines.push('')
    }
  }
  const totalLabel = !fixedContext ? 'Итог' : qualityComplete ? 'Строгий итог (автопроверки и судья)' : 'Предварительный итог (судья не завершён)'
  lines.push(`**${totalLabel}: ${summary.passed}/${summary.turns} ходов (${pct(summary.passed, summary.turns)}).**`, '')

  lines.push('## По группам', '', '| группа | прошло | доля |', '| --- | --- | --- |')
  for (const [group, value] of summary.byGroup) lines.push(`| ${GROUP_RU[group] ?? group} | ${value.passed}/${value.turns} | ${pct(value.passed, value.turns)} |`)
  lines.push('', '## Провалы по слою (основная причина хода)', '', '| слой | ходов |', '| --- | --- |')
  for (const layer of LAYERS) if (summary.byLayer[layer]) lines.push(`| ${LAYER_RU[layer]} | ${summary.byLayer[layer]} |`)
  lines.push('', '## Провалы по проверке', '', '| проверка | ходов |', '| --- | --- |')
  for (const [check, count] of [...summary.byCheck].sort((a, b) => b[1] - a[1])) lines.push(`| ${check} | ${count} |`)

  lines.push('', '## Ходы', '', '| вопрос | ход | итог | слой | провалы | карточек / ссылок | ответ |', '| --- | --- | --- | --- | --- | --- | --- |')
  for (const result of results) {
    for (const [index, turn] of result.turns.entries()) {
      const judge = judges.get(judgeKey(result.id, index))
      const ok = effectivePass(turn, judge)
      const failures = turn.eval.failures.map((item) => `${item.check}: ${item.detail}`)
      if (judge?.verdict === 'fail') failures.push(`судья: ${judge.note ?? ''}`)
      const layer = ok ? '' : LAYER_RU[turn.eval.primaryLayer ?? judge?.layer ?? 'model']
      const answer = turn.observed.answerText || turn.observed.notice || `(${turn.observed.status ?? 'нет хода'})`
      lines.push(
        `| ${result.id} | ${escapeCell(turn.question).slice(0, 80)} | ${ok ? '✅' : '❌'} | ${layer} | ${escapeCell(failures.join('; ')).slice(0, 300)} | ${turn.eval.metrics.sources ?? 0} / ${turn.eval.metrics.links ?? 0} | ${escapeCell(answer).slice(0, 220)} |`,
      )
    }
  }
  if (fixedContext) {
    lines.push('', '## Запрос, пример хорошего ответа и результат', '', '| пример | запрос | ожидаемый ответ (формулировка свободная) | фактический ответ | авто / судья |', '| --- | --- | --- | --- | --- |')
    for (const result of results) for (const [index, turn] of result.turns.entries()) {
      const verdict = judges.get(judgeKey(result.id, index))?.verdict ?? 'не оценено'
      lines.push(`| ${escapeCell(result.id)} | ${escapeCell(turn.question)} | ${escapeCell(turn.reference_answer)} | ${escapeCell(turn.observed.answerText || turn.observed.modelCall?.error)} | ${turn.eval.pass ? 'pass' : 'fail'} / ${verdict} |`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

/** Задание судье: рубрика (`JUDGE.md`) + по каждому ходу вопрос, карточки и показанный ответ. */
export function renderJudgeTask(rubric, results, outDir) {
  const lines = [rubric.trim(), '', `Папка прогона: \`${outDir}\`. Вердикты — в \`${outDir}/judge.jsonl\`.`, '', '---', '']
  for (const result of results) {
    for (const [index, turn] of result.turns.entries()) {
      lines.push(`### ${judgeKey(result.id, index)} — группа «${GROUP_RU[result.group] ?? result.group}», ожидание \`${turn.expect}\`, язык ${result.lang}`)
      lines.push('', `Вопрос: ${turn.question}`, '')
      if (turn.reference_answer) {
        if (turn.history?.length) lines.push('Предыдущие реплики:', '', '```json', JSON.stringify(turn.history, null, 2), '```', '')
        lines.push('Пример хорошего ответа (другие формулировки допустимы):', '', '```text', turn.reference_answer, '```', '')
        lines.push('Критерии этого примера:', '', '```json', JSON.stringify(turn.criteria, null, 2), '```', '')
        lines.push('Приоритет: следование запросу → полезность и точность → язык и естественность. Добавь поля instruction, usefulness, language: 0 (не выполнено), 1 (частично), 2 (выполнено). Для pass нужны instruction=2, usefulness=2 и language>=1. В note явно укажи вывод по каждой оценке. Присутствие слов не доказывает правильную связь фактов или отсутствие отрицания.', '')
        if (turn.criteria?.conditions?.length) lines.push('Добавь condition_results: массив {"id":"точный id условия","met":true,"note":"доказательство из ответа и карточки"} для каждого условия ровно один раз. Пропущенное или невыполненное условие исключает pass; false требует объяснения.', '')
      }
      const cards = turn.observed.modelCall?.cards ?? []
      if (cards.length) {
        lines.push('Карточки подбора:')
        for (const card of cards) lines.push(`- [${card.n}] ${card.type === 'quest' ? 'Квест' : 'Статья'} «${card.title}» — ${card.url ?? ''}; ${turn.reference_answer ? card.snippet : card.snippet.slice(0, 160)}`)
      } else {
        lines.push(`Карточки подбора: ${turn.observed.sources?.length ? turn.observed.sources.map((source) => `«${source.title}»`).join(', ') : 'нет'}`)
      }
      lines.push('', `Статус хода: ${turn.observed.status ?? 'нет хода'}; автопроверки: ${turn.eval.pass ? 'пройдены' : turn.eval.failures.map((item) => item.check).join(', ')}`)
      lines.push('', 'Показанный ответ:', '', '```text', (turn.observed.answerText || turn.observed.notice || '').trim(), '```', '')
    }
  }
  return lines.join('\n')
}

/** `judge.jsonl` → Map по `id#ход`; битые строки пропускаются с предупреждением. */
export function parseJudgeLines(text) {
  const judges = new Map()
  const errors = []
  for (const [index, line] of String(text ?? '').split('\n').entries()) {
    if (!line.trim()) continue
    try {
      const item = JSON.parse(line)
      if (typeof item.key !== 'string' || !item.key.trim() || !['pass', 'fail'].includes(item.verdict)) throw new Error('нужны key и verdict pass|fail')
      if (judges.has(item.key)) throw new Error(`повтор вердикта ${item.key}`)
      if (item.layer && !LAYERS.includes(item.layer)) throw new Error(`неизвестный слой ${item.layer}`)
      for (const key of ['instruction', 'usefulness', 'language']) if (item[key] !== undefined && ![0, 1, 2].includes(item[key])) throw new Error(`${key}: нужен балл 0, 1 или 2`)
      const qualityScores = ['instruction', 'usefulness', 'language']
      if (qualityScores.some((key) => item[key] !== undefined)) {
        if (!qualityScores.every((key) => item[key] !== undefined)) throw new Error('нужны все три оценки качества')
        if (item.verdict === 'pass' && (item.instruction < 2 || item.usefulness < 2 || item.language < 1)) throw new Error('pass противоречит оценкам качества')
      }
      judges.set(item.key, item)
    } catch (error) {
      errors.push(`строка ${index + 1}: ${error.message}`)
    }
  }
  return { judges, errors }
}
