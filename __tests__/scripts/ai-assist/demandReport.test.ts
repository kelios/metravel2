/**
 * #3296: недельная сводка журнала спроса — `npm run ai:demand:report`.
 */
import fs from 'fs'
import path from 'path'

import { buildDemandReport, main, parseDemandLog, parseReportArgs, renderDemandReport } from '@/scripts/ai-assist/demand-report'

import { makeTempDir } from '../cli-test-utils'

const NOW = new Date('2026-11-14T12:00:00.000Z')
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
const LOG = [
  // Ходы с ответом.
  { ts: at(1), turn: 't1', locale: 'ru', q: 'Какие квесты есть в Гродно?', status: 'done', source_ids: ['quest:7', 'quest:53'], answer_chars: 210, guard: {} },
  { ts: at(1), turn: 't1', vote: 'up' },
  { ts: at(2), turn: 't2', locale: 'ru', q: 'Что посмотреть в Лиде за день?', status: 'done', source_ids: ['travel:604'], answer_chars: 180, guard: { removed_links: 1 } },
  { ts: at(2), turn: 't2', vote: 'down' },
  { ts: at(2), turn: 't2', vote: 'down', reason: 'place' },
  { ts: at(3), turn: 't3', locale: 'pl', q: 'Ile trwa quest po Sandomierzu?', status: 'done', source_ids: ['quest:354'], answer_chars: 90, guard: {} },
  { ts: at(3), turn: 't3', vote: 'down', reason: 'facts' },
  { ts: at(3), turn: 't4', locale: 'be', q: 'Што паглядзець у Тайбэі?', status: 'partial_no_material', source_ids: ['travel:1'], answer_chars: 120, guard: {} },
  { ts: at(4), turn: 't5', locale: 'ru', q: 'Сколько стоит вход в замок в Мире?', status: 'fallback', source_ids: ['quest:13'], answer_chars: 0, guard: { ungrounded_numbers: 1 } },
  { ts: at(4), turn: 't6', locale: 'ru', q: 'Сколько стоит пройти квест?', status: 'help', source_ids: ['help:1'], answer_chars: 95, guard: {} },
  { ts: at(5), turn: 't7', locale: 'ru', q: 'Куда поехать на выходные?', status: 'done', source_ids: ['travel:672'], answer_chars: 200, guard: {} },
  { ts: at(5), turn: 't7', vote: 'down' },
  // Записи спроса.
  { ts: at(1), q: 'Что посмотреть в Исландии зимой?', locale: 'ru', reason: 'no_sources' },
  { ts: at(2), q: 'Есть ли маршруты по Исландии?', locale: 'ru', reason: 'no_sources' },
  { ts: at(2), q: 'Какую кашу взять с собой в поход?', locale: 'ru', reason: 'no_sources' },
  { ts: at(3), q: 'рецепт борща', locale: 'pl', reason: 'offtopic_blocked' },
  { ts: at(6), q: 'Куда поехать на выходные?', locale: 'ru', reason: 'generator_unavailable' },
  // За пределами недели.
  { ts: at(9), turn: 't0', locale: 'ru', q: 'Старый вопрос', status: 'done', source_ids: [], answer_chars: 10, guard: {} },
  { ts: at(9), turn: 't0', vote: 'up' },
  { ts: at(30), q: 'Что посмотреть в Гренландии?', locale: 'ru', reason: 'no_sources' },
]
const text = `${LOG.map((line) => JSON.stringify(line)).join('\n')}\nне json\n{"q":"без даты"}\n\n`

describe('сводка журнала спроса ассистента (#3296)', () => {
  it('журнал читается построчно: битая строка и запись без даты пропускаются', () => {
    expect(parseDemandLog(text)).toHaveLength(LOG.length)
    expect(parseDemandLog('')).toEqual([])
  })

  it('число вопросов, статусы, языки, доля «помогло» — за период', () => {
    const report = buildDemandReport(parseDemandLog(text), { now: NOW, days: 7 })
    expect(report).toMatchObject({ days: 7, from: '2026-11-07', to: '2026-11-14', questions: 12, answered: 7 })
    expect(report.byStatus).toEqual({ done: 4, partial_no_material: 1, fallback: 1, help: 1 })
    expect(report.unanswered).toEqual({ no_sources: 3, offtopic_blocked: 1, generator_unavailable: 1 })
    expect(report.byLocale).toEqual({ ru: 9, pl: 2, be: 1 })
    // Голос с уточнённой причиной — один голос: «помогло» 1, «не помогло» 3.
    expect(report.votes.up).toBe(1)
    expect(report.votes.down).toBe(3)
    expect(report.votes.share).toBeCloseTo(0.25)
    expect(report.votes.coverage).toBeCloseTo(4 / 7)
    // Другой период — другие записи.
    expect(buildDemandReport(parseDemandLog(text), { now: NOW, days: 31 })).toMatchObject({ questions: 14, answered: 8 })
  })

  it('места без материала — из вопросов без подбора и частичных ответов; «не помогло» — по причинам; кандидаты в набор', () => {
    const report = buildDemandReport(parseDemandLog(text), { now: NOW, days: 7 })
    expect(report.placesWithoutMaterial.map((item) => [item.place, item.count])).toEqual([
      ['Исландии', 2],
      ['Тайбэі', 1],
    ])
    expect(report.topicsWithoutMaterial).toEqual(['Какую кашу взять с собой в поход?'])
    expect(report.notHelped.place.map((turn) => turn.q)).toEqual(['Что посмотреть в Лиде за день?'])
    expect(report.notHelped.facts).toEqual([{ q: 'Ile trwa quest po Sandomierzu?', locale: 'pl', status: 'done', source_ids: ['quest:354'], vote: 'down', reason: 'facts' }])
    expect(report.notHelped.none.map((turn) => turn.q)).toEqual(['Куда поехать на выходные?'])
    expect(report.notHelped.no_answer).toEqual([])
    expect(report.candidates).toEqual([
      { q: 'Что посмотреть в Лиде за день?', locale: 'ru', why: 'не помогло: place' },
      { q: 'Ile trwa quest po Sandomierzu?', locale: 'pl', why: 'не помогло: facts' },
      { q: 'Што паглядзець у Тайбэі?', locale: 'be', why: 'отдельного материала нет' },
      { q: 'Сколько стоит вход в замок в Мире?', locale: 'ru', why: 'запасной ответ стража' },
      { q: 'Куда поехать на выходные?', locale: 'ru', why: 'не помогло' },
    ])
  })

  it('раздел для docs/QUEST_DEMAND_LOG.md: заголовок с датой, числа и списки; пустой журнал — «Нет»', () => {
    const section = renderDemandReport(buildDemandReport(parseDemandLog(text), { now: NOW, days: 7 }))
    expect(section).toContain('## 2026-11-14 — сводка вопросов ассистента за 7 дн. (2026-11-07 — 2026-11-14)')
    expect(section).toContain('- Всего: 12; с ответом: 7 (done — 4, fallback — 1, help — 1, partial_no_material — 1); без ответа: no_sources — 3, generator_unavailable — 1, offtopic_blocked — 1.')
    expect(section).toContain('- Оценки: «помогло» 1, «не помогло» 3; доля «помогло» — 25 %; оценено ответов — 57 %.')
    expect(section).toContain('- Исландии — 2: «Что посмотреть в Исландии зимой?»; «Есть ли маршруты по Исландии?»')
    expect(section).toContain('- не то место — 1:\n  - [ru] «Что посмотреть в Лиде за день?» — статус done; карточки: travel:604')
    expect(section).toContain('- [pl] «Ile trwa quest po Sandomierzu?» — не помогло: facts')
    // IP и идентификаторов ходов в отчёте нет.
    expect(section).not.toMatch(/\bt[0-9]\b|turn/)
    const empty = renderDemandReport(buildDemandReport([], { now: NOW, days: 7 }))
    expect(empty).toContain('- Всего: 0; с ответом: 0 (—); без ответа: —.')
    expect(empty.match(/- Нет\./g)).toHaveLength(3)
  })

  it('команда: флаги, отказ без журнала, `--write` дописывает раздел в документ', () => {
    expect(parseReportArgs(['--days', '14', '--log=x.jsonl', '--write'], {})).toEqual({ days: 14, log: 'x.jsonl', write: true })
    expect(parseReportArgs([], { AI_DEMAND_LOG: '/tmp/a.jsonl' })).toEqual({ days: 7, log: '/tmp/a.jsonl', write: false })
    expect(() => parseReportArgs(['--days', '0'], {})).toThrow('--days')
    expect(() => parseReportArgs(['--days'], {})).toThrow('нет значения')
    expect(() => parseReportArgs(['--since', '1'], {})).toThrow('неизвестный флаг')

    const cwd = makeTempDir('ai-demand-report-')
    expect(() => main(['--log', 'нет.jsonl'], { cwd, now: NOW })).toThrow('журнал спроса не найден')
    fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(cwd, 'docs/QUEST_DEMAND_LOG.md'), '# Quest Demand Log\n\nПрежняя запись.\n')
    fs.writeFileSync(path.join(cwd, 'log.jsonl'), text)
    const out: string[] = []
    main(['--log', 'log.jsonl', '--days', '7', '--write'], { cwd, now: NOW, out: (chunk) => out.push(chunk) })
    expect(out.join('')).toContain('сводка вопросов ассистента за 7 дн.')
    const doc = fs.readFileSync(path.join(cwd, 'docs/QUEST_DEMAND_LOG.md'), 'utf8')
    expect(doc.startsWith('# Quest Demand Log\n\nПрежняя запись.\n\n---\n\n## 2026-11-14 — сводка вопросов ассистента')).toBe(true)
  })
})
