#!/usr/bin/env node
/**
 * Travel SEO auditor.
 *
 * Pulls a given author's published travels from the MeTravel API and reports
 * per-article SEO problems that block search ranking:
 *   - <title> too long (clipped in SERP) or too short / keyword-poor
 *   - empty meta_description (search snippet is auto-generated / generic)
 *   - thin body content (low word count → weak topical relevance & dwell time)
 *   - no internal links to other travels (lost link equity / crawl depth)
 *
 * The heavy lifting lives in small pure functions (analyzeTitle, analyzeContent,
 * analyzeMeta, auditTravel, summarizeAudit) that are unit-tested. main() is the
 * thin I/O shell around them.
 *
 * `--help` prints the flag list (USAGE below). Every flag goes through the shared
 * SEO CLI contract, so a mistyped `--limt 5` is an error instead of a silent
 * audit of all 306 articles (#1391).
 *
 * Exit code is 0 even when SEO problems are found — this is a report, not a
 * gate. An empty article list or an incomplete detail batch exits non-zero:
 * either means the API result cannot support a complete audit (#1325, #1655).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const {
  parseCliArgs,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runSeoCli,
} = require('./lib/seo-cli-contract');
const { readResponseText, withAcceptEncoding } = require('./lib/httpText');

// ---------------------------------------------------------------------------
// Thresholds (kept in sync with scripts/generate-seo-pages.js SEO rules)
// ---------------------------------------------------------------------------
const TITLE_MAX = 60; // chars rendered before Google/Yandex clip the SERP title
const TITLE_MIN = 25; // shorter titles usually lack a searchable keyword phrase
const THIN_WORDS = 400; // below this a travel reads as a thin photo dump
const LEAD_CHARS = 160; // the SERP snippet = first ~160 chars of the description body
const KEYWORD_MIN_LEN = 4; // title words this long+ count as topical keywords
const KEYWORD_STEM_LEN = 5; // compare keywords on this-long stem to absorb inflection

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------
const USAGE = `Travel SEO auditor — metravel.by

Usage:
  node scripts/seo-audit.js [options]

Options:
  --user-id <id>        author whose published travels are audited (default 1)
  --api <origin>        API origin the article list comes from (default https://metravel.by)
  --limit <n>           audit only the first n articles, 0 = all (default 0)
  --min-words <n>       word count below which a body counts as thin (default ${THIN_WORDS})
  --json <path>         also write the full report to this JSON file
  --help, -h            print this help and exit

Examples:
  node scripts/seo-audit.js --user-id 1 --limit 5
  node scripts/seo-audit.js --user-id 1 --min-words 500 --json report.json`;

/**
 * Every flag this script accepts. A typo used to be dropped on the floor by the
 * hand-rolled indexOf lookup, and the audit silently widened to every article —
 * the shared contract turns it into a UsageError instead (#1391).
 */
const CLI_SPEC = {
  name: 'seo-audit',
  usage: USAGE,
  selection: 'articles',
  flags: {
    'user-id': { type: 'string', valueName: 'an author id', default: '1' },
    api: { type: 'string', valueName: 'an origin', default: 'https://metravel.by', stripTrailingSlash: true },
    limit: { type: 'int', min: 0, valueName: 'a non-negative integer', default: 0 },
    'min-words': { type: 'int', min: 1, valueName: 'a positive integer', default: THIN_WORDS },
    json: { type: 'string', valueName: 'a file path', default: '' },
  },
};

const parseArgs = (argv) => parseCliArgs(argv, CLI_SPEC);

// ---------------------------------------------------------------------------
// Pure analysis (exported for tests)
// ---------------------------------------------------------------------------

/** Plain-text length & word count from an HTML description. */
function stripHtmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const t = stripHtmlToText(text);
  if (!t) return 0;
  const m = t.match(/[\p{L}\p{N}]+/gu);
  return m ? m.length : 0;
}

function analyzeTitle(name) {
  const title = String(name || '').replace(/\s+/g, ' ').trim();
  const length = title.length;
  return {
    title,
    length,
    tooLong: length > TITLE_MAX,
    tooShort: length > 0 && length < TITLE_MIN,
    empty: length === 0,
  };
}

function titleKeywords(name) {
  const words = stripHtmlToText(name).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return words.filter((w) => w.length >= KEYWORD_MIN_LEN);
}

/**
 * Russian is heavily inflected, so the title form ("Ошмянах") and the lead form
 * ("Ошмяны") rarely match byte-for-byte. We compare on a stem — the first
 * KEYWORD_STEM_LEN chars (or the whole word if shorter) — so morphological
 * variants of the same root count as a match and don't churn weak-lead.
 */
function keywordStem(word) {
  return String(word).slice(0, Math.min(word.length, KEYWORD_STEM_LEN));
}

/**
 * The SERP snippet is built from the first ~160 chars of the description body
 * (scripts/generate-seo-pages.js → buildTravelSeoDescription), NOT from any
 * meta_description field (which the frontend ignores). A lead is "weak" when
 * that opening shares no keyword STEM with the title — i.e. the snippet does
 * not even mention what the page is about (a personal hook like "Очередное
 * обещание собаке…").
 */
function analyzeLead(name, descriptionHtml) {
  const lead = stripHtmlToText(descriptionHtml).slice(0, LEAD_CHARS).toLowerCase();
  const keywords = titleKeywords(name);
  const matched = keywords.filter((k) => lead.includes(keywordStem(k)));
  return {
    lead,
    empty: lead.length === 0,
    keywords,
    matched,
    weak: lead.length === 0 || (keywords.length > 0 && matched.length === 0),
  };
}

/**
 * Signatures of machine output that has no business being in an article body:
 * stdout of a maintenance script, a stringified object, a stack trace.
 *
 * `weak-lead` does not catch these. Travel 443 shipped with the body starting
 * at "DUP found at: 3238 / Removed dup, new len: 50274" — leftover logging from
 * a de-duplication pass — and the audit stayed silent for months because the
 * real title words still appeared later inside the 160-char snippet window.
 * The snippet in search results led with that line.
 */
const LEAD_NOISE_PATTERN =
  /^\s*(dup found\b|removed dup\b|new len\b|undefined\b|null\b|nan\b|\[object object\]|error:|traceback\b|warning:|\{"|\[\{|<\?php)/i;

/** True when the body starts with script output rather than prose. */
function analyzeLeadNoise(descriptionHtml) {
  const lead = stripHtmlToText(descriptionHtml).slice(0, LEAD_CHARS);
  return { lead, noisy: LEAD_NOISE_PATTERN.test(lead) };
}

function analyzeContent(descriptionHtml, minWords = THIN_WORDS) {
  const html = String(descriptionHtml || '');
  const words = countWords(html);
  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  const h3 = (html.match(/<h3[\s>]/gi) || []).length;
  // internal links: <a href> pointing at another travel on the same site
  const internalLinks = (
    html.match(/<a\b[^>]*href=["'][^"']*\/travels\/[^"']+["']/gi) || []
  ).length;
  return {
    words,
    thin: words < minWords,
    headings: h2 + h3,
    noHeadings: h2 + h3 === 0,
    internalLinks,
    noInternalLinks: internalLinks === 0,
  };
}

/**
 * Combine list-item + detail into a per-travel audit record.
 * `detail` may be {} when the detail fetch failed; content checks then degrade
 * gracefully (treated as thin / no headings rather than throwing).
 */
function auditTravel(listItem, detail = {}, opts = {}) {
  const minWords = opts.minWords || THIN_WORDS;
  const detailUnavailable = !detail || detail.__fetchFailed === true;
  const titleA = analyzeTitle(listItem.name);
  const leadA = analyzeLead(listItem.name, detail.description);
  const leadNoiseA = analyzeLeadNoise(detail.description);
  const contentA = analyzeContent(detail.description, minWords);

  const issues = [];
  if (titleA.tooLong) issues.push('title-too-long');
  if (titleA.tooShort) issues.push('title-too-short');
  // Content/lead checks need the body. When the detail fetch failed we have no
  // body — flagging weak-lead/thin/no-headings/no-internal-links would be a
  // false positive, so skip them (title checks come from the list payload).
  if (!detailUnavailable) {
    if (leadA.weak) issues.push('weak-lead');
    if (leadNoiseA.noisy) issues.push('lead-noise');
    if (contentA.thin) issues.push('thin-content');
    if (contentA.noHeadings) issues.push('no-headings');
    if (contentA.noInternalLinks) issues.push('no-internal-links');
  }

  const views = Number(listItem.countUnicIpView) || 0;
  // Priority = how much ranking upside the fixes unlock. Pages that already
  // pull traffic but are thin / meta-less are the highest-ROI to enrich.
  const trafficWeight = Math.min(views, 5000) / 5000; // 0..1
  const priority = Math.round(issues.length * (1 + 2 * trafficWeight) * 10);

  return {
    id: listItem.id,
    slug: listItem.slug || '',
    name: titleA.title,
    year: listItem.year ?? null,
    country: listItem.countryName || '',
    views,
    titleLength: titleA.length,
    words: detailUnavailable ? null : contentA.words,
    headings: detailUnavailable ? null : contentA.headings,
    internalLinks: detailUnavailable ? null : contentA.internalLinks,
    weakLead: detailUnavailable ? null : leadA.weak,
    leadNoise: detailUnavailable ? null : leadNoiseA.noisy,
    detailFetchFailed: detailUnavailable,
    issues,
    priority,
  };
}

/** Roll up a list of audit records into headline counts + a ranked worklist. */
function summarizeAudit(rows) {
  const counts = {
    total: rows.length,
    titleTooLong: 0,
    titleTooShort: 0,
    weakLead: 0,
    leadNoise: 0,
    thinContent: 0,
    noHeadings: 0,
    noInternalLinks: 0,
    clean: 0,
  };
  for (const r of rows) {
    if (r.issues.length === 0) counts.clean++;
    if (r.issues.includes('title-too-long')) counts.titleTooLong++;
    if (r.issues.includes('title-too-short')) counts.titleTooShort++;
    if (r.issues.includes('weak-lead')) counts.weakLead++;
    if (r.issues.includes('lead-noise')) counts.leadNoise++;
    if (r.issues.includes('thin-content')) counts.thinContent++;
    if (r.issues.includes('no-headings')) counts.noHeadings++;
    if (r.issues.includes('no-internal-links')) counts.noInternalLinks++;
  }
  const worklist = rows
    .filter((r) => r.issues.length > 0)
    .sort((a, b) => b.priority - a.priority);
  return { counts, worklist };
}

// ---------------------------------------------------------------------------
// I/O shell
// ---------------------------------------------------------------------------
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    // Some CDNs key the cache on the path only and ignore the `?_cb=` query, so
    // a just-edited article can read stale. No-cache headers force a fresh body
    // and keep batch selection accurate (no re-picking already-fixed articles).
    const opts = {
      timeout: 30000,
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    };
    if (mod === https) opts.rejectUnauthorized = false;
    opts.headers = withAcceptEncoding(opts.headers);
    const req = mod.get(url, opts, (res) => {
      // res.resume() on every path that abandons the body: an undrained
      // response keeps its socket checked out of the keep-alive agent, and this
      // script walks hundreds of URLs.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchJson(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      // #1649: whole body buffered, then decoded once — accumulating
      // `buf += chunk` decoded every transport chunk on its own.
      readResponseText(res).then(
        (body) => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } },
        reject,
      );
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/** fetchJson with a few retries — a transient failure must NOT masquerade as a
 *  thin/empty body (that produced false weak-lead/thin/no-headings flags). */
async function fetchJsonRetry(url, attempts = 3, backoffMs = 400) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
    }
  }
  throw lastErr;
}

async function batchAsync(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

async function main(argv = process.argv, deps = {}) {
  // Parsed here, not at module level: a UsageError has to reach runSeoCli()
  // below so a bad invocation exits 2 instead of running a wide audit (#1391).
  const args = parseArgs(argv);
  const io = { fetchJson, fetchJsonRetry, ...deps };

  const API_BASE = args.api;
  const userId = args.userId;
  const limit = args.limit;
  const minWords = args.minWords;
  const jsonOut = args.json;

  const where = JSON.stringify({ user_id: userId, publish: 1, moderation: 1 });
  console.log(`🔎 SEO audit for user_id=${userId} via ${API_BASE}`);

  // 1. List published travels for the author
  let list = [];
  let page = 1;
  while (true) {
    const u = `${API_BASE}/api/travels/?where=${encodeURIComponent(where)}&page=${page}&perPage=100`;
    const res = await io.fetchJson(u);
    const items = res.data || res.results || res.items || (Array.isArray(res) ? res : []);
    list = list.concat(items);
    const total = Number(res.total || res.count || list.length);
    if (list.length >= total || items.length === 0) break;
    page++;
  }
  // Zero articles is a broken envelope or an unreachable API, never a clean
  // audit — reporting "total: 0 | clean: 0" with exit 0 is the #1325 shape.
  requireNonEmptySelection(list, {
    what: 'articles',
    source: `${API_BASE}/api/travels/`,
    hint: `user_id=${userId}, publish=1, moderation=1`,
  });
  if (limit) list = list.slice(0, limit);
  console.log(`📦 ${list.length} published travels`);

  // 2. Fetch detail (description + meta_description) for each.
  // Cache-buster: the CDN can serve a stale body right after a write, which
  // would make the audit re-pick an already-fixed article. A unique query
  // param forces a fresh response so batch selection reflects live state.
  const cb = Date.now();
  const details = await batchAsync(list, 6, async (t) => {
    try {
      return await io.fetchJsonRetry(`${API_BASE}/api/travels/${t.id}/?_cb=${cb}-${t.id}`);
    } catch {
      return { __fetchFailed: true };
    }
  });
  const failedDetails = list.flatMap((travel, index) =>
    details[index] && details[index].__fetchFailed
      ? [{ id: travel.id, name: travel.name, slug: travel.slug }]
      : [],
  );
  const failedCount = failedDetails.length;
  if (failedCount) {
    console.warn(`  ⚠️  detail fetch failed for ${failedCount} travel(s) after retries — content checks skipped for them (NOT counted as thin)`);
  }

  // 3. Audit + summarize
  const rows = list.map((t, i) => auditTravel(t, details[i] || {}, { minWords }));
  const { counts, worklist } = summarizeAudit(rows);

  console.log('\n=== Summary ===');
  console.log(`  total: ${counts.total} | clean: ${counts.clean}`);
  console.log(`  title>60: ${counts.titleTooLong} | title<25: ${counts.titleTooShort}`);
  console.log(`  weak lead (snippet off-topic): ${counts.weakLead}`);
  console.log(`  lead noise (script output in body): ${counts.leadNoise}`);
  console.log(`  thin (<${minWords} words): ${counts.thinContent}`);
  console.log(`  no headings: ${counts.noHeadings} | no internal links: ${counts.noInternalLinks}`);

  console.log('\n=== Top 25 worklist (by priority) ===');
  console.log('prio  views words id    issues / title');
  for (const r of worklist.slice(0, 25)) {
    console.log(
      `${String(r.priority).padStart(4)} ${String(r.views).padStart(6)} ${String(r.words).padStart(5)} ${String(r.id).padEnd(5)} ${r.issues.join(',')} | ${r.name.slice(0, 50)}`
    );
  }

  if (jsonOut) {
    const outPath = path.resolve(jsonOut);
    fs.writeFileSync(
      outPath,
      JSON.stringify({ counts, detailFetchFailures: failedDetails, rows: worklist }, null, 2),
      'utf8',
    );
    console.log(`\n💾 Full report → ${outPath}`);
  }

  requireNoBatchFailures(failedCount, {
    total: list.length,
    what: 'travel detail fetches',
    message: `${failedCount} of ${list.length} travel detail fetches failed — the report above is incomplete`,
  });
}

// ---------------------------------------------------------------------------
// Exports for testing (main() not executed on require)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CLI_SPEC,
    USAGE,
    main,
    parseArgs,
    stripHtmlToText,
    countWords,
    analyzeTitle,
    titleKeywords,
    keywordStem,
    analyzeLead,
    analyzeLeadNoise,
    analyzeContent,
    auditTravel,
    summarizeAudit,
    TITLE_MAX,
    TITLE_MIN,
    THIN_WORDS,
    LEAD_CHARS,
  };
}

if (require.main === module) {
  runSeoCli(main, { name: 'seo-audit', usage: USAGE });
}
