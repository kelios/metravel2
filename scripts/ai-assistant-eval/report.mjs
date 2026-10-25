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
  lines.push(`# Оценка ассистента /assistant — ${meta.label ?? meta.startedAt}`, '')
  lines.push(`- Модель: \`${meta.model ?? '?'}\` (${meta.modelUrl}); экран: ${meta.baseUrl}/assistant; дерево \`${meta.tree ?? '.'}\`, коммит \`${meta.gitSha ?? '?'}\`.`)
  if (meta.dirty?.length) lines.push(`- Незакоммиченные правки в замере: ${meta.dirty.map((item) => `\`${item.trim()}\``).join(', ')}.`)
  lines.push(`- Начало ${meta.startedAt}, длительность ${meta.durationSec ?? '?'} с; вопросов ${results.length}, ходов ${summary.turns}.`)
  lines.push(`- Судья: ${judges.size ? `${judges.size} вердиктов` : 'не прогнан (задание — judge-task.md)'}.`, '')
  lines.push(`**Итог: ${summary.passed}/${summary.turns} ходов (${pct(summary.passed, summary.turns)}).**`, '')

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
      const cards = turn.observed.modelCall?.cards ?? []
      if (cards.length) {
        lines.push('Карточки подбора:')
        for (const card of cards) lines.push(`- [${card.n}] ${card.type === 'quest' ? 'Квест' : 'Статья'} «${card.title}» — ${card.snippet.slice(0, 160)}`)
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
      if (!item.key || !['pass', 'fail'].includes(item.verdict)) throw new Error('нужны key и verdict pass|fail')
      if (item.layer && !LAYERS.includes(item.layer)) throw new Error(`неизвестный слой ${item.layer}`)
      judges.set(item.key, item)
    } catch (error) {
      errors.push(`строка ${index + 1}: ${error.message}`)
    }
  }
  return { judges, errors }
}
