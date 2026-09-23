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
  TELEMETRY_CLEAN_SINCE,
  buildFunnelSql,
  buildRemoteScript,
  buildReport,
  formatReport,
  parseArgs,
  resolveWindow,
} = require('@/scripts/quest-funnel')

const NOW = new Date('2026-09-23T10:00:00Z')

const stageRow = (segment: string, value: string, counts: number[]) => {
  const [answered, point1, p25, p50, p75, allPoints, singleAttempt] = counts
  return {
    segment,
    value,
    answered,
    point1,
    p25,
    p50,
    p75,
    all_points: allPoints,
    single_attempt: singleAttempt,
  }
}

// Замер 23.09.2026 с 24.08.2026: 39 → 33 → 24 → 18 → 12 → 1.
const PROD_LIKE = {
  quest_found: true,
  stages: [
    stageRow('all', 'all', [39, 33, 24, 18, 12, 1, 7]),
    stageRow('auth', 'guest', [17, 12, 4, 0, 0, 0, 5]),
    stageRow('auth', 'guest_login', [10, 10, 10, 10, 7, 1, 0]),
    stageRow('auth', 'user', [12, 11, 10, 8, 5, 0, 2]),
    stageRow('platform', 'android', [8, 7, 7, 4, 3, 0, 1]),
    stageRow('platform', 'ios', [1, 0, 0, 0, 0, 0, 1]),
    stageRow('platform', 'web', [30, 26, 17, 14, 9, 1, 5]),
  ],
  depth: [
    { auth: 'guest', accepted: 0, pairs: 5 },
    { auth: 'guest', accepted: 1, pairs: 8 },
    { auth: 'guest', accepted: 2, pairs: 4 },
    { auth: 'guest_login', accepted: 6, pairs: 10 },
    { auth: 'user', accepted: 5, pairs: 12 },
  ],
  weekly: [
    { week: '2026-08-24', answered: 10, point1: 8, all_points: 0 },
    { week: '2026-08-31', answered: 15, point1: 14, all_points: 1 },
  ],
  weekly_completed: [
    { week: '2026-08-31', completed: 5 },
    { week: '2026-09-21', completed: 1 },
  ],
  top_quests: [
    { slug: 'vitebsk-kids-skazki', n_points: 8, answered: 7, point1: 6, all_points: 1, completed: 1 },
  ],
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
      answered: 39,
      point1: 33,
      p25: 24,
      p50: 18,
      p75: 12,
      allPoints: 1,
      singleAttempt: 7,
    })
    expect(report.stages.byAuth.guest_login.p75).toBe(7)
    expect(report.stages.byPlatform.ios.answered).toBe(1)
    expect(report.guestGate).toEqual({
      freeSteps: 2,
      guestStarts: 27,
      noAccepted: 5,
      leftBeforeGate: 8,
      leftAtGate: 4,
      loggedIn: 10,
      reachedGate: 14,
    })
    expect(report.progress).toMatchObject({ started: 33, startedCompleted: 17, completedFast: 7 })
  })

  it('сводит недели ответов и засчитываний в одну строку на неделю', () => {
    const report = buildReport(PROD_LIKE, window)
    expect(report.weekly).toEqual([
      { week: '2026-08-24', answered: 10, point1: 8, allPoints: 0, completed: 0 },
      { week: '2026-08-31', answered: 15, point1: 14, allPoints: 1, completed: 5 },
      { week: '2026-09-21', answered: 0, point1: 0, allPoints: 0, completed: 1 },
    ])
  })

  it('пустое окно — нули, а не падение и не «undefined» в отчёте', () => {
    const report = buildReport(
      { quest_found: true, stages: [], depth: [], weekly: [], weekly_completed: [], top_quests: [], progress: null },
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
    expect(text).toMatch(/1-я точка\s+33\s+85%/)
    expect(text).toContain('у гейта вошли 10 (71%), ушли 4')
    expect(text).toContain('vitebsk-kids-skazki')
  })
})

it('лимит гостя совпадает с клиентским GUEST_QUEST_FREE_STEPS', () => {
  expect(GUEST_FREE_STEPS).toBe(GUEST_QUEST_FREE_STEPS)
})
