#!/usr/bin/env node
/**
 * Scan one author's published travels for DUPLICATED text introduced by
 * repeated SEO edits (lead/append injected more than once).
 *
 * Detects three patterns inside the article `description` HTML:
 *   1. exact-dup    — the same normalised paragraph text appears 2+ times
 *   2. near-dup     — two long paragraphs share ≥3 literal 4-word phrases AND
 *                     word-overlap ≥ 0.35 — typically two definitional leads
 *   3. double-lead  — the same, among the first 3 paragraphs
 *
 * The schema.org FAQ section is removed before any comparison: it restates body
 * facts on purpose. Paragraphs shorter than PAIR_MIN_CHARS are not paired at all
 * — route articles are built from template lines that repeat by construction.
 *
 * Read-only: writes a JSON report, mutates nothing.
 *
 * `--help` prints the flag list (USAGE below); every flag goes through the
 * shared SEO CLI contract, so a mistyped `--onlyy 384` is an error instead of a
 * silent scan of all 306 articles (#1391).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const { parseCliArgs, requireNonEmptySelection, runSeoCli } = require('./lib/seo-cli-contract');
const { readResponseText, withAcceptEncoding } = require('./lib/httpText');

const API = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '');
const REPORT = path.join(__dirname, '.seo-dupes-report.json');

const USAGE = `Duplicated-text scanner for published travels — metravel.by

Usage:
  node scripts/seo-find-dupes.js [options]

Options:
  --user-id <id>        author whose published travels are scanned (default 1)
  --only <ids>          scan only these travel ids (comma-separated)
  --help, -h            print this help and exit

Examples:
  node scripts/seo-find-dupes.js --user-id 1
  node scripts/seo-find-dupes.js --user-id 1 --only 384,362`;

const CLI_SPEC = {
  name: 'seo-find-dupes',
  usage: USAGE,
  selection: 'articles',
  flags: {
    'user-id': { type: 'string', valueName: 'an author id', default: '1' },
    only: { type: 'string', valueName: 'a comma-separated id list', default: '' },
  },
};

const parseArgs = (argv) => parseCliArgs(argv, CLI_SPEC);

// Assigned in main() from the parsed args — the parse has to happen INSIDE
// main() so a UsageError reaches runSeoCli() and exits 2 (#1391).
let USER_ID = '1';
let ONLY = [];

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const o = { method: 'GET', timeout: 30000, headers: { 'Cache-Control': 'no-cache' }, ...opts };
    if (mod === https) o.rejectUnauthorized = false;
    o.headers = withAcceptEncoding(o.headers);
    const req = mod.request(url, o, (res) => {
      // #1649: whole body buffered, then decoded once — accumulating
      // `buf += chunk` decoded every transport chunk on its own.
      readResponseText(res).then((buf) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(buf ? JSON.parse(buf) : null); } catch { resolve(buf); }
        } else reject(new Error(`HTTP ${res.statusCode} ${url}`));
      }, reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${url}`)); });
    req.end();
  });
}

async function listAuthorTravels(userId) {
  const where = JSON.stringify({ user_id: Number(userId), publish: 1, moderation: 1 });
  let list = [];
  let page = 1;
  while (true) {
    const u = `${API}/travels/?where=${encodeURIComponent(where)}&page=${page}&perPage=100`;
    const res = await fetchJson(u);
    const items = res.data || res.results || res.items || [];
    list = list.concat(items);
    const total = Number(res.total || res.count || list.length);
    if (list.length >= total || items.length === 0) break;
    page++;
  }
  return list;
}

async function getTravel(id) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetchJson(`${API}/travels/${id}/?_cb=${Date.now()}-${id}-${attempt}`);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// --- text helpers ----------------------------------------------------------

// Split the description into top-level <p> paragraphs, keep only those with
// real prose (drop image-only / heading paragraphs). Returns [{idx, raw, text}].
function paragraphs(html) {
  const out = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  let i = 0;
  while ((m = re.exec(html)) !== null) {
    const raw = m[0];
    const inner = m[1];
    // strip tags → plain text
    const text = inner.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ idx: i++, raw, text, htmlOffset: m.index });
  }
  return out;
}

// Raw collapse for EXACT-dup keying: two paragraphs are exact dups only if their
// literal text matches — keep URLs so "История (link_X)" ≠ "История (link_Y)".
function collapse(t) {
  return t.toLowerCase().replace(/[«»"'(),.:;—–-]/g, ' ').replace(/\s+/g, ' ').trim();
}

// URL-stripped normalize for SHINGLE/near-dup comparison only — author pastes raw
// links as visible text ("Подробнее https://…", "booking.com/…"), and shared URL
// fragments would otherwise count as repeated phrases between two different
// objects that merely both link to wikipedia/booking.
function normalize(t) {
  return collapse(
    t
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\b[a-z0-9-]+\.(?:by|com|pl|org|ru|net|gov|de|info)\b\S*/gi, ' ')
      .replace(/\bподробнее\b/gi, ' ')
  );
}

function words(t) {
  return new Set(normalize(t).split(' ').filter((w) => w.length >= 4));
}

function jaccard(a, b) {
  const A = words(a);
  const B = words(b);
  if (A.size < 4 || B.size < 4) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

// Contiguous 3-word shingles of normalized text (filters stopword-short tokens
// out first so shared n-grams reflect real phrasing, not "и в на"). 3 words is
// tolerant enough to survive a parenthetical or a swapped epithet between two
// paraphrased leads, while still requiring a real shared phrase.
function shingles(t, n = 3) {
  const toks = normalize(t).split(' ').filter((w) => w.length >= 3);
  const out = new Set();
  for (let i = 0; i + n <= toks.length; i++) out.add(toks.slice(i, i + n).join(' '));
  return out;
}

// How many 3-word phrases two paragraphs literally share. A couple of shared
// shingles between two lead paragraphs = one was injected on top of the other.
function sharedShingles(a, b) {
  const A = shingles(a);
  const B = shingles(b);
  let n = 0;
  const samples = [];
  for (const s of A) if (B.has(s)) { n++; if (samples.length < 2) samples.push(s); }
  return { n, samples };
}

// --- per-article detection -------------------------------------------------

// A pair of paragraphs is worth a human's attention only when it repeats a
// THOUGHT, not a template line. Two facts learned on 2026-08-08, when all 59
// findings across 43 articles turned out to be false positives:
//   - route articles are full of short structural lines ("Пройдено 22 км (от A
//     до B)", "По этой долине у нас уже есть отдельный маршрут: X") that share
//     phrases by construction;
//   - the FAQ section deliberately restates facts from the body — that is what
//     FAQPage is for, so it must never be compared against the body.
const PAIR_MIN_CHARS = 140; // below this a match is a template line, not a repeated thought
const PAIR_MIN_SIM = 0.35; // word overlap required IN ADDITION to shared phrases

/**
 * Cut the FAQ out of the article HTML before any comparison. Two shapes exist in
 * the corpus: the schema.org `<section data-faq>` block, and an older plain one —
 * an `<h2>Частые вопросы…</h2>` followed by `<p><strong>Вопрос?</strong>Ответ</p>`.
 * Both restate body facts on purpose, so neither may be compared against the body.
 */
function stripFaqSection(html) {
  const source = String(html || '');

  const sectionStart = source.search(/<section[^>]*(?:data-faq|class="[^"]*seo-faq)/i);
  if (sectionStart !== -1) {
    const end = source.indexOf('</section>', sectionStart);
    return end === -1
      ? source.slice(0, sectionStart)
      : source.slice(0, sectionStart) + source.slice(end + '</section>'.length);
  }

  const headingMatch = source.match(/<h[23][^>]*>\s*(?:<[^>]+>\s*)*(?:частые вопросы|часто задаваемые|faq)[^<]*/i);
  if (!headingMatch) return source;
  const headingStart = headingMatch.index;
  const after = source.slice(headingStart + headingMatch[0].length);
  const nextHeading = after.search(/<h2\b/i);
  return nextHeading === -1
    ? source.slice(0, headingStart)
    : source.slice(0, headingStart) + after.slice(nextHeading);
}

function detect(detail) {
  const html = stripFaqSection(detail.description || '');
  const ps = paragraphs(html).filter((p) => p.text.length >= 40);
  const findings = [];

  // 1. exact duplicates (literal text match — URLs kept, so links to different
  //    objects don't collapse together)
  const seen = new Map();
  for (const p of ps) {
    const key = collapse(p.text);
    if (seen.has(key)) {
      findings.push({ type: 'exact-dup', a: seen.get(key).idx, b: p.idx, sample: p.text.slice(0, 120) });
    } else seen.set(key, p);
  }

  // 2. near-dup pairs (lead-heavy: only check among first 6 paragraphs — repeated
  //    leads land at the top). A pair is a duplicate if EITHER it shares ≥2 literal
  //    4-word phrases (catches definitional leads that diverge in detail) OR has
  //    high word-overlap (Jaccard ≥ 0.5).
  const head = ps.slice(0, 6);
  for (let i = 0; i < head.length; i++) {
    for (let j = i + 1; j < head.length; j++) {
      if (head[i].text.length < PAIR_MIN_CHARS || head[j].text.length < PAIR_MIN_CHARS) continue;
      if (findings.some((f) => f.type === 'exact-dup' && f.a === head[i].idx && f.b === head[j].idx)) continue;
      const sh = sharedShingles(head[i].text, head[j].text);
      const sim = jaccard(head[i].text, head[j].text);
      const leadZone = head[i].idx <= 2 && head[j].idx <= 2;
      // Shared phrases AND overlap: either signal alone flagged ordinary prose —
      // a lead and a story about the same place always share the place name.
      if (sh.n >= (leadZone ? 2 : 3) && sim >= PAIR_MIN_SIM) {
        findings.push({
          type: leadZone ? 'double-lead' : 'near-dup',
          a: head[i].idx, b: head[j].idx, sim: Number(sim.toFixed(2)), sharedPhrases: sh.n,
          phrases: sh.samples,
          sampleA: head[i].text.slice(0, 110),
          sampleB: head[j].text.slice(0, 110),
        });
      }
    }
  }

  // 3. whole-body repetition — the same information restated in two different
  //    BODY blocks (e.g. an appended <h2>История</h2> repeating a fact already
  //    told inline above). Excludes the intentional schema.org FAQ section so we
  //    flag reader-facing repetition, not FAQ summaries. This is the "блоки
  //    повторяют одну и ту же информацию" signal.
  // The FAQ block is already gone from `html` (stripFaqSection), so everything
  // left here is reader-facing prose.
  const body = ps.filter((p) => p.text.length >= PAIR_MIN_CHARS);
  for (let i = 0; i < body.length; i++) {
    for (let j = i + 1; j < body.length; j++) {
      // skip pairs already reported (exact/double-lead/near-dup)
      if (findings.some((f) => (f.a === body[i].idx && f.b === body[j].idx))) continue;
      const sh = sharedShingles(body[i].text, body[j].text);
      const sim = jaccard(body[i].text, body[j].text);
      if (sh.n >= 3 && sim >= 0.45) {
        findings.push({
          type: 'body-repeat',
          a: body[i].idx, b: body[j].idx, sim: Number(sim.toFixed(2)), sharedPhrases: sh.n,
          phrases: sh.samples,
          sampleA: body[i].text.slice(0, 110),
          sampleB: body[j].text.slice(0, 110),
        });
      }
    }
  }

  return findings;
}

// Lightweight structural snapshot — used to flag articles whose SEO blocks were
// appended at the end (likely out-of-order / disconnected from their photos)
// rather than woven into the narrative.
function structure(detail) {
  const html = detail.description || '';
  const h2 = (html.match(/<h2\b/gi) || []).length;
  const h3 = (html.match(/<h3\b/gi) || []).length;
  const hasFaq = html.includes('data-faq');
  const hasNearby = /Что рядом/i.test(html);
  // trailing appended SEO sections = h2 blocks that sit after the main prose
  const tailMarkers = (html.match(/<h2[^>]*>\s*(История|Как добраться|Практическ|Маршрут в цифрах|Что посмотреть|Легенд)/gi) || []).length;
  return { h2, h3, hasFaq, hasNearby, tailMarkers, len: html.length };
}

async function main() {
  const args = parseArgs(process.argv);
  USER_ID = args.userId;
  ONLY = args.only.split(',').map((s) => s.trim()).filter(Boolean).map(Number);

  let list = await listAuthorTravels(USER_ID);
  // Nothing to scan is an environment failure, not "no duplicates": a green
  // report over an empty list is exactly what #1325 shipped for months.
  requireNonEmptySelection(list, {
    what: 'articles',
    source: `${API}/travels/`,
    hint: `user_id=${USER_ID}, publish=1, moderation=1`,
  });
  if (ONLY.length) {
    list = requireNonEmptySelection(list.filter((t) => ONLY.includes(t.id)), {
      message: `--only ${ONLY.join(',')} matched none of the ${list.length} published travels of user_id=${USER_ID}`,
    });
  }
  console.log(`scanning ${list.length} travels (user_id=${USER_ID})`);

  const report = [];
  let n = 0;
  for (const t of list) {
    n++;
    try {
      const detail = await getTravel(t.id);
      const findings = detect(detail);
      if (findings.length) {
        const bodyRepeats = findings.filter((f) => f.type === 'body-repeat').length;
        report.push({ id: t.id, slug: detail.slug, name: detail.name, structure: structure(detail), bodyRepeats, findings });
        const tags = [...new Set(findings.map((f) => f.type))].join(',');
        console.log(`  ⚠ #${String(t.id).padEnd(5)} br=${bodyRepeats} ${tags.padEnd(34)} ${(detail.name || '').slice(0, 50)}`);
      }
    } catch (e) {
      console.error(`  ❌ #${t.id} ${e.message}`);
    }
    if (n % 40 === 0) await new Promise((r) => setTimeout(r, 400));
  }

  // worst offenders first: most body-level repetition, then total findings
  report.sort((a, b) => (b.bodyRepeats - a.bodyRepeats) || (b.findings.length - a.findings.length));

  fs.writeFileSync(REPORT, JSON.stringify({ runAt: new Date().toISOString(), userId: USER_ID, total: list.length, affected: report.length, report }, null, 2));
  const withBodyRepeat = report.filter((r) => r.bodyRepeats > 0).length;
  console.log(`\n${report.length}/${list.length} articles flagged (${withBodyRepeat} with body-level repetition) → ${path.relative(process.cwd(), REPORT)}`);
}

if (require.main === module) {
  runSeoCli(main, { name: 'seo-find-dupes', usage: USAGE });
}

module.exports = {
  CLI_SPEC,
  USAGE,
  parseArgs,
  detect,
  paragraphs,
  stripFaqSection,
  jaccard,
  sharedShingles,
  PAIR_MIN_CHARS,
  PAIR_MIN_SIM,
};
