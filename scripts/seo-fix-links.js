#!/usr/bin/env node
/**
 * Rewrite stale internal travel links sitewide.
 *
 * After scripts/seo-rename.js changes a title (and therefore slug), every other
 * article that linked to the OLD slug now points through a 301 redirect hop.
 * This tool reads scripts/seo-redirects.json and, for each published travel of
 * an author, replaces `…/travels/{oldSlug}` → `…/travels/{newSlug}` in the body
 * (both relative `/travels/x` and absolute `https://metravel.by/travels/x`), then
 * PUTs only when something changed. Echoes every other field via
 * buildUpsertPayload (publish/moderation/gallery/points preserved) with a backup
 * + post-write verification + auto-rollback on regression.
 *
 * Usage:
 *   node scripts/seo-fix-links.js --user-id 1 --dry-run
 *   node scripts/seo-fix-links.js --user-id 1
 *   node scripts/seo-fix-links.js --restore <id>
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

function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${urlPath}`;
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function listTravels(userId) {
  const where = encodeURIComponent(JSON.stringify({ user_id: userId, publish: 1, moderation: 1 }));
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const res = await getJson(`/travels/?where=${where}&page=${page}&perPage=100`);
    const rows = res.data || res.items || res.rows || (Array.isArray(res) ? res : []);
    if (!rows.length) break;
    out.push(...rows);
  }
  return out;
}

function loadSlugMap() {
  const parsed = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const list = Array.isArray(parsed) ? parsed : parsed.redirects || [];
  const map = new Map();
  for (const r of list) if (r && r.from && r.to && r.from !== r.to) map.set(r.from, r.to);
  return map;
}

/** Replace every `/travels/{old}` occurrence (relative or absolute) with new
 *  slug. Returns { html, count } — count = number of links rewritten. */
function rewriteLinks(html, slugMap) {
  let count = 0;
  const out = String(html || '').replace(/(\/travels\/)([a-z0-9-]+)/g, (m, prefix, slug) => {
    const to = slugMap.get(slug);
    if (!to) return m;
    count++;
    return `${prefix}${to}`;
  });
  return { html: out, count };
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

/**
 * Success = the targeted stale links are gone and the body survived. The backend
 * sanitizes HTML on save (re-encodes entities / reorders attrs), so a byte-exact
 * compare to what we sent yields false regressions — instead assert outcome:
 * no old slug remains as a link AND the description didn't collapse.
 */
function detectRegression(before, after, slugMap) {
  const problems = [];
  if (before.slug && after.slug && before.slug !== after.slug) problems.push(`slug changed ${before.slug} → ${after.slug}`);
  if (before.publish && !after.publish) problems.push('publish flipped to false');
  if (before.moderation && !after.moderation) problems.push('moderation flipped to false');
  if ((after.gallery || []).length < (before.gallery || []).length) problems.push('gallery shrank');
  if ((after.coordsMeTravel || []).length < (before.coordsMeTravel || []).length) problems.push('points shrank');
  const afterDesc = (after.description || '').trim();
  const beforeLen = (before.description || '').trim().length;
  if (afterDesc.length < Math.floor(beforeLen * 0.9)) problems.push(`description shrank ${beforeLen} → ${afterDesc.length}`);
  const remaining = rewriteLinks(afterDesc, slugMap).count;
  if (remaining > 0) problems.push(`${remaining} stale link(s) still present after write`);
  return problems;
}

async function restore(id) {
  const file = latestBackup(id);
  if (!file) { console.error(`No backup for #${id}`); process.exit(1); }
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  const payload = buildUpsertPayload(original, { description: original.description, meta: original.meta_description });
  const { status, text } = await request('PUT', '/travels/upsert/', payload);
  console.log(`↩️  restore #${id} → HTTP ${status}`);
  if (status !== 200 && status !== 201) { console.error(text.slice(0, 300)); process.exit(1); }
}

async function main() {
  const args = process.argv.slice(2);
  const restoreId = getArg(args, 'restore', null);
  if (restoreId) return restore(restoreId);

  const userId = getArg(args, 'user-id', '1');
  const dryRun = hasFlag(args, 'dry-run');
  const slugMap = loadSlugMap();
  if (!slugMap.size) { console.error('Manifest has no redirects — nothing to fix'); process.exit(0); }

  console.log(`${dryRun ? '🧪 DRY-RUN ' : '🔗 '}Fixing stale internal links (${slugMap.size} renamed slugs) for user ${userId} via ${API_BASE}\n`);
  const travels = await listTravels(userId);
  console.log(`Scanning ${travels.length} published travels…\n`);

  let changed = 0, totalLinks = 0, failed = 0;
  for (const t of travels) {
    let detail;
    try {
      detail = await getJson(`/travels/${t.id}/`);
    } catch (e) {
      console.warn(`  ⚠️  #${t.id} GET failed: ${e.message}`);
      continue;
    }
    const { html, count } = rewriteLinks(detail.description || '', slugMap);
    if (!count) continue;
    totalLinks += count;
    if (dryRun) {
      console.log(`  [dry] #${t.id} «${(detail.name || '').slice(0, 40)}» — ${count} link(s)`);
      changed++;
      continue;
    }
    const backup = saveBackup(detail);
    const payload = buildUpsertPayload(detail, { description: html, meta: detail.meta_description });
    const { status, text } = await request('PUT', '/travels/upsert/', payload);
    if (status !== 200 && status !== 201) {
      console.error(`  ❌ #${t.id} PUT → HTTP ${status}: ${text.slice(0, 150)}`);
      failed++;
      continue;
    }
    let after;
    try { after = await getJson(`/travels/${t.id}/`); } catch { after = {}; }
    const problems = detectRegression(detail, after, slugMap);
    if (problems.length) {
      console.error(`  ⛔ #${t.id} regression: ${problems.join('; ')} — rolling back (${path.basename(backup)})`);
      await restore(t.id);
      failed++;
      continue;
    }
    console.log(`  ✅ #${t.id} «${(detail.name || '').slice(0, 40)}» — ${count} link(s) rewritten`);
    changed++;
  }

  console.log(`\n${dryRun ? 'Dry-run' : 'Done'}: ${changed} article(s), ${totalLinks} link(s)${failed ? `, ${failed} failed` : ''}.`);
}

if (require.main === module) {
  main().catch((err) => { console.error('❌ Fatal:', err.message); process.exit(1); });
}

module.exports = { rewriteLinks, detectRegression };
