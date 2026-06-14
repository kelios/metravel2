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
 * Usage:
 *   node scripts/seo-audit.js --user-id 1 [--api https://metravel.by]
 *                             [--json out.json] [--limit 50] [--min-words 400]
 *
 * Exit code is 0 even when problems are found — this is a report, not a gate.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

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
  const contentA = analyzeContent(detail.description, minWords);

  const issues = [];
  if (titleA.tooLong) issues.push('title-too-long');
  if (titleA.tooShort) issues.push('title-too-short');
  // Content/lead checks need the body. When the detail fetch failed we have no
  // body — flagging weak-lead/thin/no-headings/no-internal-links would be a
  // false positive, so skip them (title checks come from the list payload).
  if (!detailUnavailable) {
    if (leadA.weak) issues.push('weak-lead');
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
function getArg(args, name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

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
    const req = mod.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
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

async function main() {
  const args = process.argv.slice(2);
  const API_BASE = getArg(args, 'api', 'https://metravel.by').replace(/\/+$/, '');
  const userId = getArg(args, 'user-id', '1');
  const limit = parseInt(getArg(args, 'limit', '0'), 10) || 0;
  const minWords = parseInt(getArg(args, 'min-words', String(THIN_WORDS)), 10) || THIN_WORDS;
  const jsonOut = getArg(args, 'json', '');

  const where = JSON.stringify({ user_id: userId, publish: 1, moderation: 1 });
  console.log(`🔎 SEO audit for user_id=${userId} via ${API_BASE}`);

  // 1. List published travels for the author
  let list = [];
  let page = 1;
  while (true) {
    const u = `${API_BASE}/api/travels/?where=${encodeURIComponent(where)}&page=${page}&perPage=100`;
    const res = await fetchJson(u);
    const items = res.data || res.results || res.items || (Array.isArray(res) ? res : []);
    list = list.concat(items);
    const total = Number(res.total || res.count || list.length);
    if (list.length >= total || items.length === 0) break;
    page++;
  }
  if (limit) list = list.slice(0, limit);
  console.log(`📦 ${list.length} published travels`);

  // 2. Fetch detail (description + meta_description) for each.
  // Cache-buster: the CDN can serve a stale body right after a write, which
  // would make the audit re-pick an already-fixed article. A unique query
  // param forces a fresh response so batch selection reflects live state.
  const cb = Date.now();
  const details = await batchAsync(list, 6, async (t) => {
    try {
      return await fetchJsonRetry(`${API_BASE}/api/travels/${t.id}/?_cb=${cb}-${t.id}`);
    } catch {
      return { __fetchFailed: true };
    }
  });
  const failedCount = details.filter((d) => d && d.__fetchFailed).length;
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
    fs.writeFileSync(outPath, JSON.stringify({ counts, rows: worklist }, null, 2), 'utf8');
    console.log(`\n💾 Full report → ${outPath}`);
  }
}

// ---------------------------------------------------------------------------
// Exports for testing (main() not executed on require)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    stripHtmlToText,
    countWords,
    analyzeTitle,
    titleKeywords,
    keywordStem,
    analyzeLead,
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
  main().catch((err) => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}
