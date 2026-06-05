#!/usr/bin/env node
/**
 * Safe editor for LIVE published travels on metravel.by.
 *
 * Unlike the draft engine (metravel_publish.py), this never knocks an article
 * offline: it echoes back every real field from GET and changes ONLY the
 * description (lead / appended blocks) and the meta_description field. Safety
 * rails:
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
 * Usage:
 *   node scripts/seo-edit.js --id 169 --prepend-file lead.html --append-file blocks.html [--meta "…"]
 *   node scripts/seo-edit.js --id 169 --desc-file full.html          # replace whole body
 *   node scripts/seo-edit.js --id 169 --dry-run                      # show plan, write nothing
 *   node scripts/seo-edit.js --restore 169                           # revert from latest backup
 *
 * Token: env METRAVEL_TOKEN or ~/.metravel_token.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '');
const SENTINEL = '__draft_placeholder__'; // app's "empty" marker; API rejects blank strings
const DEFAULT_BACKUP_DIR = path.join(__dirname, '.seo-backups');

// ---------------------------------------------------------------------------
// Pure core (exported for tests)
// ---------------------------------------------------------------------------

/** Build the new description body from the original + lead/append/replace parts. */
function composeDescription(oldDesc, { prepend = '', append = '', replace = null } = {}) {
  if (replace != null) return String(replace);
  let out = String(oldDesc || '');
  const lead = String(prepend || '').trim();
  const tail = String(append || '').trim();
  if (lead) out = `${lead}\n${out.replace(/^\s+/, '')}`;
  if (tail) out = `${out.replace(/\s+$/, '')}\n${tail}`;
  return out;
}

/**
 * Echo every real field from the GET detail; override only description +
 * meta_description. gallery/travelAddress are sent empty on purpose: the
 * backend treats empty arrays as "leave unchanged" (photos live in the media
 * collection; points are carried by coordsMeTravel). Empty text fields fall
 * back to the sentinel because the API rejects blank values.
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
    plus: d.plus || SENTINEL,
    minus: d.minus || SENTINEL,
    recommendation: d.recommendation || SENTINEL,
    youtube_link: d.youtube_link || SENTINEL,
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
  if (expectChanged && newDescription != null && (a.description || '') !== newDescription) {
    problems.push('description did not persist as written');
  }
  return problems;
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
    const req = mod.request(url, opts, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, text: buf }));
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

function getArg(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
function hasFlag(args, name) {
  return args.includes(`--${name}`);
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
  const args = process.argv.slice(2);
  const backupDir = getArg(args, 'backup-dir', DEFAULT_BACKUP_DIR);

  const restoreId = getArg(args, 'restore', null);
  if (restoreId) return restore(restoreId, backupDir);

  const id = getArg(args, 'id', null);
  if (!id) { console.error('ERROR: --id is required'); process.exit(1); }
  const meta = getArg(args, 'meta', null);
  const dryRun = hasFlag(args, 'dry-run');

  const detail = await getTravel(id);
  const oldDesc = detail.description || '';
  const newDesc = composeDescription(oldDesc, {
    prepend: readFileArg(getArg(args, 'prepend-file', '')),
    append: readFileArg(getArg(args, 'append-file', '')),
    replace: getArg(args, 'desc-file', '') ? readFileArg(getArg(args, 'desc-file', '')) : null,
  });

  console.log(`travel #${detail.id} «${detail.name}»`);
  console.log(`  publish=${detail.publish} moderation=${detail.moderation} ` +
    `gallery=${(detail.gallery || []).length} points=${(detail.coordsMeTravel || []).length}`);
  console.log(`  desc: ${oldDesc.length} → ${newDesc.length} chars (+${newDesc.length - oldDesc.length})`);
  if (meta != null) console.log(`  meta_description: ${JSON.stringify(meta)}`);

  if (dryRun) { console.log('DRY RUN — nothing written.'); return; }

  const backupFile = saveBackup(backupDir, detail);
  console.log(`  💾 backup → ${path.relative(process.cwd(), backupFile)}`);

  const payload = buildUpsertPayload(detail, { description: newDesc, meta });
  const { status, text } = await putTravel(payload);
  console.log(`  PUT /travels/upsert/ → HTTP ${status}`);
  if (status !== 200 && status !== 201) { console.error(text.slice(0, 500)); process.exit(1); }

  const after = await getTravel(id);
  const problems = detectRegression(detail, after, { expectChanged: newDesc !== oldDesc, newDescription: newDesc });
  if (problems.length) {
    console.error(`❌ REGRESSION: ${problems.join('; ')}`);
    console.error('   Auto-rolling back to original description…');
    const revert = buildUpsertPayload(detail, { description: oldDesc, meta: detail.meta_description });
    const rb = await putTravel(revert);
    console.error(`   rollback PUT → HTTP ${rb.status}`);
    process.exit(2);
  }
  console.log(`✅ OK — still published, gallery=${(after.gallery || []).length}, ` +
    `points=${(after.coordsMeTravel || []).length}, desc=${(after.description || '').length} chars`);
}

// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    composeDescription,
    buildUpsertPayload,
    detectRegression,
    backupFileName,
    latestBackup,
    SENTINEL,
  };
}

if (require.main === module) {
  main().catch((err) => { console.error('❌ Fatal:', err.message); process.exit(1); });
}
