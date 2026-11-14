#!/usr/bin/env node --experimental-strip-types
/**
 * Сводка журнала спроса ассистента (#3296). Запуск: `npm run ai:demand:report -- --days 7`.
 *
 * Читает `logs/ai-demand.jsonl` службы (`AI_DEMAND_LOG`, `--log <файл>`) — записи спроса, ходов и голосов
 * (`demandLog.ts`) — и печатает раздел в формате `docs/QUEST_DEMAND_LOG.md`: сколько вопросов задано,
 * доля «помогло», места без материала, вопросы с «не помогло» по причинам и кандидаты в набор живых
 * вопросов контура оценки (#3286). `--write` дописывает раздел в `docs/QUEST_DEMAND_LOG.md`.
 *
 * Журнал прода лежит в томе контейнера службы; сюда его копирует оператор. Вопросы — слова посетителей:
 * в отчёте они идут как есть (до 300 знаков), без IP и идентификаторов.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { namedDestinations } from '../../api/aiAssist/topicGate.ts'
import { DEFAULT_DEMAND_LOG_PATH, type DemandEntry, type DemandRecord, type FeedbackReason, type FeedbackVote, type TurnEntry, type TurnStatus, type VoteEntry } from './demandLog.ts'

const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_REPORT_DAYS = 7
export const DEMAND_DOC = 'docs/QUEST_DEMAND_LOG.md'
/** Сколько строк показывает каждый список отчёта. */
const LIST_LIMIT = 30

const isTurn = (record: DemandRecord): record is TurnEntry => 'status' in record && 'turn' in record
const isVote = (record: DemandRecord): record is VoteEntry => 'vote' in record && 'turn' in record
const isDemand = (record: DemandRecord): record is DemandEntry => 'reason' in record && !('turn' in record)

/** Строки журнала → записи; строка не-JSON и запись без даты пропускаются. */
export function parseDemandLog(text: string): DemandRecord[] {
  const records: DemandRecord[] = []
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim()) continue
    try {
      const record = JSON.parse(line) as DemandRecord
      if (record && typeof record === 'object' && Number.isFinite(Date.parse(String(record.ts ?? '')))) records.push(record)
    } catch {
      // Битая строка отчёт не роняет.
    }
  }
  return records
}

export interface RatedTurn {
  q: string
  locale: string
  status: TurnStatus
  source_ids: string[]
  vote: FeedbackVote | null
  reason: FeedbackReason | null
}

export interface DemandReport {
  days: number
  from: string
  to: string
  /** Все вопросы периода: ходы с ответом и записи спроса. */
  questions: number
  answered: number
  byStatus: Record<string, number>
  byLocale: Record<string, number>
  /** Записи спроса по причине: `no_sources`, `generator_unavailable`, `offtopic_blocked`. */
  unanswered: Record<string, number>
  votes: { up: number; down: number; share: number | null; coverage: number | null }
  /** Места из вопросов без материала: записи `no_sources` и ходы `partial_no_material`. */
  placesWithoutMaterial: Array<{ place: string; count: number; questions: string[] }>
  /** Вопросы без материала, в которых место не названо. */
  topicsWithoutMaterial: string[]
  notHelped: Record<FeedbackReason | 'none', RatedTurn[]>
  /** Кандидаты в набор живых вопросов (#3286): «не помогло», запасной ответ и частичный ответ. */
  candidates: Array<{ q: string; locale: string; why: string }>
}

const foldPlace = (value: string): string => value.trim().toLowerCase().replace(/ё/g, 'е')

/** Сводка записей журнала за последние `days` дней от `now`. */
export function buildDemandReport(records: readonly DemandRecord[], options: { now?: Date; days?: number } = {}): DemandReport {
  const now = options.now ?? new Date()
  const days = Math.max(1, Math.round(options.days ?? DEFAULT_REPORT_DAYS))
  const since = now.getTime() - days * DAY_MS
  const within = records.filter((record) => {
    const ts = Date.parse(record.ts)
    return ts >= since && ts <= now.getTime()
  })
  const turns = within.filter(isTurn)
  const demands = within.filter(isDemand)
  // Голос уточняется второй записью с причиной: у хода остаётся последняя.
  const voteOf = new Map<string, VoteEntry>()
  for (const vote of within.filter(isVote)) voteOf.set(vote.turn, vote)
  const rated: RatedTurn[] = turns.map((turn) => {
    const vote = voteOf.get(turn.turn)
    return { q: turn.q, locale: turn.locale, status: turn.status, source_ids: turn.source_ids ?? [], vote: vote?.vote ?? null, reason: vote?.reason ?? null }
  })
  const count = (values: readonly string[]): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const value of values) out[value] = (out[value] ?? 0) + 1
    return out
  }
  const up = rated.filter((turn) => turn.vote === 'up').length
  const down = rated.filter((turn) => turn.vote === 'down').length

  const withoutMaterial = [...demands.filter((entry) => entry.reason === 'no_sources').map((entry) => entry.q), ...turns.filter((turn) => turn.status === 'partial_no_material').map((turn) => turn.q)]
  const places = new Map<string, { place: string; count: number; questions: string[] }>()
  const topics: string[] = []
  for (const question of withoutMaterial) {
    const named = [...new Set(namedDestinations(question))]
    if (!named.length) {
      if (!topics.includes(question)) topics.push(question)
      continue
    }
    for (const place of named) {
      const entry = places.get(foldPlace(place)) ?? { place, count: 0, questions: [] }
      entry.count += 1
      if (!entry.questions.includes(question)) entry.questions.push(question)
      places.set(foldPlace(place), entry)
    }
  }

  const notHelped: DemandReport['notHelped'] = { place: [], facts: [], no_answer: [], none: [] }
  for (const turn of rated) if (turn.vote === 'down') notHelped[turn.reason ?? 'none'].push(turn)

  const candidates: DemandReport['candidates'] = []
  const seen = new Set<string>()
  const candidate = (q: string, locale: string, why: string) => {
    const key = `${locale}\u0000${q}`
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({ q, locale, why })
  }
  for (const turn of rated) {
    if (turn.vote === 'down') candidate(turn.q, turn.locale, `не помогло${turn.reason ? `: ${turn.reason}` : ''}`)
    else if (turn.status === 'fallback') candidate(turn.q, turn.locale, 'запасной ответ стража')
    else if (turn.status === 'partial_no_material') candidate(turn.q, turn.locale, 'отдельного материала нет')
  }

  return {
    days,
    from: new Date(since).toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
    questions: turns.length + demands.length,
    answered: turns.length,
    byStatus: count(turns.map((turn) => turn.status)),
    byLocale: count([...turns.map((turn) => turn.locale), ...demands.map((entry) => entry.locale)].map((locale) => locale || '—')),
    unanswered: count(demands.map((entry) => entry.reason)),
    votes: { up, down, share: up + down ? up / (up + down) : null, coverage: turns.length ? (up + down) / turns.length : null },
    placesWithoutMaterial: [...places.values()].sort((a, b) => b.count - a.count || a.place.localeCompare(b.place)),
    topicsWithoutMaterial: topics,
    notHelped,
    candidates,
  }
}

const percent = (share: number | null): string => (share === null ? '—' : `${Math.round(share * 100)} %`)
const pairs = (record: Record<string, number>): string =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key} — ${value}`)
    .join(', ') || '—'
const quote = (text: string): string => `«${text.replace(/\s+/g, ' ').trim()}»`

const REASON_RU: Record<FeedbackReason | 'none', string> = { place: 'не то место', facts: 'неверные сведения', no_answer: 'нет ответа на вопрос', none: 'причина не названа' }

/** Раздел для `docs/QUEST_DEMAND_LOG.md`. */
export function renderDemandReport(report: DemandReport): string {
  const lines: string[] = []
  lines.push(`## ${report.to} — сводка вопросов ассистента за ${report.days} дн. (${report.from} — ${report.to})`, '')
  lines.push('**Вопросы**')
  lines.push(`- Всего: ${report.questions}; с ответом: ${report.answered} (${pairs(report.byStatus)}); без ответа: ${pairs(report.unanswered)}.`)
  lines.push(`- По языкам: ${pairs(report.byLocale)}.`)
  lines.push(`- Оценки: «помогло» ${report.votes.up}, «не помогло» ${report.votes.down}; доля «помогло» — ${percent(report.votes.share)}; оценено ответов — ${percent(report.votes.coverage)}.`, '')

  lines.push('**Места без материала**')
  if (!report.placesWithoutMaterial.length && !report.topicsWithoutMaterial.length) lines.push('- Нет.')
  for (const item of report.placesWithoutMaterial.slice(0, LIST_LIMIT)) lines.push(`- ${item.place} — ${item.count}: ${item.questions.slice(0, 3).map(quote).join('; ')}`)
  if (report.topicsWithoutMaterial.length) {
    lines.push('- Без названного места:')
    for (const question of report.topicsWithoutMaterial.slice(0, LIST_LIMIT)) lines.push(`  - ${quote(question)}`)
  }
  lines.push('')

  lines.push('**«Не помогло» по причинам**')
  const reasons = (Object.keys(report.notHelped) as Array<FeedbackReason | 'none'>).filter((reason) => report.notHelped[reason].length)
  if (!reasons.length) lines.push('- Нет.')
  for (const reason of reasons) {
    lines.push(`- ${REASON_RU[reason]} — ${report.notHelped[reason].length}:`)
    for (const turn of report.notHelped[reason].slice(0, LIST_LIMIT)) {
      lines.push(`  - [${turn.locale || '—'}] ${quote(turn.q)} — статус ${turn.status}; карточки: ${turn.source_ids.join(', ') || '—'}`)
    }
  }
  lines.push('')

  lines.push('**Кандидаты в набор живых вопросов (#3286)**')
  if (!report.candidates.length) lines.push('- Нет.')
  for (const item of report.candidates.slice(0, LIST_LIMIT)) lines.push(`- [${item.locale || '—'}] ${quote(item.q)} — ${item.why}`)
  lines.push('')
  return lines.join('\n')
}

export function parseReportArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): { days: number; log: string; write: boolean } {
  const args = { days: DEFAULT_REPORT_DAYS, log: env.AI_DEMAND_LOG || DEFAULT_DEMAND_LOG_PATH, write: false }
  for (let index = 0; index < argv.length; index += 1) {
    const [flag, inline] = argv[index].split('=', 2)
    const value = () => {
      const next = inline ?? argv[++index]
      if (next === undefined || next.startsWith('--')) throw new Error(`нет значения у ${flag}`)
      return next
    }
    if (flag === '--days') {
      const days = Number(value())
      if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('--days: целое от 1 до 366')
      args.days = days
    } else if (flag === '--log') args.log = value()
    else if (flag === '--write') args.write = true
    else throw new Error(`неизвестный флаг ${flag}`)
  }
  return args
}

export function main(argv: readonly string[], options: { now?: Date; cwd?: string; out?: (text: string) => void } = {}): void {
  const args = parseReportArgs(argv)
  const cwd = options.cwd ?? process.cwd()
  const file = path.resolve(cwd, args.log)
  if (!fs.existsSync(file)) throw new Error(`журнал спроса не найден: ${file} (--log <файл> или AI_DEMAND_LOG)`)
  const section = renderDemandReport(buildDemandReport(parseDemandLog(fs.readFileSync(file, 'utf8')), { now: options.now, days: args.days }))
  ;(options.out ?? ((text: string) => process.stdout.write(text)))(`${section}\n`)
  if (args.write) {
    const doc = path.resolve(cwd, DEMAND_DOC)
    const current = fs.readFileSync(doc, 'utf8')
    fs.writeFileSync(doc, `${current.replace(/\n*$/, '\n')}\n---\n\n${section}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
