#!/usr/bin/env node
/**
 * Safe editor for LIVE published travels on metravel.by.
 *
 * Unlike the draft engine (metravel_publish.py), this never knocks an article
 * offline: it echoes back every real field from GET and changes ONLY the
 * description (lead / appended blocks). `--meta` is refused before the write:
 * the upsert serializer does not declare meta_description, so the API drops it
 * on validation (#1716, backend side #1737). Safety rails:
 *   1. BACKUP   — the full original GET payload is written to disk before any
 *                 write, so every edit is reversible (`--restore`).
 *   2. VERIFY   — after PUT it re-GETs and checks publish/moderation/slug/
 *                 gallery/points/description did not regress.
 *   3. ROLLBACK — on a detected regression it automatically PUTs the original
 *                 description back and exits non-zero.
 *
 * The heavy lifting is in pure functions (composeDescription, buildUpsertPayload,
 * detectRegression) that are unit-tested. main() is the thin I/O shell.
 *
 * `--help` prints the flag list (USAGE below). Exactly one action is required —
 * `--id` (edit) or `--restore` (revert) — and every flag goes through the shared
 * SEO CLI contract, so a mistyped `--dry-runn` can no longer turn a rehearsal
 * into a live write (#1391).
 *
 * Token: env METRAVEL_TOKEN or ~/.metravel_token.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');

const { parseCliArgs, runSeoCli } = require('./lib/seo-cli-contract');
const { readResponseText, withAcceptEncoding } = require('./lib/httpText');
const { detectStoredTextCorruption, findUnverifiableFields } = require('./lib/textIntegrity');

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '');
// Маркер черновика визарда. Скрипт его больше НЕ пишет (#1716); константа
// остаётся объявлением того, чего в payload быть не должно, и это же
// утверждает тест.
const SENTINEL = '__draft_placeholder__';
const DEFAULT_BACKUP_DIR = path.join(__dirname, '.seo-backups');

const USAGE = `Safe editor for live published travels — metravel.by

Usage:
  node scripts/seo-edit.js <action> [options]

Actions (exactly one is required — the script never guesses an article):
  --id <id>             edit this travel (backup → PUT → verify → auto-rollback)
  --restore <id>        revert this travel from its latest backup

Options:
  --prepend-file <path>  HTML prepended as the lead (with --id)
  --append-file <path>   HTML appended after the body (with --id)
  --desc-file <path>     HTML replacing the whole body (with --id)
  --meta <text>          REFUSED: the API drops meta_description on validation (#1737)
  --dry-run              print the plan, write nothing (with --id)
  --backup-dir <path>    where backups are written and read (default scripts/.seo-backups)
  --help, -h             print this help and exit

Examples:
  node scripts/seo-edit.js --id 169 --prepend-file lead.html --append-file blocks.html
  node scripts/seo-edit.js --id 169 --dry-run
  node scripts/seo-edit.js --restore 169`;

/**
 * Every flag this script accepts. The write-shaping flags are pinned to `--id`
 * on purpose: `--restore 169 --dry-run` used to swallow the `--dry-run` and
 * write to production anyway — the ignored-flag shape of SEO-OPS-001 (#1391).
 */
const CLI_SPEC = {
  name: 'seo-edit',
  usage: USAGE,
  selection: 'none', // one article named by --id/--restore, never a list
  flags: {
    id: { type: 'string', valueName: 'a travel id' },
    restore: { type: 'string', valueName: 'a travel id' },
    'prepend-file': { type: 'string', valueName: 'a path', default: '', requiresMode: 'id', reason: 'a restore rewrites the whole backed-up body' },
    'append-file': { type: 'string', valueName: 'a path', default: '', requiresMode: 'id', reason: 'a restore rewrites the whole backed-up body' },
    'desc-file': { type: 'string', valueName: 'a path', default: '', requiresMode: 'id', reason: 'a restore rewrites the whole backed-up body' },
    meta: { type: 'string', valueName: 'a meta description', default: null, allowLeadingDash: true, requiresMode: 'id', reason: 'a restore puts the backed-up meta back' },
    'dry-run': { type: 'boolean', requiresMode: 'id', reason: 'a restore always writes' },
    'backup-dir': { type: 'string', valueName: 'a directory', default: DEFAULT_BACKUP_DIR },
  },
  modes: {
    flags: ['id', 'restore'],
    label: 'actions',
    missing: 'No action given: pass --id <id> to edit an article or --restore <id> to revert it',
  },
};

const parseArgs = (argv) => parseCliArgs(argv, CLI_SPEC);

// ---------------------------------------------------------------------------
// Pure core (exported for tests)
// ---------------------------------------------------------------------------

/** Plain-text, lowercased, punctuation-stripped form for shingle comparison. */
function normalizeLeadText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .toLowerCase()
    .replace(/[«»"'(),.:;—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Contiguous 3-word shingles of the normalized text (tokens ≥3 chars). */
function leadShingles(text) {
  const toks = normalizeLeadText(text).split(' ').filter((w) => w.length >= 3);
  const out = new Set();
  for (let i = 0; i + 3 <= toks.length; i++) out.add(toks.slice(i, i + 3).join(' '));
  return out;
}

/**
 * True when two lead paragraphs are "the same intro" — they share ≥2 literal
 * 3-word phrases. Enough to catch a re-generated definitional lead that diverges
 * only in epithets/details (бирюзовой↔лазурной, a Polish name in parens), without
 * firing on an unrelated body paragraph that merely names the same place once.
 */
function leadIsDuplicate(a, b) {
  const A = leadShingles(a);
  const B = leadShingles(b);
  if (A.size < 2 || B.size < 2) return false;
  let shared = 0;
  for (const s of A) if (B.has(s)) shared++;
  return shared >= 2;
}

/** Split off the first top-level <p>…</p>; returns { first, rest } or null. */
function splitLeadingParagraph(html) {
  const m = /^\s*(<p\b[^>]*>[\s\S]*?<\/p>)/i.exec(html);
  if (!m) return null;
  return { first: m[1], rest: html.slice(m.index + m[0].length) };
}

/**
 * Build the new description body from the original + lead/append/replace parts.
 *
 * Idempotent prepend: if the body already opens with a near-duplicate lead (a
 * prior SEO pass already prepended one), the existing lead is REPLACED rather
 * than stacked. This is what prevents the "double lead" regression — re-running
 * `--prepend-file` on an article that already has an SEO intro no longer leaves
 * two definitional paragraphs at the top.
 */
function composeDescription(oldDesc, { prepend = '', append = '', replace = null } = {}) {
  if (replace != null) return String(replace);
  let out = String(oldDesc || '');
  const lead = String(prepend || '').trim();
  const tail = String(append || '').trim();
  if (lead) {
    const trimmed = out.replace(/^\s+/, '');
    const existing = splitLeadingParagraph(trimmed);
    const incoming = (splitLeadingParagraph(lead) || {}).first || lead;
    out = existing && leadIsDuplicate(existing.first, incoming) ? existing.rest : trimmed;
    out = `${lead}\n${out.replace(/^\s+/, '')}`;
  }
  if (tail) out = `${out.replace(/\s+$/, '')}\n${tail}`;
  return out;
}

/**
 * Echo every real field from the GET detail; override only description +
 * meta_description. gallery/travelAddress are sent empty on purpose: the
 * backend treats empty arrays as "leave unchanged" (photos live in the media
 * collection; points are carried by coordsMeTravel). Empty text fields go out as
 * `null`: the API rejects a blank STRING but accepts and stores null (#1716).
 */
function buildUpsertPayload(detail, { description, meta } = {}) {
  const d = detail || {};
  return {
    id: d.id,
    name: d.name,
    description: description != null ? description : d.description || '',
    meta_description: meta != null ? meta : d.meta_description,
    year: String(d.year || '2025'),
    categories: d.categories && d.categories.length ? d.categories : [20],
    countries: d.countries && d.countries.length ? d.countries : [160],
    coordsMeTravel: Array.isArray(d.coordsMeTravel) ? d.coordsMeTravel : [],
    travelAddress: [],
    gallery: [],
    transports: d.transports || [],
    month: d.month || [],
    complexity: d.complexity || [],
    companions: d.companions || [],
    over_nights_stay: d.over_nights_stay || [],
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    // Пусто — это `null`, а не сентинел (#1716). `plus`/`minus`/`recommendation`
    // объявлены как `CharField(allow_null=True)` без `allow_blank`, то есть API
    // отвергает пустую СТРОКУ, но `null` принимает и хранит — ровно как у
    // `youtube_link` ниже. Подставляя `__draft_placeholder__`, скрипт писал в
    // изначально пустое поле маркер черновика визарда, от которого потом
    // защищаются `utils/travelFormUtils.ts` и `components/travel/sectionLinks.ts`,
    // а после отката мусор оставался в статье навсегда.
    plus: d.plus || null,
    minus: d.minus || null,
    recommendation: d.recommendation || null,
    // Сентинел здесь не нужен: upsert принимает и хранит `youtube_link: null`
    // (проверено на 583/584). Подставлять его — значит записывать в чистое поле
    // мусор, от которого потом защищаются нормализатор (`api/travelsNormalize.ts`)
    // и `recover-travel-from-ssg.js`; консьюмеры API без нормализации видят его как есть.
    // Пустую строку API не принимает, поэтому «нет видео» — это null, не ''.
    youtube_link: d.youtube_link || null,
    publish: Boolean(d.publish),
    moderation: Boolean(d.moderation),
    visa: Boolean(d.visa),
    number_days: d.number_days != null ? d.number_days : null,
    number_peoples: d.number_peoples != null ? d.number_peoples : null,
    budget: d.budget != null ? d.budget : null,
  };
}

/**
 * Compare the article before/after a write and list unintended regressions.
 * `expectChanged` = true when we DID send a new description (so an unchanged
 * description is itself a regression — the write silently no-op'd).
 */
function detectRegression(before, after, { expectChanged = false, newDescription = null } = {}) {
  const problems = [];
  const b = before || {};
  const a = after || {};
  if (b.publish && !a.publish) problems.push('publish flipped to false');
  if (b.moderation && !a.moderation) problems.push('moderation flipped to false');
  if (b.slug && a.slug && b.slug !== a.slug) problems.push(`slug changed ${b.slug} → ${a.slug}`);
  const bg = (b.gallery || []).length;
  const ag = (a.gallery || []).length;
  if (ag < bg) problems.push(`gallery shrank ${bg} → ${ag}`);
  const bp = (b.coordsMeTravel || []).length;
  const ap = (a.coordsMeTravel || []).length;
  if (ap < bp) problems.push(`points shrank ${bp} → ${ap}`);
  if (expectChanged && newDescription != null) {
    // API may normalise trailing whitespace; compare trimmed versions to avoid
    // false-positive regressions from server-side HTML clean-up.
    const sentTrimmed = newDescription.trim();
    const gotTrimmed = (a.description || '').trim();
    const beforeTrimmed = (b.description || '').trim();
    if (!gotTrimmed) {
      problems.push('description did not persist as written');
    } else if (gotTrimmed === beforeTrimmed && sentTrimmed !== beforeTrimmed) {
      // Write was a silent no-op — API returned the old content unchanged
      problems.push('description did not persist as written');
    } else if (gotTrimmed.length < sentTrimmed.length * 0.8) {
      problems.push(`description shrank unexpectedly: sent ${sentTrimmed.length} chars, got ${gotTrimmed.length}`);
    }
  }
  return problems;
}

/**
 * Text the write MANGLED, as opposed to an article that regressed.
 *
 * #1649: two U+FFFD replacing one Cyrillic letter move the length by a single
 * character, so every guard in detectRegression() above waves it through. This
 * check is separate because its consequence is different: a regression means
 * "roll this article back and move on", corruption means "the read/write path
 * is damaging content — stop the batch before it writes 200 more".
 *
 * `description` is compared by U+FFFD count only, never byte-exact: a rich-text
 * body legitimately comes back normalised, so a byte diff there is not evidence
 * of encoding damage. `meta_description` / `name` are short scalars and are
 * compared verbatim.
 */
function detectCorruption(after, { description = null, meta = null, name = null } = {}) {
  // The re-read did not hand back an article at all: an empty 200, a proxy's
  // HTML error page, a body that did not parse. Every field then looks
  // "missing", and the byte-exact meta/name compare would report corruption —
  // stopping the whole batch, and blaming UTF-8, for a read that simply failed.
  // detectRegression() already covers this shape ("description did not persist
  // as written") and keeps it a per-article rollback.
  if (!after || typeof after !== 'object' || after.id == null) return [];
  return detectStoredTextCorruption(verifiableFields(after, { description, meta, name }));
}

/** Поля круговой проверки. Вынесено, чтобы список не разъехался между двумя вызовами. */
function verifiableFields(after, { description = null, meta = null, name = null } = {}) {
  return [
    { label: 'description', sent: description, stored: after.description },
    { label: 'meta_description', sent: meta, stored: after.meta_description, exact: true },
    { label: 'name', sent: name, stored: after.name, exact: true },
  ];
}

/**
 * Поля, которые записали, но круг замкнуть не смогли: ответ GET не содержит
 * ключа (#1716). Сегодня это ровно `meta_description` — `GET /api/travels/<id>/`
 * не отдаёт его ни у одной статьи, хотя `PUT /travels/upsert/` поле принимает и
 * хранит (`UpsertTravelService.NON_RELATION_FIELDS`). До правки такой ответ
 * считался порчей текста, и откат уносил вместе с метой всё описание.
 */
function detectUnverifiable(after, { description = null, meta = null, name = null } = {}) {
  if (!after || typeof after !== 'object' || after.id == null) return [];
  return findUnverifiableFields(verifiableFields(after, { description, meta, name }));
}

function backupFileName(id, ts) {
  return `${id}-${ts}.json`;
}

// ---------------------------------------------------------------------------
// I/O shell
// ---------------------------------------------------------------------------
function token() {
  let t = process.env.METRAVEL_TOKEN;
  if (!t) {
    const p = path.join(os.homedir(), '.metravel_token');
    if (fs.existsSync(p)) t = fs.readFileSync(p, 'utf8').trim();
  }
  if (!t) {
    console.error('ERROR: set METRAVEL_TOKEN env var or ~/.metravel_token file');
    process.exit(1);
  }
  return t;
}

function request(method, urlPath, data) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${urlPath}`;
    const mod = url.startsWith('https') ? https : http;
    const body = data != null ? Buffer.from(JSON.stringify(data)) : null;
    const opts = {
      method,
      timeout: 60000,
      headers: { Authorization: `Token ${token()}` },
    };
    if (mod === https) opts.rejectUnauthorized = false;
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = body.length;
    }
    opts.headers = withAcceptEncoding(opts.headers);
    const req = mod.request(url, opts, (res) => {
      // #1649: whole body buffered, then decoded once — accumulating
      // `buf += chunk` decoded every transport chunk on its own.
      readResponseText(res).then((text) => resolve({ status: res.statusCode, text }), reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    if (body) req.write(body);
    req.end();
  });
}

async function getTravel(id) {
  const { status, text } = await request('GET', `/travels/${id}/`);
  if (status !== 200) throw new Error(`GET travel ${id} → HTTP ${status}`);
  return JSON.parse(text);
}

async function putTravel(payload) {
  const { status, text } = await request('PUT', '/travels/upsert/', payload);
  return { status, text };
}

function saveBackup(dir, detail) {
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, backupFileName(detail.id, ts));
  fs.writeFileSync(file, JSON.stringify(detail, null, 2), 'utf8');
  return file;
}

function latestBackup(dir, id) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${id}-`) && f.endsWith('.json'))
    .sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

function readFileArg(file) {
  return file ? fs.readFileSync(file, 'utf8') : '';
}

async function restore(id, backupDir) {
  const file = latestBackup(backupDir, id);
  if (!file) {
    console.error(`No backup found for #${id} in ${backupDir}`);
    process.exit(1);
  }
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  const payload = buildUpsertPayload(original, { description: original.description, meta: original.meta_description });
  const { status, text } = await putTravel(payload);
  console.log(`↩️  restore #${id} from ${path.basename(file)} → HTTP ${status}`);
  if (status !== 200 && status !== 201) { console.error(text.slice(0, 400)); process.exit(1); }
  console.log('✅ restored');
}

async function main() {
  // Parsed here, not at module level, so a UsageError reaches runSeoCli() below
  // and a bad invocation exits 2 instead of touching a live article (#1391).
  const args = parseArgs(process.argv);

  const backupDir = args.backupDir;
  if (args.mode === 'restore') return restore(args.restore, backupDir);

  const id = args.id;
  const meta = args.meta;
  const dryRun = args.dryRun;

  const detail = await getTravel(id);
  const oldDesc = detail.description || '';
  const newDesc = composeDescription(oldDesc, {
    prepend: readFileArg(args.prependFile),
    append: readFileArg(args.appendFile),
    replace: args.descFile ? readFileArg(args.descFile) : null,
  });

  console.log(`travel #${detail.id} «${detail.name}»`);
  console.log(`  publish=${detail.publish} moderation=${detail.moderation} ` +
    `gallery=${(detail.gallery || []).length} points=${(detail.coordsMeTravel || []).length}`);
  console.log(`  desc: ${oldDesc.length} → ${newDesc.length} chars (+${newDesc.length - oldDesc.length})`);
  if (meta != null) console.log(`  meta_description: ${JSON.stringify(meta)}`);

  // Отказ ДО записи, а не предупреждение после (#1716). `TravelUpsertSerializer`
  // поле `meta_description` не объявляет, поэтому DRF срезает его на валидации:
  // до `UpsertTravelService.NON_RELATION_FIELDS` доезжает не значение, а его
  // отсутствие. Наличие поля в списке сервиса доказывает намерение, но не приём.
  // Молча писать описание и рапортовать «OK» о невыполненной части просьбы —
  // то же самое враньё, что и откат по ложной тревоге, только тише.
  if (meta != null) {
    console.error('❌ --meta не поддерживается сервером: PUT /travels/upsert/ срезает ' +
      'meta_description на валидации (TravelUpsertSerializer поле не объявляет), ' +
      'и значение до статьи не доезжает.');
    console.error('   Ждёт бэкенд-задачи #1737. Описание правится тем же вызовом без --meta.');
    process.exit(1);
  }

  if (dryRun) { console.log('DRY RUN — nothing written.'); return; }

  const backupFile = saveBackup(backupDir, detail);
  console.log(`  💾 backup → ${path.relative(process.cwd(), backupFile)}`);

  const payload = buildUpsertPayload(detail, { description: newDesc, meta });
  const { status, text } = await putTravel(payload);
  console.log(`  PUT /travels/upsert/ → HTTP ${status}`);
  if (status !== 200 && status !== 201) { console.error(text.slice(0, 500)); process.exit(1); }

  const after = await getTravel(id);
  const unverifiable = detectUnverifiable(after, { description: newDesc, meta });
  const corruption = detectCorruption(after, { description: newDesc, meta });
  if (corruption.length) {
    console.error(`❌ TEXT CORRUPTION: ${corruption.join('; ')}`);
    console.error('   Auto-rolling back to original description…');
    const revert = buildUpsertPayload(detail, { description: oldDesc, meta: detail.meta_description });
    const rb = await putTravel(revert);
    console.error(`   rollback PUT → HTTP ${rb.status}`);
    process.exit(1);
  }
  const problems = detectRegression(detail, after, { expectChanged: newDesc !== oldDesc, newDescription: newDesc });
  if (problems.length) {
    console.error(`❌ REGRESSION: ${problems.join('; ')}`);
    console.error('   Auto-rolling back to original description…');
    const revert = buildUpsertPayload(detail, { description: oldDesc, meta: detail.meta_description });
    const rb = await putTravel(revert);
    console.error(`   rollback PUT → HTTP ${rb.status}`);
    // 1, not 2: under the shared CLI contract 2 means "you called it wrong", and
    // a detected regression is a failed run, not a bad invocation (#1391).
    process.exit(1);
  }
  // Круг проверки не замкнулся: поля нет в ответе GET. Сегодня сюда попасть
  // нельзя — `--meta` отвергается выше, — но список полей сверки ещё вырастет,
  // и следующее непроверяемое поле должно быть названо, а не пропущено молча.
  if (unverifiable.length) {
    console.log(`⚠️  не проверено: ${unverifiable.join(', ')} — ` +
      'API не возвращает это поле в GET /api/travels/<id>/, круговая сверка невозможна');
  }
  console.log(`✅ OK — still published, gallery=${(after.gallery || []).length}, ` +
    `points=${(after.coordsMeTravel || []).length}, desc=${(after.description || '').length} chars`);
}

// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CLI_SPEC,
    USAGE,
    parseArgs,
    composeDescription,
    buildUpsertPayload,
    detectCorruption,
    detectUnverifiable,
    detectRegression,
    backupFileName,
    latestBackup,
    leadIsDuplicate,
    SENTINEL,
  };
}

if (require.main === module) {
  runSeoCli(main, { name: 'seo-edit', usage: USAGE });
}
