#!/usr/bin/env node
'use strict'
// Серверная воронка квестов по прод-базе (#2061).
//
// ЗАЧЕМ. Воронку прохождения квестов видят три источника, и полный из них один.
// GA4 и Метрика получают события только с сайта и только от посетителей,
// принявших cookie (около трети), приложения не видят вовсе; счётчик
// `views_count` квеста накручивает сборка сайта (#2050). Прод-база видит каждого
// игрока на каждой платформе: ответы лежат в `quest_answer_attempt`, засчитанные
// прохождения вошедших — в `quest_progress`. До этого скрипта воронку по ней
// собирали разовым SQL, и два замера в разные дни легко было посчитать
// по-разному.
//
// ЧТО СЧИТАЕТ. Единица — пара «квест × session_key» из `quest_answer_attempt`:
// ключ сессии общий у гостя и вошедшего, поэтому логин посреди квеста пару не
// рвёт. Глубина пары — число разных принятых точек, которые идут в прогресс, по
// тому же правилу, что у клиента (`buildQuestCountModel`/`getQuestProgressSteps`
// в utils/questCountModel.ts): если у каждой пронумерованной точки явная роль
// required/optional/final — только обязательные, иначе все, кроме intro. От них
// же считаются пороги 25/50/75 % (как вехи клиентской воронки) и гостевой гейт.
// Засчитанные прохождения берутся из `quest_progress.completed` — они бывают
// только у вошедших.
//
// ПОДВОХИ, которые видны только в данных:
//   - новый визит даёт новый session_key, поэтому многодневное прохождение
//     дробится на несколько пар, и засчитанных бывает больше, чем пар «все точки»;
//   - до 06.09.2026 строка `quest_progress` создавалась открытием экрана (#1803),
//     и в окне раньше этой даты «начато» включает просто открывших;
//   - 06.08.2026 в `quest_answer_attempt` писал локальный клиент разработки,
//     поэтому окно не начинается раньше 07.08.2026;
//   - staff-аккаунты и служебный вход «Редакция metravel» (id 120, демо-аккаунт
//     App Review) игроками не являются и исключены.
//
// ОГРАНИЧЕНИЯ МЕТОДА: роли точек берутся сегодняшние, а не на момент игры;
// пара «гость → вход» целиком считается дошедшей до гейта — гостевые ответы,
// отправленные уже после входа, приходят с user_id, и точнее их не разделить.
//
// Только чтение: SQL уходит одним документом в psql внутри контейнера базы, как
// в scripts/audit-quest-telemetry-loss.sh, и сессия переведена в READ ONLY.
//
//     npm run quest:funnel
//     npm run quest:funnel -- --since 2026-08-24
//     npm run quest:funnel -- --quest vitebsk-kids-skazki --days 60 --json

const path = require('path')
const { spawnSync } = require('child_process')

const {
  ExpectedFailureError,
  UsageError,
  parseCliArgs,
  parseCliTokens,
  runCli,
} = require('./lib/cli-contract')

const ROOT = path.resolve(__dirname, '..')

const DEFAULT_DAYS = 30
// 06.08.2026 — день запуска телеметрии ответов; строки того дня писал клиент
// разработки, а не игроки.
const TELEMETRY_CLEAN_SINCE = '2026-08-07'
// С этой даты строку `quest_progress` создаёт первое действие игрока (#1803).
const PROGRESS_STARTS_RELIABLE_SINCE = '2026-09-06'
// «Редакция metravel»: не staff, но служебный вход, а не игрок.
const EXCLUDED_USER_IDS = [120]
// Равно GUEST_QUEST_FREE_STEPS из utils/guestQuestProgress.ts — равенство держит тест.
const GUEST_FREE_STEPS = 2
const MILESTONES = [25, 50, 75]
// Засчитанное быстрее — вероятно, ответы найдены не на месте.
const FAST_COMPLETION_MINUTES = 15
const TOP_QUESTS_LIMIT = 10
const DB_SERVICE = 'metravel-gis'
const SQL_HEREDOC = 'METRAVEL_QUEST_FUNNEL_SQL'
const SSH_TIMEOUT_MS = 120000

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const QUEST_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/

const AUTH_SEGMENTS = ['guest', 'guest_login', 'user']
const PLATFORM_SEGMENTS = ['web', 'android', 'ios']

const USAGE = `Серверная воронка квестов по прод-базе — #2061

Usage:
  node scripts/quest-funnel.js [--days <n> | --since <YYYY-MM-DD>] [--quest <slug>] [--json]

Options:
  --days <n>            окно в днях до сегодня (по умолчанию ${DEFAULT_DAYS})
  --since <YYYY-MM-DD>  начало окна; раньше ${TELEMETRY_CLEAN_SINCE} окно не начинается
  --quest <slug>        один квест по quest_id, например vitebsk-kids-skazki
  --json                machine-readable результат на stdout
  --help, -h            напечатать эту справку и выйти

Только чтение прод-базы по ssh; адрес сервера — из .env.deploy (scripts/deploy-target.sh).`

const CLI_SPEC = {
  name: 'quest-funnel',
  usage: USAGE,
  selection: 'none',
  flags: {
    days: { type: 'int', min: 1 },
    since: { type: 'string' },
    quest: { type: 'string' },
    json: { type: 'boolean' },
  },
}

const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

// `new Date('2026-13-01')` — Invalid Date, и toISOString() на нём бросает
// RangeError: проверка обязана вернуть false, а не уронить разбор аргументов.
const isValidDate = (date) => !Number.isNaN(date.getTime())

const isCalendarDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return isValidDate(date) && date.toISOString().slice(0, 10) === value
}

// cli-contract отдаёт непереданный флаг как `null`, прямой вызов из теста — как
// `undefined`; оба значат «флаг не задан».
const isSet = (value) => value !== undefined && value !== null

/** Окно отчёта: `--since` или `--days` до `now`, не раньше чистой телеметрии. */
function resolveWindow({ days, since, quest } = {}, now = new Date()) {
  if (isSet(days) && isSet(since)) {
    throw new UsageError('--days и --since задают одно и то же окно — оставьте один из них')
  }
  if (isSet(since) && !isCalendarDate(since)) {
    throw new UsageError(`--since ожидает дату YYYY-MM-DD, получено: ${since}`)
  }
  if (isSet(quest) && !QUEST_SLUG_PATTERN.test(quest)) {
    throw new UsageError(`--quest ожидает quest_id (латиница, цифры, дефис), получено: ${quest}`)
  }
  const fromDays = new Date(now.getTime() - (days ?? DEFAULT_DAYS) * 86400000)
  if (!isSet(since) && !isValidDate(fromDays)) {
    throw new UsageError(`--days ${days} уводит окно за пределы календаря`)
  }
  const requested = since ?? fromDays.toISOString().slice(0, 10)
  const clamped = requested < TELEMETRY_CLEAN_SINCE
  return {
    since: clamped ? TELEMETRY_CLEAN_SINCE : requested,
    requestedSince: requested,
    clamped,
    quest: quest ?? null,
  }
}

const stageColumns = () =>
  [
    'count(*) AS answered',
    'count(*) FILTER (WHERE accepted >= 1) AS point1',
    ...MILESTONES.map(
      (pct) => `count(*) FILTER (WHERE n_points > 0 AND accepted * 100 >= ${pct} * n_points) AS p${pct}`,
    ),
    'count(*) FILTER (WHERE n_points > 0 AND accepted >= n_points) AS all_points',
    'count(*) FILTER (WHERE attempts = 1) AS single_attempt',
  ].join(',\n      ')

/**
 * Один SELECT, возвращающий весь отчёт JSON-документом: одна строка psql вместо
 * разбора нескольких таблиц. Значения в SQL попадают только после проверки
 * формата — экранировать тут нечего и незачем.
 */
function buildFunnelSql({ since, quest = null }) {
  if (!isCalendarDate(since)) throw new Error(`buildFunnelSql: небезопасная дата ${since}`)
  if (quest !== null && !QUEST_SLUG_PATTERN.test(quest)) {
    throw new Error(`buildFunnelSql: небезопасный quest_id ${quest}`)
  }
  const sinceSql = `DATE '${since}'`
  const questFilter = quest === null ? '' : `WHERE quest_id = '${quest}'`
  const stages = stageColumns()
  return `WITH excluded AS (
  SELECT id FROM users WHERE is_staff OR is_superuser OR id IN (${EXCLUDED_USER_IDS.join(', ')})
),
scope AS (
  SELECT id, quest_id AS slug FROM quests_quest ${questFilter}
),
steps AS (
  SELECT quest_id, step_id, point_role,
    is_intro OR lower(trim(step_id)) = 'intro' AS intro
  FROM quest_steps
),
models AS (
  SELECT quest_id,
    coalesce(bool_and(coalesce(point_role IN ('required', 'optional', 'final'), false))
      FILTER (WHERE NOT intro), false) AS explicit_roles
  FROM steps GROUP BY quest_id
),
progress_steps AS (
  SELECT st.quest_id, st.step_id
  FROM steps st JOIN models m USING (quest_id)
  WHERE NOT st.intro AND (NOT m.explicit_roles OR st.point_role = 'required')
),
points AS (
  SELECT quest_id, count(*) AS n_points FROM progress_steps GROUP BY quest_id
),
pairs AS (
  SELECT a.quest_id, a.session_key,
    min(a.occurred_at) AS first_at,
    bool_or(a.user_id IS NULL) AS any_guest,
    bool_or(a.user_id IS NOT NULL) AS any_user,
    coalesce(bool_or(a.user_id IN (SELECT id FROM excluded)), false) AS any_excluded,
    max(a.platform) AS platform,
    count(*) AS attempts,
    count(DISTINCT a.step_key) FILTER (
      WHERE a.verdict = 'accepted' AND ps.step_id IS NOT NULL
    ) AS accepted
  FROM quest_answer_attempt a
  JOIN scope q ON q.id = a.quest_id
  -- По строковому ключу, а не по FK: у попытки FK шага SET_NULL, а ключ — тот
  -- же step_id, которым клиент отмечает пройденную точку.
  LEFT JOIN progress_steps ps ON ps.quest_id = a.quest_id AND ps.step_id = a.step_key
  GROUP BY a.quest_id, a.session_key
),
funnel AS (
  SELECT p.*, coalesce(pt.n_points, 0) AS n_points,
    CASE WHEN p.any_guest AND p.any_user THEN 'guest_login'
         WHEN p.any_user THEN 'user'
         ELSE 'guest' END AS auth
  FROM pairs p LEFT JOIN points pt USING (quest_id)
  WHERE NOT p.any_excluded AND p.first_at >= ${sinceSql}
),
progress AS (
  SELECT qp.* FROM quest_progress qp JOIN scope q ON q.id = qp.quest_id
  WHERE qp.user_id NOT IN (SELECT id FROM excluded)
)
SELECT json_build_object(
  'quest_found', (SELECT count(*) > 0 FROM scope),
  'stages', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
    SELECT 'all' AS segment, 'all' AS value,
      ${stages}
    FROM funnel
    UNION ALL
    SELECT 'auth', auth,
      ${stages}
    FROM funnel GROUP BY auth
    UNION ALL
    SELECT 'platform', platform,
      ${stages}
    FROM funnel GROUP BY platform
  ) t),
  'depth', (SELECT coalesce(json_agg(t ORDER BY t.auth, t.accepted), '[]'::json) FROM (
    SELECT auth, accepted, count(*) AS pairs FROM funnel GROUP BY auth, accepted
  ) t),
  'weekly', (SELECT coalesce(json_agg(t ORDER BY t.week), '[]'::json) FROM (
    SELECT date_trunc('week', first_at)::date AS week,
      count(*) AS answered,
      count(*) FILTER (WHERE accepted >= 1) AS point1,
      count(*) FILTER (WHERE n_points > 0 AND accepted >= n_points) AS all_points
    FROM funnel GROUP BY 1
  ) t),
  'weekly_completed', (SELECT coalesce(json_agg(t ORDER BY t.week), '[]'::json) FROM (
    SELECT date_trunc('week', completed_at)::date AS week, count(*) AS completed
    FROM progress WHERE completed AND completed_at >= ${sinceSql} GROUP BY 1
  ) t),
  'top_quests', (SELECT coalesce(json_agg(t), '[]'::json) FROM (
    SELECT q.slug, f.n_points,
      count(*) AS answered,
      count(*) FILTER (WHERE f.accepted >= 1) AS point1,
      count(*) FILTER (WHERE f.n_points > 0 AND f.accepted >= f.n_points) AS all_points,
      (SELECT count(*) FROM progress p
        WHERE p.quest_id = f.quest_id AND p.completed AND p.completed_at >= ${sinceSql}) AS completed
    FROM funnel f JOIN scope q ON q.id = f.quest_id
    GROUP BY f.quest_id, q.slug, f.n_points
    ORDER BY answered DESC, q.slug
    LIMIT ${TOP_QUESTS_LIMIT}
  ) t),
  'progress', (SELECT row_to_json(t) FROM (
    SELECT
      count(*) FILTER (WHERE created_at >= ${sinceSql}) AS started,
      count(DISTINCT user_id) FILTER (WHERE created_at >= ${sinceSql}) AS players,
      count(*) FILTER (WHERE created_at >= ${sinceSql} AND completed) AS started_completed,
      count(*) FILTER (WHERE completed AND completed_at >= ${sinceSql}) AS completed,
      count(*) FILTER (WHERE completed AND completed_at >= ${sinceSql} AND early_finish) AS completed_early,
      count(*) FILTER (
        WHERE completed AND completed_at >= ${sinceSql}
          AND completed_at - created_at <= interval '${FAST_COMPLETION_MINUTES} minutes'
      ) AS completed_fast
    FROM progress
  ) t)
);`
}

/**
 * Тело удалённого скрипта для `ssh … bash -s`: резолв контейнера базы и psql с
 * SQL в собственном heredoc. docker читает heredoc, а не stdin ssh, поэтому
 * остаток скрипта не проглатывается (правило scripts/deploy-target.sh).
 */
function buildRemoteScript(sql) {
  if (sql.split('\n').some((line) => line.trim() === SQL_HEREDOC)) {
    throw new Error(`buildRemoteScript: SQL содержит строку-ограничитель ${SQL_HEREDOC}`)
  }
  return `db="$(metravel_resolve_container ${DB_SERVICE})" || exit 1
docker exec -i "$db" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -tA -v ON_ERROR_STOP=1' <<'${SQL_HEREDOC}'
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
${sql}
${SQL_HEREDOC}
`
}

/** Выполняет SQL на проде и возвращает разобранный JSON-документ. */
function runProdQuery(sql) {
  const result = spawnSync(
    'bash',
    [
      '-c',
      'source scripts/deploy-target.sh && require_deploy_target >/dev/null && ' +
        '{ metravel_container_remote_snippet; cat; } | ' +
        'ssh -o ConnectTimeout=20 -o BatchMode=yes "$PROD_SSH_TARGET" bash -s',
    ],
    { cwd: ROOT, input: buildRemoteScript(sql), encoding: 'utf8', timeout: SSH_TIMEOUT_MS },
  )
  if (result.error) throw new Error(`ssh не отработал: ${result.error.message}`)
  if (result.status !== 0) {
    throw new Error(`прод-база недоступна (exit ${result.status}): ${String(result.stderr).trim()}`)
  }
  const text = String(result.stdout).trim()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`база ответила не JSON-документом: ${text.slice(0, 200)}`)
  }
}

const toCount = (value) => Number(value) || 0

const emptyStage = () => ({
  answered: 0,
  point1: 0,
  ...Object.fromEntries(MILESTONES.map((pct) => [`p${pct}`, 0])),
  allPoints: 0,
  singleAttempt: 0,
})

const toStage = (row) => ({
  answered: toCount(row.answered),
  point1: toCount(row.point1),
  ...Object.fromEntries(MILESTONES.map((pct) => [`p${pct}`, toCount(row[`p${pct}`])])),
  allPoints: toCount(row.all_points),
  singleAttempt: toCount(row.single_attempt),
})

function segmentStages(rows, segment, values) {
  const found = new Map(rows.filter((row) => row.segment === segment).map((row) => [row.value, toStage(row)]))
  // Неизвестная платформа не теряется молча — она просто добавляется колонкой.
  const extra = [...found.keys()].filter((value) => !values.includes(value))
  return Object.fromEntries([...values, ...extra].map((value) => [value, found.get(value) ?? emptyStage()]))
}

function guestGate(depth) {
  const guest = depth.filter((row) => row.auth === 'guest')
  const pairsWhere = (predicate) =>
    guest.filter((row) => predicate(toCount(row.accepted))).reduce((sum, row) => sum + toCount(row.pairs), 0)
  const loggedIn = depth
    .filter((row) => row.auth === 'guest_login')
    .reduce((sum, row) => sum + toCount(row.pairs), 0)
  const leftAtGate = pairsWhere((accepted) => accepted >= GUEST_FREE_STEPS)
  return {
    freeSteps: GUEST_FREE_STEPS,
    guestStarts: pairsWhere(() => true) + loggedIn,
    noAccepted: pairsWhere((accepted) => accepted === 0),
    leftBeforeGate: pairsWhere((accepted) => accepted > 0 && accepted < GUEST_FREE_STEPS),
    leftAtGate,
    loggedIn,
    reachedGate: leftAtGate + loggedIn,
  }
}

function mergeWeekly(weekly, weeklyCompleted) {
  const weeks = new Map()
  for (const row of weekly) {
    weeks.set(row.week, {
      week: row.week,
      answered: toCount(row.answered),
      point1: toCount(row.point1),
      allPoints: toCount(row.all_points),
      completed: 0,
    })
  }
  for (const row of weeklyCompleted) {
    const entry = weeks.get(row.week) ?? { week: row.week, answered: 0, point1: 0, allPoints: 0, completed: 0 }
    entry.completed = toCount(row.completed)
    weeks.set(row.week, entry)
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week))
}

/** Сырой JSON базы → структура отчёта. Чистая функция: её гоняют тесты. */
function buildReport(data, window) {
  const stages = Array.isArray(data.stages) ? data.stages : []
  const depth = Array.isArray(data.depth) ? data.depth : []
  const progress = data.progress ?? {}
  const allRow = stages.find((row) => row.segment === 'all')
  return {
    window: {
      since: window.since,
      requestedSince: window.requestedSince,
      clamped: window.clamped,
      quest: window.quest,
      progressStartsReliable: window.since >= PROGRESS_STARTS_RELIABLE_SINCE,
    },
    stages: {
      all: allRow ? toStage(allRow) : emptyStage(),
      byAuth: segmentStages(stages, 'auth', AUTH_SEGMENTS),
      byPlatform: segmentStages(stages, 'platform', PLATFORM_SEGMENTS),
    },
    guestGate: guestGate(depth),
    progress: {
      started: toCount(progress.started),
      players: toCount(progress.players),
      startedCompleted: toCount(progress.started_completed),
      completed: toCount(progress.completed),
      completedEarly: toCount(progress.completed_early),
      completedFast: toCount(progress.completed_fast),
      fastMinutes: FAST_COMPLETION_MINUTES,
    },
    weekly: mergeWeekly(
      Array.isArray(data.weekly) ? data.weekly : [],
      Array.isArray(data.weekly_completed) ? data.weekly_completed : [],
    ),
    topQuests: (Array.isArray(data.top_quests) ? data.top_quests : []).map((row) => ({
      slug: row.slug,
      points: toCount(row.n_points),
      answered: toCount(row.answered),
      point1: toCount(row.point1),
      allPoints: toCount(row.all_points),
      completed: toCount(row.completed),
    })),
  }
}

const pct = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')
const pad = (value, width) => String(value).padStart(width)

const STAGE_ROWS = [
  ['answered', 'ответили хоть раз'],
  ['point1', '1-я точка'],
  ...MILESTONES.map((value) => [`p${value}`, `${value} % точек`]),
  ['allPoints', 'все точки'],
]

const SEGMENT_LABELS = {
  guest: 'гости',
  guest_login: 'гость→вход',
  user: 'вошедшие',
}

function formatReport(report) {
  const { window, stages, guestGate: gate, progress } = report
  const lines = []
  const scope = window.quest ? `квест ${window.quest}` : 'все квесты'
  lines.push(`Воронка квестов по прод-базе — с ${window.since}, ${scope}`)
  if (window.clamped) {
    lines.push(`  окно сдвинуто с ${window.requestedSince} на ${window.since}: раньше телеметрия ответов нечистая`)
  }
  lines.push('  единица — пара «квест × сессия»; исключены staff и служебный вход «Редакция metravel»')
  lines.push('  точки — те, что идут в прогресс: обязательные при явных ролях, иначе все, кроме intro')
  lines.push('')

  const authKeys = Object.keys(stages.byAuth)
  const platformKeys = Object.keys(stages.byPlatform)
  const header = [
    'шаг'.padEnd(20),
    pad('всего', 6),
    pad('', 5),
    ...authKeys.map((key) => pad(SEGMENT_LABELS[key] ?? key, 11)),
    ' |',
    ...platformKeys.map((key) => pad(key, 8)),
  ].join('')
  lines.push('Прохождения по ответам (все платформы)')
  lines.push(`  ${header}`)
  STAGE_ROWS.forEach(([key, label], index) => {
    const previous = index > 0 ? stages.all[STAGE_ROWS[index - 1][0]] : null
    const conversion = previous === null ? '' : pct(stages.all[key], previous)
    lines.push(
      `  ${[
        label.padEnd(20),
        pad(stages.all[key], 6),
        pad(conversion, 5),
        ...authKeys.map((segment) => pad(stages.byAuth[segment][key], 11)),
        ' |',
        ...platformKeys.map((platform) => pad(stages.byPlatform[platform][key], 8)),
      ].join('')}`,
    )
  })
  lines.push(`  один ответ и ушли: ${stages.all.singleAttempt} из ${stages.all.answered}`)
  lines.push('')

  lines.push(`Гостевой гейт (бесплатно ${gate.freeSteps} точки)`)
  lines.push(
    `  гостевых начал ${gate.guestStarts}: без верного ответа ${gate.noAccepted}, ` +
      `ушли до гейта ${gate.leftBeforeGate}, дошли до гейта ${gate.reachedGate}`,
  )
  lines.push(
    `  у гейта вошли ${gate.loggedIn} (${pct(gate.loggedIn, gate.reachedGate)}), ушли ${gate.leftAtGate}`,
  )
  lines.push('')

  lines.push('Засчитанные прохождения (quest_progress, только вошедшие)')
  lines.push(
    `  начато в окне ${progress.started} (игроков ${progress.players}), ` +
      `из них засчитано ${progress.startedCompleted} (${pct(progress.startedCompleted, progress.started)})`,
  )
  if (!window.progressStartsReliable) {
    lines.push(
      `  ⚠️  до ${PROGRESS_STARTS_RELIABLE_SINCE} строку создавало открытие экрана — «начато» завышено`,
    )
  }
  lines.push(
    `  засчитано в окне ${progress.completed}: досрочно ${progress.completedEarly}, ` +
      `быстрее ${progress.fastMinutes} мин ${progress.completedFast} (${pct(progress.completedFast, progress.completed)})`,
  )
  lines.push('  одно прохождение на нескольких визитах — несколько пар, поэтому засчитанных бывает больше пар «все точки»')
  lines.push('')

  lines.push('По неделям (с понедельника)')
  lines.push(`  ${'неделя'.padEnd(12)}${pad('ответили', 10)}${pad('1-я точка', 11)}${pad('все точки', 11)}${pad('засчитано', 11)}`)
  for (const week of report.weekly) {
    lines.push(
      `  ${week.week.padEnd(12)}${pad(week.answered, 10)}${pad(week.point1, 11)}${pad(week.allPoints, 11)}${pad(week.completed, 11)}`,
    )
  }
  if (!report.weekly.length) lines.push('  за окно ни одного ответа')
  lines.push('')

  lines.push(`Квесты по числу прохождений (до ${TOP_QUESTS_LIMIT})`)
  lines.push(
    `  ${'квест'.padEnd(34)}${pad('в зачёт', 8)}${pad('ответили', 10)}${pad('1-я точка', 11)}${pad('все точки', 11)}${pad('засчитано', 11)}`,
  )
  for (const quest of report.topQuests) {
    lines.push(
      `  ${quest.slug.padEnd(34)}${pad(quest.points, 8)}${pad(quest.answered, 10)}${pad(quest.point1, 11)}${pad(quest.allPoints, 11)}${pad(quest.completed, 11)}`,
    )
  }
  if (!report.topQuests.length) lines.push('  нет')
  return lines.join('\n')
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const window = resolveWindow(args)
  const data = runProdQuery(buildFunnelSql(window))
  if (!data.quest_found) {
    throw new ExpectedFailureError(`квест ${window.quest} не найден в прод-базе`)
  }
  const report = buildReport(data, window)
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return
  }
  console.log(formatReport(report))
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}

module.exports = {
  EXCLUDED_USER_IDS,
  GUEST_FREE_STEPS,
  TELEMETRY_CLEAN_SINCE,
  buildFunnelSql,
  buildRemoteScript,
  buildReport,
  formatReport,
  parseArgs,
  resolveWindow,
}
