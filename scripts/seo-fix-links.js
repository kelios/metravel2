#!/usr/bin/env node
/**
 * Rewrite stale internal travel links sitewide.
 *
 * After scripts/seo-rename.js changes a title (and therefore slug), every other
 * article that linked to the OLD slug now points through a 301 redirect hop.
 * This tool reads scripts/seo-redirects.json and, for each published travel of
 * an author, replaces `…/travels/{oldSlug}` → `…/travels/{newSlug}` in every
 * rich-text field that can hold a link (`description`, `recommendation`, `plus`,
 * `minus` — one list, scripts/lib/travelBodyLinks.js), both relative
 * `/travels/x` and absolute `https://metravel.by/travels/x`, then PUTs only when
 * something changed. Echoes every other field via buildUpsertPayload
 * (publish/moderation/gallery/points preserved) with a backup + post-write
 * verification + auto-rollback on regression.
 *
 * The manifest is a MIRROR of the backend's `TravelSlugRedirect` rows, and only
 * scripts/seo-rename.js writes it — a slug changed in the editor, by
 * seo-alias-backfill.js or by a backend migration gets its 301 without a pair
 * here. So «0 links to rewrite» proves nothing by itself (#3330). `--check` is
 * the proof: it asks the live site for every internal address found in the
 * articles, without following redirects, and passes only when each answers 200.
 * A 301 whose pair is missing from the mirror is named with its live target;
 * `--update-mirror` appends those pairs, after which `--dry-run` sees them.
 *
 * `--help` prints USAGE below; the arguments themselves go through the shared SEO
 * CLI contract (#1391), so a mistyped `--dry-runn` is a usage error instead of a
 * real rewrite of every published body.
 *
 * Token: METRAVEL_TOKEN env or ~/.metravel_token (never logged).
 */
const { rethrowTerminalAuthError, bodyMaintenanceSession, publicRequest, TokenError, formatTokenError  } = require('./lib/metravel-tool-session');
const fs = require('fs');
const path = require('path');
const { setTimeout: wait } = require('node:timers/promises');
const { buildUpsertPayload } = require('./seo-edit');
const { appendRedirects } = require('./seo-rename');
const { detectStoredTextCorruption } = require('./lib/textIntegrity');
const {
  TRAVEL_LINK_FIELDS,
  collectTravelLinks,
  findUnhandledLinkFields,
  rewriteLinks,
  rewriteTravelFields,
} = require('./lib/travelBodyLinks');

const {
  ExpectedFailureError,
  UsageError,
  parseCliArgs,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runCli,
} = require('./lib/cli-contract');

const SITE_ORIGIN = (process.env.METRAVEL_API || 'https://metravel.by').replace(/\/+$/, '');
const API_BASE = SITE_ORIGIN + '/api';
const BACKUP_DIR = path.join(__dirname, '.seo-backups');
const MANIFEST = path.join(__dirname, 'seo-redirects.json');

const USAGE = `Rewrite stale internal travel links sitewide — metravel.by

Usage:
  node scripts/seo-fix-links.js <mode> [options]

Modes (exactly one is required — this rewrites every published body, so say which):
  --dry-run             print what would change, write nothing
  --apply               rewrite the live articles
  --check               ask the live site for every internal address in the
                        articles (no redirect following); passes only when all
                        answer 200. Writes nothing to the articles
  --restore <id>        roll one travel back from its most recent backup

Options:
  --user-id <id|all>    author whose published travels are scanned (default 1);
                        "all" reads every author and is refused by --apply
  --report <path>       also write the result as JSON (--dry-run and --check)
  --update-mirror       with --check: append to scripts/seo-redirects.json the
                        pairs the live site redirects but the mirror lacks
  --help, -h            print this help and exit

Examples:
  node scripts/seo-fix-links.js --dry-run
  node scripts/seo-fix-links.js --check --user-id all --report .codex-temp/links.json
  node scripts/seo-fix-links.js --check --update-mirror
  node scripts/seo-fix-links.js --apply --user-id 1
  node scripts/seo-fix-links.js --restore 186`;

/**
 * Every flag lives in the shared SEO CLI contract (#1391), and preview-or-write
 * is a mandatory mode: a bare `node scripts/seo-fix-links.js` used to rewrite the
 * body of every published article of user 1 without anyone naming a single flag.
 * That is the widest action in this family — it must be asked for out loud.
 */
const CLI_SPEC = {
  name: 'seo-fix-links',
  usage: USAGE,
  selection: 'published travels',
  flags: {
    'dry-run': { type: 'boolean' },
    apply: { type: 'boolean' },
    check: { type: 'boolean' },
    restore: { type: 'string', valueName: 'a travel id' },
    'user-id': {
      type: 'string',
      valueName: 'an author id or "all"',
      default: '1',
      forbiddenModes: ['restore'],
      reason: 'a restore works on the single travel in the backup',
    },
    report: {
      type: 'string',
      valueName: 'a file path',
      forbiddenModes: ['apply', 'restore'],
      reason: 'the JSON report describes a read-only pass',
    },
    'update-mirror': {
      type: 'boolean',
      requiresMode: 'check',
      reason: 'only the live check knows which redirects the mirror lacks',
    },
  },
  modes: {
    flags: ['dry-run', 'apply', 'check', 'restore'],
    label: 'run modes',
    missing:
      'No mode given: pass --dry-run (preview), --apply (rewrite live bodies), --check (live completeness) or --restore <id>',
  },
};

const ALL_AUTHORS = 'all';
/** The site's own author; everyone else is a guest author in the breakdown. */
const OWNER_AUTHOR_ID = 1;
/** One request start per interval: ≤ 6,7 requests/s against a one-CPU backend. */
const REQUEST_INTERVAL_MS = 150;

const TRAVELS_PER_PAGE = 100;

async function request(method, urlPath, data) {
  const session = bodyMaintenanceSession({ origin: API_BASE });
  const response = await session.request(`${API_BASE}${urlPath}`, { method, ...(data != null ? { json: data } : {}) });
  return { status: response.status, text: await response.text() };
}

async function getJson(urlPath, baseUrl = API_BASE) {
  const response = await publicRequest(baseUrl, `${baseUrl}${urlPath}`);
  if (!response.ok) throw new TokenError('response', { status: response.status });
  return response.json();
}

async function listTravels(userId, deps = {}) {
  const fetchJson = deps.getJson || getJson;
  // `all` drops the author filter: the read-only modes report guest articles too.
  const where = encodeURIComponent(JSON.stringify(
    userId === ALL_AUTHORS ? { publish: 1, moderation: 1 } : { user_id: userId, publish: 1, moderation: 1 },
  ));
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const res = await fetchJson(`/travels/?where=${where}&page=${page}&perPage=${TRAVELS_PER_PAGE}`);
    // `results` first: /api/travels/ answers {count, next, results}. Reading only
    // the legacy keys is literally #1325 — the list came back empty and the run
    // reported "Scanning 0 published travels…" as a clean pass.
    const rows = res.results || res.data || res.items || res.rows || (Array.isArray(res) ? res : []);
    if (!rows.length) break;
    out.push(...rows);
    // #1755: страницу ЗА последней DRF отдаёт не пустым списком, а HTTP 404
    // «Invalid page», и getJson валит весь прогон уже после того, как все статьи
    // прочитаны. Значит, конец считается ДО запроса следующей страницы.
    // Ведущий признак — курсор `next`: он есть в ответе всегда и на последней
    // странице равен null. Недобора строк для этого мало: когда количество
    // кратно 100 (у автора 1 их 320, станет 400), последняя страница полна,
    // и следующий запрос — тот же 404. `total`/`count` и недобор остаются
    // запасными путями для легаси-конверта без курсора.
    const envelope = res && typeof res === 'object' && !Array.isArray(res) ? res : null;
    if (envelope && 'next' in envelope) {
      if (!envelope.next) break;
      continue;
    }
    const total = Number(envelope ? envelope.total ?? envelope.count : undefined);
    if (Number.isFinite(total) && total > 0 && out.length >= total) break;
    if (rows.length < TRAVELS_PER_PAGE) break;
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
 * Success = the targeted stale links are gone and the bodies survived. The backend
 * sanitizes HTML on save (re-encodes entities / reorders attrs), so a byte-exact
 * compare to what we sent yields false regressions — instead assert outcome:
 * no old slug remains as a link AND no rich-text field collapsed. Every field of
 * TRAVEL_LINK_FIELDS is held to it, rewritten or merely echoed: the PUT carries
 * all four, so all four can come back damaged.
 */
function detectRegression(before, after, slugMap) {
  const problems = [];
  if (before.slug && after.slug && before.slug !== after.slug) problems.push(`slug changed ${before.slug} → ${after.slug}`);
  if (before.publish && !after.publish) problems.push('publish flipped to false');
  if (before.moderation && !after.moderation) problems.push('moderation flipped to false');
  if ((after.gallery || []).length < (before.gallery || []).length) problems.push('gallery shrank');
  if ((after.coordsMeTravel || []).length < (before.coordsMeTravel || []).length) problems.push('points shrank');
  let remaining = 0;
  for (const field of TRAVEL_LINK_FIELDS) {
    const afterText = String(after[field] || '').trim();
    const beforeLen = String(before[field] || '').trim().length;
    if (afterText.length < Math.floor(beforeLen * 0.9)) problems.push(`${field} shrank ${beforeLen} → ${afterText.length}`);
    remaining += rewriteLinks(afterText, slugMap).count;
  }
  if (remaining > 0) problems.push(`${remaining} stale link(s) still present after write`);
  return problems;
}

/**
 * U+FFFD that the write path added to any rich-text field it carried (#1649).
 * A re-read that is not an article at all is detectRegression()'s case — one
 * rollback, not a stopped batch (same boundary as seo-edit's detectCorruption).
 */
function detectCorruption(after, payload) {
  if (!after || typeof after !== 'object' || after.id == null) return [];
  return detectStoredTextCorruption(
    TRAVEL_LINK_FIELDS.map((field) => ({ label: field, sent: payload[field], stored: after[field] })),
  );
}

async function restore(id) {
  const file = latestBackup(id);
  if (!file) { console.error(`No backup for #${id}`); process.exit(1); }
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  const payload = buildUpsertPayload(original, { description: original.description, meta: original.meta_description });
  const { status } = await request('PUT', '/travels/upsert/', payload);
  console.log(`↩️  restore #${id} → HTTP ${status}`);
  if (status !== 200 && status !== 201) { console.error(formatTokenError(new TokenError('response', { status }))); process.exit(1); }
}

/** At most one request start per `intervalMs`, however fast the answers come. */
function createPacer(intervalMs, sleep = wait) {
  let nextStart = 0;
  return async () => {
    const now = Date.now();
    const delay = nextStart - now;
    nextStart = Math.max(now, nextStart) + intervalMs;
    if (delay > 0) await sleep(delay);
  };
}

/** One GET of the public article address, redirects NOT followed. */
async function probeAddress(slug) {
  const response = await publicRequest(SITE_ORIGIN, `${SITE_ORIGIN}/travels/${slug}`);
  return { status: response.status, location: response.headers.get('location') || '' };
}

/** `/travels/<slug>` of our own site out of a Location header, or `null`. */
function redirectTargetSlug(location) {
  const target = String(location || '').replace(/^https?:\/\/(?:www\.)?metravel\.by(?=\/|$)/i, '');
  const match = target.split('?')[0].split('#')[0].match(/^\/travels\/([a-z0-9][a-z0-9-]*)\/?$/);
  return match ? match[1] : null;
}

/**
 * What a live answer means for one internal address.
 *   ok          200 — nothing to do
 *   stale       301 and the mirror knows the same target — `--apply` rewrites it
 *   missing     301 the mirror has no pair for — `--update-mirror` adds it
 *   mismatch    301 to another target than the mirror says — the mirror is wrong
 *   unmappable  a redirect that does not lead to an article address
 *   not-found   404/410 — the article is gone, a content fix, not a rewrite
 *   unverified  no usable answer (5xx, 429, network) — never read as «fine»
 */
function classifyAddress(slug, answer, slugMap) {
  const status = answer && answer.status;
  if (status === 200) return { state: 'ok', status };
  if (status === 404 || status === 410) return { state: 'not-found', status };
  if (status >= 300 && status < 400) {
    const to = redirectTargetSlug(answer.location);
    const mirrorTo = slugMap.get(slug) || null;
    if (!to || to === slug) return { state: 'unmappable', status, location: answer.location };
    if (!mirrorTo) return { state: 'missing', status, to };
    return mirrorTo === to ? { state: 'stale', status, to } : { state: 'mismatch', status, to, mirrorTo };
  }
  return { state: 'unverified', status: status || null };
}

const authorGroup = (authorId) => (authorId === OWNER_AUTHOR_ID ? `author-${OWNER_AUTHOR_ID}` : 'guest');

function readAuthorId(detail, row) {
  for (const source of [detail, row]) {
    const id = Number(source && ((source.user && source.user.id) ?? source.userIds));
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

/** Occurrences and distinct articles, split by field and by author group. */
function createTally() {
  const articles = new Set();
  const groupArticles = {};
  const tally = { occurrences: 0, articles: 0, byField: {}, byAuthor: {} };
  return {
    add(articleId, authorId, field, count = 1) {
      const group = authorGroup(authorId);
      tally.occurrences += count;
      tally.byField[field] = (tally.byField[field] || 0) + count;
      const bucket = (tally.byAuthor[group] = tally.byAuthor[group] || { occurrences: 0, articles: 0 });
      bucket.occurrences += count;
      articles.add(articleId);
      (groupArticles[group] = groupArticles[group] || new Set()).add(articleId);
      tally.articles = articles.size;
      bucket.articles = groupArticles[group].size;
    },
    result: () => tally,
  };
}

const formatBreakdown = (counts) => Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(', ') || 'none';
const formatAuthors = (byAuthor) => Object.entries(byAuthor)
  .map(([group, { occurrences, articles }]) => `${group} ${occurrences} in ${articles} article(s)`).join(', ') || 'none';

function writeReport(file, report) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`\n📄 Report: ${file}`);
}

/**
 * `--check`: the live completeness proof (#3330).
 *
 * Reads every article, collects each internal address from every link field and
 * asks the site for it once. The run passes only when every address answers 200
 * — a redirect, a 404, an address that could not be verified, a link in a field
 * this tool does not handle or an address it could not read to its end all keep
 * it red, because each of them is a link the «0» would otherwise hide.
 */
async function runCheck({ travels, slugMap, io, userId, reportFile, updateMirror }) {
  const addresses = new Map();
  const unhandled = [];
  const partial = [];
  let unread = 0;
  for (const row of travels) {
    let detail;
    try {
      detail = await io.getJson(`/travels/${row.id}/`);
    } catch (e) {
      rethrowTerminalAuthError(e);
      console.warn(`  ⚠️  #${row.id} GET failed: ${e.message}`);
      unread++;
      continue;
    }
    const authorId = readAuthorId(detail, row);
    for (const link of collectTravelLinks(detail)) {
      if (link.partial) {
        partial.push({ id: row.id, field: link.field, slug: link.slug });
        continue;
      }
      const entry = addresses.get(link.slug) || { slug: link.slug, uses: [] };
      entry.uses.push({ id: row.id, authorId, field: link.field });
      addresses.set(link.slug, entry);
    }
    const fields = findUnhandledLinkFields(detail);
    if (fields.length) unhandled.push({ id: row.id, fields });
  }

  console.log(`Probing ${addresses.size} internal address(es) found in ${travels.length - unread} article(s)…\n`);
  const states = {};
  const findings = [];
  const redirectTally = createTally();
  let probed = 0;
  const probe = async (slug) => {
    try {
      return classifyAddress(slug, await io.probeAddress(slug), slugMap);
    } catch (e) {
      rethrowTerminalAuthError(e);
      return classifyAddress(slug, null, slugMap);
    }
  };
  for (const entry of addresses.values()) {
    let verdict = await probe(entry.slug);
    // One more try for an address that gave no usable answer: a cold render that
    // timed out once is not a finding, and «unverified» keeps the whole run red.
    if (verdict.state === 'unverified') verdict = await probe(entry.slug);
    states[verdict.state] = (states[verdict.state] || 0) + 1;
    if (++probed % 50 === 0) console.log(`  … ${probed}/${addresses.size}`);
    if (verdict.state === 'ok') continue;
    const articles = [...new Set(entry.uses.map((use) => use.id))];
    const byField = {};
    const byAuthor = {};
    for (const use of entry.uses) {
      byField[use.field] = (byField[use.field] || 0) + 1;
      byAuthor[authorGroup(use.authorId)] = (byAuthor[authorGroup(use.authorId)] || 0) + 1;
      if (verdict.status >= 300 && verdict.status < 400) redirectTally.add(use.id, use.authorId, use.field);
    }
    findings.push({ slug: entry.slug, ...verdict, occurrences: entry.uses.length, articles, byField, byAuthor });
    const target = verdict.to ? ` → ${verdict.to}` : verdict.location ? ` → ${verdict.location}` : '';
    console.log(`  ${verdict.state.padEnd(10)} HTTP ${verdict.status ?? '—'} /travels/${entry.slug}${target} — ${entry.uses.length} link(s) in #${articles.join(', #')}`);
  }
  for (const item of unhandled) console.log(`  unhandled  #${item.id}: internal links in ${item.fields.join(', ')} — not a field this tool rewrites`);
  for (const item of partial) console.log(`  unreadable #${item.id} ${item.field}: address starting /travels/${item.slug}… is not a plain slug`);

  const missingPairs = findings.filter((f) => f.state === 'missing').map((f) => ({ from: f.slug, to: f.to }));
  if (updateMirror && missingPairs.length) {
    io.appendRedirects(missingPairs);
    console.log(`\n📝 Added ${missingPairs.length} pair(s) to ${path.relative(process.cwd(), MANIFEST)} — re-run --dry-run to see them`);
  }

  const redirects = redirectTally.result();
  const notOk = addresses.size - (states.ok || 0);
  console.log(`\nCheck: ${addresses.size} internal address(es) — ${formatBreakdown(states)}.`);
  if (redirects.occurrences) {
    console.log(`Through a redirect: ${redirects.occurrences} link(s) in ${redirects.articles} article(s); by field: ${formatBreakdown(redirects.byField)}; by author: ${formatAuthors(redirects.byAuthor)}.`);
  }
  if (reportFile) {
    writeReport(reportFile, {
      mode: 'check', generatedAt: new Date().toISOString(), site: SITE_ORIGIN, userId,
      mirrorPairs: slugMap.size, scannedArticles: travels.length, unreadArticles: unread,
      addresses: addresses.size, states, redirects, findings, missingFromMirror: missingPairs,
      mirrorUpdated: Boolean(updateMirror && missingPairs.length), unhandledFields: unhandled, unreadableAddresses: partial,
    });
  }

  const reasons = [];
  if (notOk) reasons.push(`${notOk} of ${addresses.size} internal address(es) do not answer 200`);
  if (unhandled.length) reasons.push(`${unhandled.length} article(s) carry links in fields this tool does not rewrite`);
  if (partial.length) reasons.push(`${partial.length} address(es) could not be read as a slug`);
  if (unread) reasons.push(`${unread} of ${travels.length} article(s) could not be read`);
  if (reasons.length) throw new ExpectedFailureError(`${reasons.join('; ')} — see the report above`);
  console.log('✅ Every internal address in these articles answers 200.');
}

async function main(argv = process.argv, deps = {}) {
  const args = parseCliArgs(argv, CLI_SPEC);
  bodyMaintenanceSession({ origin: API_BASE });
  const pace = deps.pace || createPacer(REQUEST_INTERVAL_MS);
  const paced = (fn) => async (...input) => { await pace(); return fn(...input); };
  const io = { listTravels, loadSlugMap, request, restore, saveBackup, appendRedirects, ...deps };
  // Every read of the live site goes through one pacer, whichever mode asked.
  io.getJson = paced(deps.getJson || getJson);
  io.probeAddress = paced(deps.probeAddress || probeAddress);
  if (args.mode === 'restore') return io.restore(args.restore);

  const userId = args.userId;
  // Writing is agreed with the owner per author; guest articles are read-only here.
  if (userId === ALL_AUTHORS && args.mode === 'apply') {
    throw new UsageError('--user-id all cannot be combined with --apply — name the one author whose articles are rewritten');
  }
  const dryRun = args.mode === 'dry-run';
  const slugMap = io.loadSlugMap();
  // No redirects means the manifest never saw a rename — an empty selection, not
  // a clean "nothing to fix" (#1325): it has to reach the exit code.
  requireNonEmptySelection([...slugMap.keys()], {
    what: 'renamed slugs',
    source: 'the redirect manifest',
    hint: `run scripts/seo-rename.js first — ${path.relative(process.cwd(), MANIFEST)} lists no redirects`,
  });

  const scope = userId === ALL_AUTHORS ? 'all authors' : `user ${userId}`;
  const banner = args.mode === 'check' ? '🔎 CHECK Probing internal links live' : `${dryRun ? '🧪 DRY-RUN ' : '🔗 '}Fixing stale internal links`;
  console.log(`${banner} (${slugMap.size} renamed slugs) for ${scope} via ${API_BASE}\n`);
  const travels = requireNonEmptySelection(await io.listTravels(userId, io), {
    what: 'published travels',
    source: `${API_BASE}/travels/`,
    hint: `${userId === ALL_AUTHORS ? 'every author' : `user_id=${userId}`}, publish=1, moderation=1 — nothing would be scanned`,
  });
  console.log(`Scanning ${travels.length} published travels…\n`);

  if (args.mode === 'check') {
    return runCheck({ travels, slugMap, io, userId, reportFile: args.report, updateMirror: args.updateMirror });
  }

  let changed = 0, totalLinks = 0, failed = 0;
  const tally = createTally();
  const articles = [];
  for (const t of travels) {
    let detail;
    try {
      detail = await io.getJson(`/travels/${t.id}/`);
    } catch (e) {
      rethrowTerminalAuthError(e);
      console.warn(`  ⚠️  #${t.id} GET failed: ${e.message}`);
      failed++;
      continue;
    }
    const { changes, counts, total: count } = rewriteTravelFields(detail, slugMap);
    if (!count) continue;
    totalLinks += count;
    const where = formatBreakdown(counts);
    if (dryRun) {
      const authorId = readAuthorId(detail, t);
      for (const [field, fieldCount] of Object.entries(counts)) tally.add(t.id, authorId, field, fieldCount);
      articles.push({ id: t.id, slug: detail.slug, name: detail.name, authorId, links: count, byField: counts });
      console.log(`  [dry] #${t.id} «${(detail.name || '').slice(0, 40)}» — ${count} link(s): ${where}`);
      changed++;
      continue;
    }
    const backup = io.saveBackup(detail);
    const payload = buildUpsertPayload(detail, { ...changes, meta: detail.meta_description });
    const { status } = await io.request('PUT', '/travels/upsert/', payload);
    if (status !== 200 && status !== 201) {
      console.error(formatTokenError(new TokenError('response', { status: status })));
      failed++;
      continue;
    }
    let after;
    try { after = await io.getJson(`/travels/${t.id}/`); } catch (authError) {
      rethrowTerminalAuthError(authError); after = {}; }
    // #1649: checked before the regression guards below and fatal to the run —
    // a mangled code point survives every length-based check, and continuing
    // the batch would write the same damage into every remaining article.
    const corruption = detectCorruption(after, payload);
    if (corruption.length) {
      console.error(`  ⛔ #${t.id} TEXT CORRUPTION: ${corruption.join('; ')} — rolling back (${path.basename(backup)})`);
      await io.restore(t.id);
      failed++;
      console.error('  🛑 batch stopped: the read/write path is mangling UTF-8, remaining articles were not touched.');
      break;
    }
    const problems = detectRegression(detail, after, slugMap);
    if (problems.length) {
      console.error(`  ⛔ #${t.id} regression: ${problems.join('; ')} — rolling back (${path.basename(backup)})`);
      await io.restore(t.id);
      failed++;
      continue;
    }
    console.log(`  ✅ #${t.id} «${(detail.name || '').slice(0, 40)}» — ${count} link(s) rewritten: ${where}`);
    changed++;
  }

  console.log(`\n${dryRun ? 'Dry-run' : 'Done'}: ${changed} article(s), ${totalLinks} link(s)${failed ? `, ${failed} failed` : ''}.`);
  if (dryRun) {
    const totals = tally.result();
    console.log(`By field: ${formatBreakdown(totals.byField)}. By author: ${formatAuthors(totals.byAuthor)}.`);
    console.log('This counts only the redirects the mirror knows — run --check for the live proof that nothing else goes through a 301.');
    if (args.report) {
      writeReport(args.report, {
        mode: 'dry-run', generatedAt: new Date().toISOString(), site: SITE_ORIGIN, userId,
        mirrorPairs: slugMap.size, scannedArticles: travels.length, unreadArticles: failed, totals, articles,
      });
    }
  }
  // A failed PUT or a rolled-back regression is a failed run, not a clean one.
  requireNoBatchFailures(failed, {
    total: travels.length,
    what: 'published travels',
    message: `${failed} of ${travels.length} published travels failed — see the report above`,
  });
}

if (require.main === module) {
  runCli(main, { name: 'seo-fix-links', usage: USAGE });
}

module.exports = {
  CLI_SPEC, USAGE, classifyAddress, createPacer, detectCorruption, detectRegression, getJson, listTravels, main,
  redirectTargetSlug, rewriteLinks,
};
