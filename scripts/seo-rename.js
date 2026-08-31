#!/usr/bin/env node
/**
 * Safe title (name) renamer for published travels — the ONE flow allowed to
 * change a travel's slug, because it verifies the rewrite and records the
 * old→new pair the rest of the SEO tooling reads.
 *
 * Where the 301 actually comes from: the BACKEND, not this script.
 * `Travel.save()` (../metravel-backend/travels/models.py:610-631) writes a
 * `TravelSlugRedirect` unconditionally whenever the slug changes, so the PUT in
 * step 2 already leaves the old URL answering a real 301 — before step 3 runs,
 * and regardless of whether steps 3-4 succeed at all. The public route serves
 * that alias while the travel stays published and moderated
 * (travels/views_public.py:23-29) — which is what step 3 re-checks. #1083 is
 * explicit that a frontend static stub is NOT a production redirect, so do not
 * diagnose a «lost redirect» here without checking the backend alias first: an
 * earlier version of this very docstring caused exactly that misdiagnosis
 * (docs/PROBLEM_MEMORY.md → SEO-SSR-001).
 *
 * Why a separate tool from seo-edit.js: seo-edit treats a slug change as a
 * regression and auto-rolls-back. Renaming a title intentionally changes the
 * slug (backend `_set_name_and_slug`), so it needs its own guardrails.
 *
 * For each {id, name}:
 *   1. GET /api/travels/{id}/ and BACK UP the full detail.
 *   2. PUT /api/travels/upsert/ with the new name; every other field is echoed
 *      via buildUpsertPayload (publish/moderation/description/gallery/points
 *      preserved exactly as seo-edit does). The backend records the slug alias
 *      here, as part of this write.
 *   3. VERIFY the re-GET: name applied, slug actually changed, publish &
 *      moderation still true, gallery/points did not shrink, description length
 *      preserved. On any regression → PUT the original back and skip the entry.
 *   4. Record {from: oldSlug, to: newSlug} into scripts/seo-redirects.json.
 *      Bookkeeping, not the redirect: seo-fix-links.js reads it to rewrite
 *      internal links off the old slug, generate-seo-pages.js emits a
 *      crawl-facing soft-301 stub from it, and report-travel-404.js reads it to
 *      tell a known pair from a fresh 404 candidate. The manifest is knowingly
 *      incomplete — seo-alias-backfill.js never writes it and several backend
 *      migrations created aliases directly — so it is not a census of live
 *      aliases.
 *
 * `--help` prints USAGE below; the arguments themselves go through the shared SEO
 * CLI contract (#1391), so a mistyped `--dry-runn` is a usage error instead of a
 * real write to production.
 *
 * Token: METRAVEL_TOKEN env or ~/.metravel_token (never logged).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { buildUpsertPayload, detectCorruption } = require('./seo-edit');
const { readResponseText, withAcceptEncoding } = require('./lib/httpText');
const { TextCorruptionError, isTextCorruptionError } = require('./lib/textIntegrity');
const {
  ExpectedFailureError,
  UsageError,
  parseCliArgs,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runSeoCli,
} = require('./lib/seo-cli-contract');

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by').replace(/\/+$/, '') + '/api';
const BACKUP_DIR = path.join(__dirname, '.seo-backups');
const MANIFEST = path.join(__dirname, 'seo-redirects.json');

const USAGE = `Safe title renamer with paired 301 redirects — metravel.by

Usage:
  node scripts/seo-rename.js <input> [options]

Input sets (exactly one is required — the script never picks the travels for you):
  --map-file <path>     rename every {id, name} entry listed in a JSON file
  --id <id>             rename a single travel; needs --name
  --restore <id>        roll one travel back from its most recent backup

Options:
  --name <title>        the new title, only together with --id
  --dry-run             print what would change, write nothing
  --help, -h            print this help and exit

Examples:
  node scripts/seo-rename.js --map-file scripts/.seo-renames.json --dry-run
  node scripts/seo-rename.js --map-file scripts/.seo-renames.json
  node scripts/seo-rename.js --id 186 --name "Новый заголовок"
  node scripts/seo-rename.js --restore 186`;

/**
 * Renaming rewrites a live slug, so "no input" must never resolve to a default
 * batch: the input set is declared as a mode and the parser refuses to run until
 * exactly one of them is named.
 */
const CLI_SPEC = {
  name: 'seo-rename',
  usage: USAGE,
  selection: 'renames',
  flags: {
    'map-file': { type: 'string', valueName: 'a path' },
    id: { type: 'string', valueName: 'a travel id' },
    name: {
      type: 'string',
      valueName: 'a title',
      // Titles legitimately open with a dash: «-40 °C: зимний Байкал».
      allowLeadingDash: true,
      requiresMode: 'id',
      reason: 'a map file carries its own names',
    },
    restore: { type: 'string', valueName: 'a travel id' },
    'dry-run': {
      type: 'boolean',
      // `--restore 186 --dry-run` used to swallow the rehearsal flag and PUT for
      // real — the same ignored-flag shape already closed in seo-edit.js (#1391).
      forbiddenModes: ['restore'],
      reason: 'a restore always writes',
    },
  },
  modes: {
    flags: ['map-file', 'id', 'restore'],
    label: 'input sets',
    missing:
      'No input given: pass --map-file <path>, --id <id> --name <title> or --restore <id>',
  },
};

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

/**
 * Схлопывает цепочки `A → B → C` в `A → C`.
 *
 * Статью, которую уже переименовывали, следующая волна переименовывает снова, и
 * её прежний редирект начинает указывать на промежуточный slug: пользователь и
 * краулер проходят два прыжка, а канонический адрес размывается. Одна волна
 * (#1228) дала две такие пары, следующая (#1229) — ещё четыре, поэтому чистка
 * встроена в сам добавляющий шаг, а не делается руками после каждого прогона.
 * Инвариант проверяет тест «never redirects a slug onto itself and never chains».
 */
function collapseRedirectChains(redirects) {
  const byFrom = new Map(redirects.map((r) => [r.from, r]));
  for (const entry of redirects) {
    const visited = new Set([entry.from]);
    while (byFrom.has(entry.to) && !visited.has(entry.to)) {
      visited.add(entry.to);
      entry.to = byFrom.get(entry.to).to;
    }
  }
  return redirects;
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
  manifest.redirects = collapseRedirectChains(manifest.redirects).filter((r) => r.from !== r.to);
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/**
 * The single wording for «the rollback did not land, so production may still be
 * serving the new title». Both rollback branches in renameOne() report it and
 * each is pinned by its own test, so two copies let an edit to one go green
 * while silently diverging from the other.
 */
const liveWarning = (name, backup, reason) =>
  `rollback FAILED (${reason}) — «${name}» may still be live, restore from ${path.basename(backup)}`;

/**
 * Roll one travel back from its latest backup.
 *
 * `exitOnFailure` is the CLI `--restore` contract: an operator who asked for a
 * restore wants the process to die loudly when it did not happen. Inside a
 * batch the caller needs the outcome instead — exiting there swallows the very
 * message that names which article is still live under the wrong title.
 *
 * @returns {Promise<{ok: boolean, status: number, reason?: string}>}
 */
async function restoreFromBackup(id, { exitOnFailure = true } = {}) {
  const file = latestBackup(id);
  if (!file) {
    console.error(`No backup for #${id}`);
    if (exitOnFailure) process.exit(1);
    return { ok: false, status: 0, reason: 'no backup on disk' };
  }
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  const payload = buildUpsertPayload(original, { description: original.description, meta: original.meta_description });
  payload.name = original.name;
  const { status, text } = await putTravel(payload);
  console.log(`↩️  restore #${id} «${original.name}» → HTTP ${status}`);
  if (status !== 200 && status !== 201) {
    console.error(text.slice(0, 300));
    if (exitOnFailure) process.exit(1);
    return { ok: false, status, reason: `HTTP ${status}` };
  }
  return { ok: true, status };
}

/**
 * One rename.
 *
 * Returns an outcome rather than `null`, because `null` used to mean four
 * different things — «already named», «rehearsal», «PUT refused» and «rolled
 * back after a regression» — and the caller could not tell the two failures
 * from the two successes. That is how a batch in which every entry failed still
 * exited 0.
 *
 * `abort` is set when the entry left production in a state the next entry must
 * not be written on top of; the caller stops the batch on it.
 *
 * @returns {Promise<{outcome: 'renamed'|'skipped'|'failed', pair?: {from: string, to: string}, abort?: string}>}
 */
async function renameOne({ id, name }, dryRun) {
  const before = await getTravel(id);
  if ((before.name || '').trim() === name.trim()) {
    console.log(`  ⏭️  #${id} already named as requested — skipped`);
    return { outcome: 'skipped' };
  }
  const oldSlug = before.slug;
  if (dryRun) {
    console.log(`  [dry] #${id} "${before.name}" (slug ${oldSlug})\n        → "${name}"`);
    return { outcome: 'skipped' };
  }
  const backup = saveBackup(before);
  const payload = buildUpsertPayload(before, { description: before.description, meta: before.meta_description });
  payload.name = name;
  const { status, text } = await putTravel(payload);
  if (status !== 200 && status !== 201) {
    console.error(`  ❌ #${id} PUT → HTTP ${status}: ${text.slice(0, 200)}`);
    return { outcome: 'failed' };
  }
  const after = await getTravel(id);
  // #1649: the payload echoes the description back unchanged, so a GET that
  // mangled it would write the damage in. Fatal to the run, not to one entry.
  //
  // `name` is deliberately NOT checked here: detectRegression() below already
  // compares it against what we sent («name not applied»), and duplicating that
  // assertion would relabel an unapplied title as a UTF-8 defect and abort the
  // whole run over it.
  const corruption = detectCorruption(after, { description: before.description });
  if (corruption.length) {
    console.error(`  ⛔ #${id} TEXT CORRUPTION: ${corruption.join('; ')} — rolling back (backup ${path.basename(backup)})`);
    // The rollback must not be able to swallow the abort: it is a network call
    // too, and either half of its failure — a rejected socket or a non-2xx
    // answer — used to replace this TextCorruptionError, leaving the batch
    // running and the run exiting 0. `exitOnFailure: false` keeps the HTTP half
    // reportable; without it restoreFromBackup() exits inside itself and the
    // message below can never print.
    const rollback = await restoreFromBackup(id, { exitOnFailure: false })
      .catch((error) => ({ ok: false, status: 0, reason: error.message }));
    if (!rollback.ok) console.error(`     rollback FAILED: ${rollback.reason}`);
    throw new TextCorruptionError(
      rollback.ok
        ? corruption
        : [
            ...corruption,
            liveWarning(name, backup, rollback.reason),
          ],
      `#${id}`,
    );
  }
  const problems = detectRegression(before, after, name);
  if (problems.length) {
    console.error(`  ⛔ #${id} regression: ${problems.join('; ')} — rolling back (backup ${path.basename(backup)})`);
    // Same `exitOnFailure: false` as the corruption branch, for the same two
    // reasons: process.exit() in here kills the run before main() writes the
    // manifest for the renames that DID land — losing the pairs seo-fix-links.js
    // needs to move internal links off those old slugs — and it prints no line
    // naming the article that is now live under the new title. The rejecting
    // half was worse still: it left the batch running.
    //
    // The old slugs themselves keep answering 301 either way: the backend wrote
    // their aliases during the PUT (see the header). What is at stake here is
    // the bookkeeping, not the redirect.
    const rollback = await restoreFromBackup(id, { exitOnFailure: false })
      .catch((error) => ({ ok: false, status: 0, reason: error.message }));
    if (rollback.ok) return { outcome: 'failed' };
    return {
      outcome: 'failed',
      abort: liveWarning(name, backup, rollback.reason),
    };
  }
  console.log(`  ✅ #${id} "${name}"  slug ${oldSlug} → ${after.slug}  (pub=${after.publish}, gal=${(after.gallery || []).length}, pts=${(after.coordsMeTravel || []).length}, desc=${(after.description || '').length})`);
  return { outcome: 'renamed', pair: { from: oldSlug, to: after.slug } };
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC);
  if (args.mode === 'restore') return restoreFromBackup(args.restore);

  const dryRun = args.dryRun;
  let entries;
  if (args.mode === 'map-file') {
    const data = JSON.parse(fs.readFileSync(args.mapFile, 'utf8'));
    entries = Array.isArray(data) ? data : data.renames || [];
  } else {
    if (!args.name) throw new UsageError('--id also needs --name <title>');
    entries = [{ id: args.id, name: args.name }];
  }
  // A map file that parsed but yielded nothing usable is a broken input, not a
  // clean run: reporting "0 renamed" over it is the #1325 shape.
  entries = requireNonEmptySelection(entries.filter((e) => e && e.id && e.name), {
    what: 'renames',
    source: args.mode === 'map-file' ? args.mapFile : '--id/--name',
    hint: 'every entry needs both an id and a name',
  });
  console.log(`${dryRun ? '🧪 DRY-RUN ' : '✏️  '}Renaming ${entries.length} travel(s) via ${API_BASE}\n`);

  const pairs = [];
  let corruption = null;
  let aborted = null;
  let failed = 0;
  for (const e of entries) {
    try {
      const result = await renameOne(e, dryRun);
      if (result.outcome === 'renamed') pairs.push(result.pair);
      if (result.outcome === 'failed') failed += 1;
      // A rollback that did not happen left an article live under its new
      // title, so the batch stops the way the corruption branch does — but
      // through here, so the manifest and the summary below still land.
      if (result.abort) {
        console.error(`  ❌ #${e.id}: ${result.abort}`);
        console.error('  🛑 batch stopped: a rollback failed, remaining renames were not attempted.');
        aborted = `#${e.id}: ${result.abort}`;
        break;
      }
    } catch (err) {
      console.error(`  ❌ #${e.id}: ${err.message}`);
      failed += 1;
      if (isTextCorruptionError(err)) {
        console.error('  🛑 batch stopped: the read/write path is mangling UTF-8, remaining renames were not attempted.');
        corruption = err;
        break;
      }
    }
  }

  // The pairs of the renames that DID land still belong in the manifest — they
  // happened, and dropping them leaves seo-fix-links.js unable to move internal
  // links off those old slugs. The slugs themselves keep answering the backend's
  // 301 either way (see the header): what is lost is the bookkeeping, not a URL.
  if (!dryRun && pairs.length) {
    appendRedirects(pairs);
    console.log(`\n📝 Added ${pairs.length} redirect(s) to ${path.relative(process.cwd(), MANIFEST)}`);
  }
  const tally = failed ? `, ${failed} failed` : '';
  console.log(`\n${dryRun ? `Dry-run complete${tally}.` : `Done: ${pairs.length} renamed + redirected${tally}.`}`);
  // Without this the aborted run still exits 0 and reads as a clean partial
  // batch — the one signal an operator has that the pipeline is damaging text.
  if (corruption) {
    throw new ExpectedFailureError(
      `run aborted after ${pairs.length} rename(s): ${corruption.message}. ` +
      'Fix the read/write path before re-running — the remaining entries were not touched.',
    );
  }
  if (aborted) {
    throw new ExpectedFailureError(
      `run aborted after ${pairs.length} rename(s): ${aborted}. ` +
      'Restore that article from its backup before re-running — the remaining entries were not touched.',
    );
  }
  // Same contract for the ordinary failures. A batch whose every entry died on
  // its GET printed «Dry-run complete.» and exited 0 — the #1325 shape that
  // requireNonEmptySelection() above already refuses at the input end, reaching
  // the run through the other door.
  requireNoBatchFailures(failed, {
    total: entries.length,
    what: 'renames',
    message:
      `${failed} of ${entries.length} entr${failed === 1 ? 'y' : 'ies'} failed — see the errors above` +
      `${pairs.length ? `; ${pairs.length} rename(s) did land and are in the manifest` : ''}`,
  });
}

if (require.main === module) {
  runSeoCli(main, { name: 'seo-rename', usage: USAGE });
}

module.exports = { CLI_SPEC, USAGE, detectRegression, appendRedirects, readManifest };
