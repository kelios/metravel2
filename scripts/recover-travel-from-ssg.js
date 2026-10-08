#!/usr/bin/env node
/**
 * Recover a travel whose content was wiped (e.g. by a blank autosave hitting the
 * full-replace `PUT /travels/upsert/`) back to the last state captured in the
 * public SSG page.
 *
 * WHY THIS WORKS
 *   The public page `https://metravel.by/travels/<slug>` is pre-rendered and
 *   embeds the FULL travel JSON in `window.__metravelTravelPreload`. That HTML is
 *   built at deploy/render time, so if the wipe is newer than the last render the
 *   snapshot still holds the original description, points and metadata. See the
 *   2026-07-21 travel 641 incident.
 *
 * WHAT IT RESTORES
 *   - description / plus / minus / recommendation / youtube_link (from snapshot)
 *   - year / month / number_days + name / slug
 *   - route points (coordsMeTravel): lat/lng/address/categories/country, and the
 *     ORIGINAL point image path. Point files usually survive the row deletion on
 *     disk; the /address-image/<path> endpoint resolves by the row's `image`
 *     field, so recreating a row with the original path re-serves the photo.
 *
 * WHAT IT CANNOT RESTORE (not present in the public JSON)
 *   - travel-level m2m: categories / transports / complexity of the ROUTE itself
 *     (point categories ARE restored). Re-pick these in the wizard.
 *   - companions / over_nights_stay / number_peoples / visa / budget — kept from
 *     the CURRENT server record (pass --keep-current, default) or overridden via
 *     flags. Nothing is invented.
 *
 * SAFETY
 *   - Never invents data. Fields absent from the snapshot are taken from the live
 *     record (so an already-partially-fixed record is not regressed).
 *   - --dry-run (default) writes a report and prints a field-by-field diff; it
 *     performs NO write.
 *   - --apply saves a JSON backup of the live record, PUTs, then re-verifies via
 *     GET (description length, point count, point image HTTP 200).
 *   - publish / moderation are preserved from the live record unless overridden.
 *
 * USAGE
 *   node scripts/recover-travel-from-ssg.js <idOrSlug> [--dry-run|--apply] \
 *        [--participants N] [--visa true|false] [--overnight 4] [--companions 9]
 *
 *   Token: env METRAVEL_TOKEN or ~/.metravel_token (same as seo-edit.js).
 */

const { bodyMaintenanceSession, publicRequest, TokenError, formatTokenError, parseResponseJson  } = require('./lib/metravel-tool-session');
const fs = require('fs');
const path = require('path');

const ORIGIN = (process.env.METRAVEL_ORIGIN || 'https://metravel.by').replace(/\/+$/, '');
const API = `${ORIGIN}/api`;
const REPORT_DIR = path.join(__dirname, '.recover-ssg');

// ---------- args ----------
const args = process.argv.slice(2);
const positionals = args.filter((a) => !a.startsWith('--'));
const has = (n) => args.includes(`--${n}`);
const getArg = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const TARGET = positionals[0];
const APPLY = has('apply');
const DRY = !APPLY; // dry-run is the default; --apply required to write

if (!TARGET) {
  console.error('Usage: node scripts/recover-travel-from-ssg.js <idOrSlug> [--apply]');
  process.exit(1);
}

// ---------- token / http ----------


async function fetchRaw(url, { auth = false } = {}) {
 const response = await (auth ? bodyMaintenanceSession({ origin: API }).request(url) : publicRequest(API, url));
 return { status: response.status, text: await response.text() };
}

async function headStatus(url) {
  try { return (await publicRequest(API, url)).status; } catch { return -1; }
}

async function put(urlPath, data) {
 const response = await bodyMaintenanceSession({ origin: API }).request(`${API}${urlPath}`, { method: 'PUT', json: data });
 return { status: response.status, text: await response.text() };
}

// ---------- SSG preload extraction ----------
function extractPreload(html) {
  const marker = 'window.__metravelTravelPreload=';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length;
  let depth = 0, inStr = false, esc = false;
  const from = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  try {
    const obj = JSON.parse(html.slice(from, i));
    return obj.data || obj;
  } catch {
    return null;
  }
}

const round6 = (n) => Math.round(Number(n) * 1e6) / 1e6;

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // 1) live record (authed) — source of truth for id, publish/moderation, and
  //    any field the snapshot lacks.
  const live = await fetchRaw(`${API}/travels/${encodeURIComponent(TARGET)}/`, { auth: true });
  if (live.status !== 200) throw new TokenError('response');
  const cur = parseResponseJson(live.text);
  const slug = cur.slug || TARGET;

  // 2) SSG snapshot from the public page
  const page = await fetchRaw(`${ORIGIN}/travels/${encodeURIComponent(slug)}`);
  if (page.status !== 200) throw new TokenError('response');
  const snap = extractPreload(page.text);
  if (!snap) throw new Error('Could not find window.__metravelTravelPreload in the SSG page (maybe re-rendered after the wipe).');

  const pickText = (k) => {
    const v = snap[k];
    return typeof v === 'string' && v.trim() && v.trim() !== '__draft_placeholder__' ? v : (cur[k] ?? null);
  };

  // 3) points: match snapshot point image onto the live point (by lat) so we keep
  //    the live row id (stable) but restore the original image path.
  const snapImgByLat = {};
  (snap.coordsMeTravel || []).forEach((p) => { snapImgByLat[round6(p.lat)] = p.image || ''; });

  const sourcePoints = (cur.coordsMeTravel && cur.coordsMeTravel.length)
    ? cur.coordsMeTravel
    : (snap.coordsMeTravel || []).map((p) => ({ ...p, id: null }));

  const points = sourcePoints.map((p) => ({
    id: p.id ?? null,
    lat: p.lat,
    lng: p.lng,
    country: p.country != null ? p.country : 3,
    address: p.address,
    categories: Array.isArray(p.categories) ? p.categories : [],
    image: (p.image && String(p.image).trim()) ? p.image : (snapImgByLat[round6(p.lat)] || ''),
  }));

  const num = (v) => (v == null || v === '' ? '' : String(v));
  const payload = {
    id: cur.id,
    name: pickText('name'),
    slug: cur.slug || snap.slug,
    description: pickText('description'),
    plus: pickText('plus'),
    minus: pickText('minus'),
    recommendation: pickText('recommendation'),
    youtube_link: pickText('youtube_link'),
    year: num(snap.year != null ? snap.year : cur.year),
    month: Array.isArray(snap.month) && snap.month.length ? snap.month : (cur.month || []),
    number_days: num(snap.number_days != null ? snap.number_days : cur.number_days),
    number_peoples: num(getArg('participants', cur.number_peoples)),
    visa: has('visa') ? getArg('visa', 'false') === 'true' : Boolean(cur.visa),
    budget: num(cur.budget),
    companions: has('companions') ? [Number(getArg('companions'))] : (cur.companions || []),
    over_nights_stay: has('overnight') ? [Number(getArg('overnight'))] : (cur.over_nights_stay || []),
    countries: cur.countries && cur.countries.length ? cur.countries
      : [...new Set(points.map((p) => p.country).filter((c) => c && c !== 3))],
    categories: cur.categories || [],       // route-level m2m absent from snapshot
    transports: cur.transports || [],
    complexity: cur.complexity || [],
    coordsMeTravel: points,
    publish: Boolean(cur.publish),
    moderation: Boolean(cur.moderation),
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    enforce_moderation_validation: false,
  };

  const report = {
    target: TARGET, slug, apply: APPLY,
    diff: {
      description: { live: (cur.description || '').length, snapshot: (payload.description || '').length },
      points: { live: (cur.coordsMeTravel || []).length, restored: points.length },
      pointsWithImage: points.filter((p) => p.image).length,
      year: { live: cur.year, restored: payload.year },
      month: { live: cur.month, restored: payload.month },
    },
    unrecoverable: ['categories/transports/complexity (route-level) — re-pick in wizard if empty'],
  };
  const reportFile = path.join(REPORT_DIR, `${cur.id}-${APPLY ? 'apply' : 'dryrun'}.json`);
  fs.writeFileSync(reportFile, JSON.stringify({ report, payload }, null, 2), 'utf8');

  console.log(`\n== recover travel ${cur.id} (${slug}) ==`);
  console.log(`description: live ${report.diff.description.live} → snapshot ${report.diff.description.snapshot} chars`);
  console.log(`points:      live ${report.diff.points.live} → restored ${report.diff.points.restored} (${report.diff.pointsWithImage} with image)`);
  console.log(`year/month:  ${JSON.stringify(payload.year)} / ${JSON.stringify(payload.month)}`);
  console.log(`report:      ${reportFile}`);

  if (report.diff.description.snapshot < report.diff.description.live) {
    console.log('\n⚠ snapshot description is SHORTER than live — the SSG page may be stale/re-rendered. Inspect the report before --apply.');
  }

  if (DRY) {
    console.log('\nDRY-RUN: no write performed. Re-run with --apply to restore.');
    return;
  }

  // backup live record
  const backupFile = path.join(REPORT_DIR, `${cur.id}-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(cur, null, 2), 'utf8');
  console.log(`\nbackup:      ${backupFile}`);

  const res = await put('/travels/upsert/', payload);
  console.log(`PUT upsert:  HTTP ${res.status}`);
  if (res.status < 200 || res.status >= 300) {
    console.error(formatTokenError(new TokenError('response', { status: res.status })));
    throw new Error('upsert failed — live record unchanged beyond what the server applied; backup saved.');
  }

  // verify
  const after = parseResponseJson((await fetchRaw(`${API}/travels/${cur.id}/`, { auth: true })).text);
  const imgChecks = [];
  for (const p of after.coordsMeTravel || []) {
    if (p.image) imgChecks.push({ id: p.id, status: await headStatus(p.image) });
  }
  console.log(`\nVERIFY:`);
  console.log(`  description: ${(after.description || '').length} chars`);
  console.log(`  points:      ${(after.coordsMeTravel || []).length}`);
  console.log(`  point images: ${imgChecks.filter((c) => c.status === 200).length}/${imgChecks.length} serve HTTP 200`);
  const bad = imgChecks.filter((c) => c.status !== 200);
  if (bad.length) console.log(`  ⚠ missing image files (row restored but file gone): ${bad.map((b) => b.id).join(', ')}`);
  console.log('\nDone.');
}

main().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
