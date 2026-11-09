#!/usr/bin/env node
/**
 * Скан медиа квестов на проде: обложка, текст, видео и постер финала.
 *
 * Обложка и финальное видео — ручные шаги ПОСЛЕ миграции квеста
 * (`.claude/skills/metravel-quest/references/upload-after.md` §4–5, скилл
 * `metravel-quest-finale`), и ничто не сообщало, когда шаг пропущен. Так на
 * проде копились квесты с заглушкой вместо обложки и без видео: 25 в #2256,
 * 49 в #3171, ещё 50 в #3184 — каждый раз их находили случайно и чинили
 * конкретную партию (#3186). Этот скан — проверка, которой не было: публикация
 * партии не закончена, пока он не зелёный.
 *
 * Что считается пропуском (у каждого квеста каталога должно быть всё):
 *   - cover          — `cover_url` пуст или указывает на заглушку
 *                      `quest-default-cover.svg`;
 *   - finale_text    — у финала нет текста (видео к нему не привязать: pk
 *                      финала находится только сверкой текста);
 *   - finale_video   — пустой `finale.video_url`;
 *   - finale_poster  — пустой `finale.poster_url`.
 * Отсутствие квеста в маппинге `QUESTS` генератора само по себе НЕ пропуск:
 * у старых квестов (Гомель, 33–34) видео есть без записи в маппинге. Маппинг
 * нужен только чтобы сделать видео, поэтому он попадает в подсказку
 * следующего шага, а не в вердикт.
 *
 * Скан только читает прод. Обход каталога и бандлов — `lib/questBundles`
 * (все страницы, последовательно, повторы на 5xx/429 в `lib/fetchJson`):
 * прод одноядерный, и параллельный свип роняет его самого. Недоступный прод
 * — это exit 1 со стеком, а не «пропусков нет».
 *
 *   node scripts/scan-quest-media-gaps.js                      # весь каталог
 *   node scripts/scan-quest-media-gaps.js --quest-id=a,b,c     # только партия
 *   node scripts/scan-quest-media-gaps.js --json
 *
 * Exit code 1, если у хотя бы одного квеста есть пропуск.
 */

const fs = require('fs')
const path = require('path')

const { fetchAllQuestIds, fetchQuestBundles } = require('./lib/questBundles')
const {
  QUESTS: FINALE_QUESTS,
  EXISTING_VIDEO_QUESTS,
  ASSETS_DIR,
} = require('./generate-quest-finale-videos.js')
const {
  parseCliArgs,
  parseCliTokens,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runCli,
} = require('./lib/cli-contract')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'
const DEFAULT_COVER_RE = /\/quest-default-cover\.svg(?:$|[?#])/i

const GAP_LABELS = {
  cover: 'обложка — заглушка или пусто',
  finale_text: 'у финала нет текста',
  finale_video: 'нет видео финала',
  finale_poster: 'нет постера финала',
}

/** camelCase-папка ассетов квеста по quest_id: `harbin-central-street-sofia` ↔ `harbinCentralStreetSofia`. */
const folderKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')

function listAssetDirs(assetsDir = ASSETS_DIR) {
  try {
    return fs.readdirSync(assetsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  } catch {
    return []
  }
}

/**
 * Контекст для подсказок: маппинг финалов и локальные папки ассетов.
 * Вынесен параметром, чтобы тест не зависел от файловой системы и маппинга.
 * `EXISTING_VIDEO_QUESTS` — старые квесты, чьё видео генератор НЕ делает (только
 * постер из видео, `--posters-existing`): подсказка «добавь в QUESTS» для них
 * завела бы второй финал поверх настоящего.
 */
function buildContext({
  finaleQuests = FINALE_QUESTS,
  existingVideoQuests = EXISTING_VIDEO_QUESTS,
  assetDirs = listAssetDirs(),
  hasFile,
} = {}) {
  const mapping = new Map([
    ...existingVideoQuests.map((q) => [q.questId, { ...q, existingVideo: true }]),
    ...finaleQuests.map((q) => [q.questId, { ...q, existingVideo: false }]),
  ])
  const dirsByKey = new Map(assetDirs.map((dir) => [folderKey(dir), dir]))
  const fileExists = hasFile || ((dir, name) => fs.existsSync(path.join(ASSETS_DIR, dir, name)))
  return { mapping, dirsByKey, fileExists }
}

function questGaps(bundle) {
  const finale = bundle.finale || {}
  const gaps = []
  if (!bundle.cover_url || DEFAULT_COVER_RE.test(bundle.cover_url)) gaps.push('cover')
  if (!String(finale.text || '').trim()) gaps.push('finale_text')
  if (!finale.video_url) gaps.push('finale_video')
  if (!finale.poster_url) gaps.push('finale_poster')
  return gaps
}

/**
 * Команды с `--quest-id` всегда: `upload-quest-finales.js` без него PATCH-ит
 * финалы ВСЕХ квестов `QUESTS`, у которых есть локальные файлы. Заливка — сначала
 * `--dry-run` (скилл `metravel-quest-finale`, шаги 4–6); при живом видео — только
 * постер, чтобы не перезаписать видео на проде.
 */
function finaleStep(questId, mapped, videoMissing) {
  const only = `--quest-id=${questId}`
  if (!mapped) {
    return 'видео: квеста нет в QUESTS (scripts/generate-quest-finale-videos.js) — добавить запись, finaleId сверкой текста (скилл metravel-quest-finale)'
  }
  if (mapped.existingVideo) {
    return videoMissing
      ? `видео: квест из EXISTING_VIDEO_QUESTS (finaleId ${mapped.finaleId}) — генератор его видео не делает, исходное видео пропало с прода: разбор вручную, в QUESTS не добавлять`
      : `постер: FFMPEG_PATH=ffmpeg node scripts/generate-quest-finale-videos.js --posters-existing ${only}, затем node scripts/upload-quest-finales.js --dry-run --posters-only ${only}`
  }
  const upload = videoMissing ? only : `--posters-only ${only}`
  return `видео: finaleId ${mapped.finaleId} в QUESTS — FFMPEG_PATH=ffmpeg node scripts/generate-quest-finale-videos.js ${only}, затем node scripts/upload-quest-finales.js --dry-run ${upload}`
}

/** Следующий шаг по каждому пропуску — чтобы отчёт вёл к команде, а не к поиску по скиллам. */
function nextSteps(questId, gaps, ctx) {
  const mapped = ctx.mapping.get(questId)
  const dir = (mapped && mapped.dir) || ctx.dirsByKey.get(folderKey(questId)) || null
  const steps = []
  if (gaps.includes('cover')) {
    if (dir && ctx.fileExists(dir, 'cover.png')) {
      // Загрузчик берёт квест только из своего списка QUEST_COVERS: без записи `--quest-id` падает «Unknown quest id».
      steps.push(`обложка: есть assets/quests/${dir}/cover.png — запись в QUEST_COVERS и node scripts/upload-missing-quest-covers-prod.js --dry-run --quest-id=${questId}`)
    } else if (dir && ctx.fileExists(dir, 'PROMPT.md')) {
      steps.push(`обложка: assets/quests/${dir}/PROMPT.md есть, cover.png нет — ждёт генерации владельцем (upload-after.md §4)`)
    } else {
      steps.push('обложка: нет ни cover.png, ни PROMPT.md — агент пишет assets/quests/<camelCaseId>/PROMPT.md (upload-after.md §4)')
    }
  }
  if (gaps.includes('finale_text')) {
    steps.push('финал: текста нет — он создаётся миграцией квеста; без него видео не привязать')
  } else if (gaps.includes('finale_video') || gaps.includes('finale_poster')) {
    steps.push(finaleStep(questId, mapped, gaps.includes('finale_video')))
  }
  // Постер старого квеста режется из его видео, не из обложки — порядок к нему не относится.
  const finaleFromCover = !(mapped && mapped.existingVideo)
  if (finaleFromCover && gaps.includes('cover') && (gaps.includes('finale_video') || gaps.includes('finale_poster'))) {
    steps.push('порядок: сначала обложка — видео финала собирается из неё')
  }
  return steps
}

function scanMediaGaps(bundles, ctx = buildContext()) {
  const findings = []
  for (const bundle of bundles) {
    const gaps = questGaps(bundle)
    if (!gaps.length) continue
    findings.push({
      id: bundle.id ?? null,
      quest_id: bundle.quest_id,
      title: bundle.title || '',
      gaps,
      next: nextSteps(bundle.quest_id, gaps, ctx),
    })
  }
  return findings
}

// ===================== CLI =====================

const USAGE = `Скан медиа квестов: обложка, текст, видео и постер финала (#3186)

Usage:
  node scripts/scan-quest-media-gaps.js [--quest-id <id[,id…]>] [--api-url <url>] [--json]

Options:
  --quest-id <ids>   только эти квесты (через запятую) — проверка партии
  --api-url <url>    адрес прода (по умолчанию METRAVEL_API_URL или https://metravel.by)
  --json             machine-readable результат на stdout
  --help, -h         напечатать эту справку и выйти

Exit: 0 — пропусков нет; 1 — есть пропуски или прод не ответил; 2 — неверный вызов.`

const CLI_SPEC = {
  name: 'scan-quest-media-gaps',
  usage: USAGE,
  selection: 'quests',
  flags: {
    'api-url': { type: 'string', default: DEFAULT_API, stripTrailingSlash: true },
    'quest-id': { type: 'string' },
    json: { type: 'boolean' },
  },
}

const splitIds = (value) => (value ? [...new Set(value.split(',').map((s) => s.trim()).filter(Boolean))] : null)

const withQuestIds = (args) => ({ ...args, questIds: splitIds(args.questId) })
const parseArgs = (tokens) => withQuestIds(parseCliTokens(tokens, CLI_SPEC))

async function loadBundles(apiUrl, questIds) {
  const ids = questIds || (await fetchAllQuestIds(apiUrl))
  const bundles = []
  for (const id of ids) bundles.push(...(await fetchQuestBundles(apiUrl, id)))
  return bundles
}

async function main(argv = process.argv, { ctx } = {}) {
  const args = withQuestIds(parseCliArgs(argv, CLI_SPEC))
  const bundles = requireNonEmptySelection(await loadBundles(args.apiUrl, args.questIds), {
    what: 'квестов',
    source: args.apiUrl,
    hint: 'проверь --quest-id / --api-url',
  })
  const findings = scanMediaGaps(bundles, ctx || buildContext())

  if (args.json) {
    console.log(JSON.stringify({ source: args.apiUrl, quests: bundles.length, findings }, null, 2))
  } else {
    console.log(`Медиа квестов: ${args.apiUrl} — проверено ${bundles.length}`)
    for (const f of findings) {
      console.log(`\n  [quest ${f.id ?? '?'}] ${f.quest_id} — ${f.title}`)
      console.log(`    ${f.gaps.map((g) => GAP_LABELS[g]).join('; ')}`)
      for (const step of f.next) console.log(`    → ${step}`)
    }
    console.log(findings.length ? `\nКвестов с пропусками: ${findings.length}` : '\nПропусков нет.')
  }

  requireNoBatchFailures(findings.length, {
    total: bundles.length,
    message: `квестов с пропусками медиа: ${findings.length} из ${bundles.length}`,
  })
  return findings
}

module.exports = {
  GAP_LABELS,
  buildContext,
  folderKey,
  main,
  nextSteps,
  parseArgs,
  questGaps,
  scanMediaGaps,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
