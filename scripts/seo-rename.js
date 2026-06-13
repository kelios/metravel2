#!/usr/bin/env node
/**
 * Safe title (name) renamer for published travels — the ONE flow allowed to
 * change a travel's slug, because it pairs every rename with a 301 redirect.
 *
 * Why a separate tool from seo-edit.js: seo-edit treats a slug change as a
 * regression and auto-rolls-back. Renaming a title intentionally changes the
 * slug (backend `_set_name_and_slug`), so it needs its own guardrails.
 *
 * For each {id, name}:
 *   1. GET /api/travels/{id}/ and BACK UP the full detail.
 *   2. PUT /api/travels/upsert/ with the new name; every other field is echoed
 *      via buildUpsertPayload (publish/moderation/description/gallery/points
 *      preserved exactly as seo-edit does).
 *   3. VERIFY the re-GET: name applied, slug actually changed, publish &
 *      moderation still true, gallery/points did not shrink, description length
 *      preserved. On any regression → PUT the original back and skip the entry.
 *   4. Record {from: oldSlug, to: newSlug} into scripts/seo-redirects.json so
 *      generate-seo-pages.js emits a soft-301 stub for the old URL.
 *
 * Usage:
 *   node scripts/seo-rename.js --map-file scripts/.seo-renames.json --dry-run
 *   node scripts/seo-rename.js --map-file scripts/.seo-renames.json
 *   node scripts/seo-rename.js --id 186 --name "Новый заголовок"
 *   node scripts/seo-rename.js --restore 186      # roll back from last backup
 *
 * Token: METRAVEL_TOKEN env or ~/.metravel_token (never logged).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { buildUpsertPayload } = require('./seo-edit');

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by').replace(/\/+$/, '') + '/api';
const BACKUP_DIR = path.join(__dirname, '.seo-backups');
const MANIFEST = path.join(__dirname, 'seo-redirects.json');

function getArg(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

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
    const opts = { method, timeout: 60000, headers: { Authorization: `Token ${token()}` } };
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

function saveBackup(detail) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIR, `${detail.id}-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(detail, null, 2), 'utf8');
  return file;
}

function latestBackup(id) {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith(`${id}-`) && f.endsWith('.json')).sort();
  return files.length ? path.join(BACKUP_DIR, files[files.length - 1]) : null;
}

/** Compare before/after; return list of regressions (empty = clean rename). */
function detectRegression(before, after, newName) {
  const problems = [];
  if ((after.name || '').trim() !== newName.trim()) problems.push(`name not applied (got "${after.name}")`);
  if (before.slug && after.slug && before.slug === after.slug) problems.push('slug did NOT change');
  if (before.publish && !after.publish) problems.push('publish flipped to false');
  if (before.moderation && !after.moderation) problems.push('moderation flipped to false');
  const bg = (before.gallery || []).length, ag = (after.gallery || []).length;
  if (ag < bg) problems.push(`gallery shrank ${bg} → ${ag}`);
  const bp = (before.coordsMeTravel || []).length, ap = (after.coordsMeTravel || []).length;
  if (ap < bp) problems.push(`points shrank ${bp} → ${ap}`);
  const bd = (before.description || '').trim().length, ad = (after.description || '').trim().length;
  if (bd > 0 && ad < Math.floor(bd * 0.95)) problems.push(`description shrank ${bd} → ${ad} chars`);
  return problems;
}

function readManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : { redirects: [] };
  } catch {
    return { redirects: [] };
  }
}

function appendRedirects(pairs) {
  const manifest = readManifest();
  if (!Array.isArray(manifest.redirects)) manifest.redirects = [];
  const seen = new Set(manifest.redirects.map((r) => r && r.from));
  for (const { from, to } of pairs) {
    if (!from || !to || from === to || seen.has(from)) continue;
    manifest.redirects.push({ from, to });
    seen.add(from);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

async function restoreFromBackup(id) {
  const file = latestBackup(id);
  if (!file) { console.error(`No backup for #${id}`); process.exit(1); }
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  const payload = buildUpsertPayload(original, { description: original.description, meta: original.meta_description });
  payload.name = original.name;
  const { status, text } = await putTravel(payload);
  console.log(`↩️  restore #${id} «${original.name}» → HTTP ${status}`);
  if (status !== 200 && status !== 201) { console.error(text.slice(0, 300)); process.exit(1); }
}

async function renameOne({ id, name }, dryRun) {
  const before = await getTravel(id);
  if ((before.name || '').trim() === name.trim()) {
    console.log(`  ⏭️  #${id} already named as requested — skipped`);
    return null;
  }
  const oldSlug = before.slug;
  if (dryRun) {
    console.log(`  [dry] #${id} "${before.name}" (slug ${oldSlug})\n        → "${name}"`);
    return null;
  }
  const backup = saveBackup(before);
  const payload = buildUpsertPayload(before, { description: before.description, meta: before.meta_description });
  payload.name = name;
  const { status, text } = await putTravel(payload);
  if (status !== 200 && status !== 201) {
    console.error(`  ❌ #${id} PUT → HTTP ${status}: ${text.slice(0, 200)}`);
    return null;
  }
  const after = await getTravel(id);
  const problems = detectRegression(before, after, name);
  if (problems.length) {
    console.error(`  ⛔ #${id} regression: ${problems.join('; ')} — rolling back (backup ${path.basename(backup)})`);
    await restoreFromBackup(id);
    return null;
  }
  console.log(`  ✅ #${id} "${name}"  slug ${oldSlug} → ${after.slug}  (pub=${after.publish}, gal=${(after.gallery || []).length}, pts=${(after.coordsMeTravel || []).length}, desc=${(after.description || '').length})`);
  return { from: oldSlug, to: after.slug };
}

async function main() {
  const args = process.argv.slice(2);
  const restoreId = getArg(args, 'restore', null);
  if (restoreId) return restoreFromBackup(restoreId);

  const dryRun = hasFlag(args, 'dry-run');
  let entries;
  const mapFile = getArg(args, 'map-file', null);
  if (mapFile) {
    const data = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
    entries = Array.isArray(data) ? data : data.renames || [];
  } else {
    const id = getArg(args, 'id', null);
    const name = getArg(args, 'name', null);
    if (!id || !name) { console.error('ERROR: provide --map-file or --id + --name'); process.exit(1); }
    entries = [{ id, name }];
  }
  entries = entries.filter((e) => e && e.id && e.name);
  console.log(`${dryRun ? '🧪 DRY-RUN ' : '✏️  '}Renaming ${entries.length} travel(s) via ${API_BASE}\n`);

  const pairs = [];
  for (const e of entries) {
    try {
      const pair = await renameOne(e, dryRun);
      if (pair) pairs.push(pair);
    } catch (err) {
      console.error(`  ❌ #${e.id}: ${err.message}`);
    }
  }

  if (!dryRun && pairs.length) {
    appendRedirects(pairs);
    console.log(`\n📝 Added ${pairs.length} redirect(s) to ${path.relative(process.cwd(), MANIFEST)}`);
  }
  console.log(`\n${dryRun ? 'Dry-run complete.' : `Done: ${pairs.length} renamed + redirected.`}`);
}

if (require.main === module) {
  main().catch((err) => { console.error('❌ Fatal:', err.message); process.exit(1); });
}

module.exports = { detectRegression, appendRedirects, readManifest };
