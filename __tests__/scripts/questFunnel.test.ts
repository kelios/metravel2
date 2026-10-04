// #2061: серверная воронка квестов по прод-базе.
//
// Скрипт ходит в прод по ssh, поэтому тестируется всё, что до и после ssh:
// окно отчёта, SQL, удалённый скрипт и расчёт отчёта по ответу базы. Главные
// риски — тихо посчитать не то окно (--days и --since вместе, дата до чистой
// телеметрии), подставить в SQL непроверенный ввод и напечатать «воронку» из
// пустого или частичного ответа базы.
import { GUEST_QUEST_FREE_STEPS } from '@/utils/guestQuestProgress'

const { UsageError } = require('@/scripts/lib/cli-contract')
const {
  EXCLUDED_USER_IDS,
  GUEST_FREE_STEPS,
  PROBE_CLUSTER_WINDOW_MINUTES,
  PROBE_MAX_ELAPSED_MS,
  TELEMETRY_CLEAN_SINCE,
  buildFunnelSql,
  buildRemoteScript,
  buildReport,
  classifyPairs,
  formatReport,
  parseArgs,
  resolveWindow,
} = require('@/scripts/quest-funnel')

const NOW = new Date('2026-09-23T10:00:00Z')

// Строка `pairs` из ответа базы. По умолчанию — живой гость: ответил через
// 45 с, пара длится минуту.
const T0 = Date.parse('2026-08-24T10:00:00Z') / 1000
const pair = (overrides: Record<string, unknown> = {}) => ({
  quest_id: 1,
  slug: 'vitebsk-kids-skazki',
  n_points: 4,
  in_window: true,
  first_epoch: T0,
  week: '2026-08-24',
  auth: 'guest',
  platform: 'web',
  attempts: 1,
  accepted: 1,
  rejected: 0,
  max_elapsed_ms: 45000,
  duration_s: 60,
  tainted: false,
  ...overrides,
})

// Пара пробы по подписи #2182: гость в браузере, ответ за секунду, без ошибок.
const probe = (questId: number, offsetS: number, overrides: Record<string, unknown> = {}) =>
  pair({
    quest_id: questId,
    slug: `probe-quest-${questId}`,
    first_epoch: T0 + offsetS,
    max_elapsed_ms: 1040,
    duration_s: 0,
    ...overrides,
  })

// Форма ответа базы для buildReport, а не эталон воронки: шесть живых пар
// разной глубины на двух квестах.
const PROD_LIKE = {
  quest_found: true,
  pairs: [
    pair({ accepted: 0, attempts: 2, rejected: 2 }),
    pair({ accepted: 1, attempts: 1 }),
    pair({ platform: 'android', accepted: 2, attempts: 3 }),
    pair({ week: '2026-08-31', auth: 'guest_login', accepted: 4, attempts: 6 }),
    pair({ week: '2026-08-31', auth: 'user', platform: 'ios', accepted: 3, attempts: 4 }),
    pair({ week: '2026-08-31', auth: 'user', quest_id: 2, slug: 'brest-fortress', n_points: 5 }),
  ],
  weekly_completed: [
    { week: '2026-08-31', completed: 5 },
    { week: '2026-09-21', completed: 1 },
  ],
  completed_by_quest: [{ quest_id: 1, completed: 1 }],
  progress: {
    started: 33,
    players: 16,
    started_completed: 17,
    completed: 17,
    completed_early: 3,
    completed_fast: 7,
  },
}

describe('parseArgs', () => {
  it('отказывает на неизвестном флаге и нечисловом --days', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(UsageError)
    expect(() => parseArgs(['--days', 'abc'])).toThrow(UsageError)
    expect(() => parseArgs(['--days', '0'])).toThrow(UsageError)
  })

  it('читает окно, квест и --json', () => {
    const args = parseArgs(['--since', '2026-08-24', '--quest', 'vitebsk-kids-skazki', '--json'])
    expect(args.since).toBe('2026-08-24')
    expect(args.quest).toBe('vitebsk-kids-skazki')
    expect(args.json).toBe(true)
  })
})

describe('resolveWindow', () => {
  it('по умолчанию — 30 дней до сегодня', () => {
    expect(resolveWindow({}, NOW)).toEqual({
      since: '2026-08-24',
      requestedSince: '2026-08-24',
      clamped: false,
      quest: null,
    })
  })

  it('понимает непереданные флаги так, как их отдаёт разбор CLI', () => {
    expect(resolveWindow(parseArgs([]), NOW).since).toBe('2026-08-24')
    expect(resolveWindow(parseArgs(['--days', '7']), NOW).since).toBe('2026-09-16')
    expect(resolveWindow(parseArgs(['--since', '2026-09-01']), NOW).since).toBe('2026-09-01')
    expect(resolveWindow(parseArgs(['--quest', 'mir-castle']), NOW).quest).toBe('mir-castle')
    expect(() => resolveWindow(parseArgs(['--days', '7', '--since', '2026-09-01']), NOW)).toThrow(
      UsageError,
    )
  })

  it('не пускает окно раньше чистой телеметрии и говорит об этом', () => {
    const window = resolveWindow({ since: '2026-08-01' }, NOW)
    expect(window.since).toBe(TELEMETRY_CLEAN_SINCE)
    expect(window.requestedSince).toBe('2026-08-01')
    expect(window.clamped).toBe(true)
  })

  it('отказывает, когда окно задано дважды или дата несуществующая', () => {
    expect(() => resolveWindow({ days: 7, since: '2026-09-01' }, NOW)).toThrow(UsageError)
    expect(() => resolveWindow({ since: '2026-02-30' }, NOW)).toThrow(UsageError)
    expect(() => resolveWindow({ since: '24.08.2026' }, NOW)).toThrow(UsageError)
  })

  it('невозможный месяц/день и гигантский --days — UsageError, а не RangeError', () => {
    for (const since of ['2026-13-01', '2026-01-32', '2026-00-10', '2026-24-08']) {
      expect(() => resolveWindow({ since }, NOW)).toThrow(UsageError)
    }
    expect(() => resolveWindow({ days: 200000000 }, NOW)).toThrow(UsageError)
    expect(() => resolveWindow(parseArgs(['--since', '2026-13-01']), NOW)).toThrow(UsageError)
  })

  it('не пропускает в SQL quest_id с кавычкой или пробелом', () => {
    expect(() => resolveWindow({ quest: "x'; DROP TABLE users; --" }, NOW)).toThrow(UsageError)
    expect(() => resolveWindow({ quest: 'Minsk Cipher' }, NOW)).toThrow(UsageError)
  })
})

describe('buildFunnelSql', () => {
  it('фильтрует окно и исключает staff и служебный вход', () => {
    const sql = buildFunnelSql({ since: '2026-08-24' })
    expect(sql).toContain("DATE '2026-08-24'")
    expect(sql).toContain('is_staff OR is_superuser')
    expect(sql).toContain(`id IN (${EXCLUDED_USER_IDS.join(', ')})`)
    expect(sql).not.toContain('WHERE quest_id =')
  })

  it('считает прогресс по точкам клиента: обязательные при явных ролях, иначе все кроме intro', () => {
    const sql = buildFunnelSql({ since: '2026-08-24' })
    // utils/questCountModel.ts: роли явные, только если КАЖДАЯ пронумерованная
    // точка required/optional/final; NULL-роль обязана давать fallback, а не
    // выпадать из bool_and.
    expect(sql).toContain("coalesce(point_role IN ('required', 'optional', 'final'), false)")
    expect(sql).toContain("NOT m.explicit_roles OR st.point_role = 'required'")
    expect(sql).toContain("lower(trim(step_id)) = 'intro'")
    // Принятый ответ матчится с точкой по строковому ключу, не по FK SET_NULL.
    expect(sql).toContain('ps.step_id = a.step_key')
    expect(sql).not.toContain('s.id = a.step_id')
  })

  it('заражённые ключи ищет по всей таблице, а соседей серии берёт и до окна', () => {
    const sql = buildFunnelSql({ since: '2026-09-23', quest: 'krakow-dragon' })
    const tainted = sql.slice(sql.indexOf('tainted_keys AS ('), sql.indexOf('scope AS ('))
    expect(tainted).toContain('WHERE user_id IN (SELECT id FROM excluded)')
    // Ни окна, ни --quest: ключ служебного устройства заражён на всех квестах.
    expect(tainted).not.toContain('DATE ')
    expect(tainted).not.toContain('scope')
    expect(sql).toContain('p.session_key IN (SELECT session_key FROM tainted_keys) AS tainted')
    expect(sql).toContain(`DATE '2026-09-23' - interval '${PROBE_CLUSTER_WINDOW_MINUTES} minutes'`)
    expect(sql).toContain("p.first_at >= DATE '2026-09-23' AS in_window")
  })

  it('сужает отчёт до одного квеста', () => {
    expect(buildFunnelSql({ since: '2026-08-24', quest: 'vitebsk-kids-skazki' })).toContain(
      "WHERE quest_id = 'vitebsk-kids-skazki'",
    )
  })

  it('сам отказывает небезопасному вводу, даже если его пропустили раньше', () => {
    expect(() => buildFunnelSql({ since: "2026-08-24'; --" })).toThrow()
    expect(() => buildFunnelSql({ since: '2026-08-24', quest: "a'b" })).toThrow()
  })
})

describe('buildRemoteScript', () => {
  it('переводит сессию в READ ONLY и отдаёт SQL psql через свой heredoc', () => {
    const script = buildRemoteScript('SELECT 1;')
    expect(script).toContain('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;')
    expect(script).toContain('metravel_resolve_container metravel-gis')
    expect(script).toContain('-v ON_ERROR_STOP=1')
    expect(script.indexOf('READ ONLY')).toBeLessThan(script.indexOf('SELECT 1;'))
  })

  it('отказывает SQL, который закрыл бы heredoc раньше времени', () => {
    expect(() => buildRemoteScript('SELECT 1;\nMETRAVEL_QUEST_FUNNEL_SQL\nrm -rf /')).toThrow()
  })
})

describe('buildReport', () => {
  const window = resolveWindow({ since: '2026-08-24' }, NOW)

  it('собирает воронку, сегменты и гостевой гейт', () => {
    const report = buildReport(PROD_LIKE, window)
    expect(report.stages.all).toEqual({
      answered: 6,
      point1: 5,
      p25: 4,
      p50: 3,
      p75: 2,
      allPoints: 1,
      singleAttempt: 2,
    })
    expect(report.stages.byAuth.guest_login.allPoints).toBe(1)
    expect(report.stages.byAuth.user.p75).toBe(1)
    expect(report.stages.byPlatform.ios.answered).toBe(1)
    expect(report.stages.byPlatform.web.answered).toBe(4)
    expect(report.guestGate).toEqual({
      freeSteps: 2,
      guestStarts: 4,
      noAccepted: 1,
      leftBeforeGate: 1,
      leftAtGate: 1,
      loggedIn: 1,
      reachedGate: 2,
    })
    expect(report.excludedProbes).toEqual({ probeSeries: 0, taintedSession: 0, total: 0 })
    expect(report.progress).toMatchObject({ started: 33, startedCompleted: 17, completedFast: 7 })
  })

  it('сводит недели ответов и засчитываний в одну строку на неделю', () => {
    const report = buildReport(PROD_LIKE, window)
    expect(report.weekly).toEqual([
      { week: '2026-08-24', answered: 3, point1: 2, allPoints: 0, completed: 0 },
      { week: '2026-08-31', answered: 3, point1: 3, allPoints: 1, completed: 5 },
      { week: '2026-09-21', answered: 0, point1: 0, allPoints: 0, completed: 1 },
    ])
  })

  it('квесты по числу пар с засчитанными из quest_progress', () => {
    expect(buildReport(PROD_LIKE, window).topQuests).toEqual([
      { slug: 'vitebsk-kids-skazki', points: 4, answered: 5, point1: 4, allPoints: 1, completed: 1 },
      { slug: 'brest-fortress', points: 5, answered: 1, point1: 1, allPoints: 0, completed: 0 },
    ])
  })

  it('пустое окно — нули, а не падение и не «undefined» в отчёте', () => {
    const report = buildReport(
      { quest_found: true, pairs: [], weekly_completed: [], completed_by_quest: [], progress: null },
      window,
    )
    expect(report.stages.all.answered).toBe(0)
    expect(report.stages.byAuth.guest.point1).toBe(0)
    expect(report.guestGate.reachedGate).toBe(0)
    const text = formatReport(report)
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('NaN')
    expect(text).toContain('за окно ни одного ответа')
  })

  it('предупреждает, что старты до 06.09.2026 завышены открытиями экрана', () => {
    const early = buildReport(PROD_LIKE, resolveWindow({ since: '2026-08-24' }, NOW))
    expect(early.window.progressStartsReliable).toBe(false)
    expect(formatReport(early)).toContain('«начато» завышено')
    const late = buildReport(PROD_LIKE, resolveWindow({ since: '2026-09-06' }, NOW))
    expect(late.window.progressStartsReliable).toBe(true)
    expect(formatReport(late)).not.toContain('«начато» завышено')
  })
})

describe('formatReport', () => {
  it('печатает конверсию шага от предыдущего и гейт', () => {
    const text = formatReport(buildReport(PROD_LIKE, resolveWindow({ since: '2026-08-24' }, NOW)))
    expect(text).toContain('с 2026-08-24, все квесты')
    expect(text).toMatch(/1-я точка\s+5\s+83%/)
    expect(text).toContain('у гейта вошли 1 (50%), ушли 1')
    expect(text).toContain('vitebsk-kids-skazki')
    expect(text).toContain('исключено автоматических проб: 0')
  })
})

// #2182: наши приёмочные прогоны на проде пишут ответы гостем. Исключаем их
// серией, а живого игрока — даже быстрого и одинокого — оставляем.
describe('classifyPairs — пробы и служебные устройства', () => {
  const window = resolveWindow({ since: '2026-08-24' }, NOW)

  // Серия luxembourg-melusina 04.10 с прода: 11 новых сессий за 5 минут,
  // ответ за 1,6–2,2 с, пара живёт до 1,6 с.
  const LUXEMBOURG_SERIES = [0, 16, 35, 78, 91, 105, 135, 151, 223, 271, 292].map((offset, index) =>
    probe(7, offset, { max_elapsed_ms: 1606 + index * 50, duration_s: index % 2 ? 1.6 : 0 }),
  )

  it('серия проб одного квеста исключается целиком и печатается отдельной строкой', () => {
    const report = buildReport({ ...PROD_LIKE, pairs: [...PROD_LIKE.pairs, ...LUXEMBOURG_SERIES] }, window)
    expect(report.excludedProbes).toEqual({ probeSeries: 11, taintedSession: 0, total: 11 })
    expect(report.stages.all.answered).toBe(6)
    // Гостевой гейт и разбивки считаются по очищенным парам.
    expect(report.guestGate.guestStarts).toBe(4)
    expect(report.weekly.find((week: { week: string }) => week.week === '2026-08-24').answered).toBe(3)
    expect(report.topQuests.map((quest: { slug: string }) => quest.slug)).not.toContain('probe-quest-7')
    expect(formatReport(report)).toContain(
      'исключено автоматических проб: 11 (серии гостевых web-проб 11, сессии устройств служебных аккаунтов 0)',
    )
  })

  it('одиночная быстрая пара живого гостя остаётся: решает серия, а не скорость', () => {
    const { players, excluded } = classifyPairs([probe(7, 0)])
    expect(players).toHaveLength(1)
    expect(excluded.total).toBe(0)
  })

  it('две быстрые пары и третья за пределами окна — не серия', () => {
    const beyond = PROBE_CLUSTER_WINDOW_MINUTES * 60 + 1
    const { players, excluded } = classifyPairs([probe(7, 0), probe(7, 60), probe(7, beyond)])
    expect(players).toHaveLength(3)
    expect(excluded.probeSeries).toBe(0)
  })

  it('пары разных квестов в одно время серию не складывают', () => {
    const { players } = classifyPairs([probe(7, 0), probe(8, 10), probe(9, 20)])
    expect(players).toHaveLength(3)
  })

  it('пара с неверным ответом, долгая пара, медленный ответ и не-web остаются даже внутри серии', () => {
    const live = [
      probe(7, 30, { rejected: 2, attempts: 3 }),
      probe(7, 40, { duration_s: 955 }),
      probe(7, 50, { max_elapsed_ms: PROBE_MAX_ELAPSED_MS }),
      probe(7, 55, { max_elapsed_ms: null }),
      probe(7, 60, { platform: 'android' }),
      probe(7, 70, { auth: 'guest_login' }),
    ]
    const { players, excluded } = classifyPairs([probe(7, 0), probe(7, 10), probe(7, 20), ...live])
    expect(excluded.probeSeries).toBe(3)
    expect(players).toHaveLength(live.length)
  })

  it('живые пары с прода 23.09–24.09 рядом с серией проб остаются', () => {
    const live = [
      // vitebsk-teens-street-art-map: один верный ответ за 23 с и ушёл.
      pair({ quest_id: 3, slug: 'vitebsk-teens-street-art-map', max_elapsed_ms: 22796, duration_s: 0 }),
      // yelnya-bog-bells: два верных ответа, 20 и 67 с.
      pair({ quest_id: 4, slug: 'yelnya-bog-bells', accepted: 2, attempts: 2, max_elapsed_ms: 67236 }),
      // brest-fortress: «5» за 5 с — быстрый, но живой.
      pair({ quest_id: 5, slug: 'brest-fortress', max_elapsed_ms: 5000, duration_s: 0 }),
    ]
    const { players, excluded } = classifyPairs([...LUXEMBOURG_SERIES, ...live])
    expect(excluded.probeSeries).toBe(LUXEMBOURG_SERIES.length)
    expect(players.map((kept: { slug: string }) => kept.slug)).toEqual([
      'vitebsk-teens-street-art-map',
      'yelnya-bog-bells',
      'brest-fortress',
    ])
  })

  it('соседи серии до начала окна держат серию, но в счётчики не входят', () => {
    const before = [probe(7, -120, { in_window: false }), probe(7, -60, { in_window: false })]
    const { players, excluded } = classifyPairs([...before, probe(7, 0)])
    expect(excluded).toEqual({ probeSeries: 1, taintedSession: 0, total: 1 })
    expect(players).toHaveLength(0)
  })

  it('пара с ключом служебного устройства исключается, такая же с чужим ключом — нет', () => {
    // nesvizh-radziwill 24.09: гость с «живыми» 77 и 45 с, но ключ QA-телефона.
    const nesvizh = { quest_id: 6, slug: 'nesvizh-radziwill', platform: 'android', accepted: 2, attempts: 2 }
    const tainted = classifyPairs([pair({ ...nesvizh, max_elapsed_ms: 76920, tainted: true })])
    expect(tainted.players).toHaveLength(0)
    expect(tainted.excluded).toEqual({ probeSeries: 0, taintedSession: 1, total: 1 })
    const clean = classifyPairs([pair({ ...nesvizh, max_elapsed_ms: 76920 })])
    expect(clean.players).toHaveLength(1)
    expect(clean.excluded.total).toBe(0)
  })

  it('заражённая пара внутри серии считается один раз — по ключу', () => {
    const { excluded } = classifyPairs([probe(7, 0), probe(7, 10), probe(7, 20, { tainted: true })])
    expect(excluded).toEqual({ probeSeries: 2, taintedSession: 1, total: 3 })
  })
})

it('лимит гостя совпадает с клиентским GUEST_QUEST_FREE_STEPS', () => {
  expect(GUEST_FREE_STEPS).toBe(GUEST_QUEST_FREE_STEPS)
})
