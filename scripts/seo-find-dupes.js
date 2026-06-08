#!/usr/bin/env node
/**
 * Scan one author's published travels for DUPLICATED text introduced by
 * repeated SEO edits (lead/append injected more than once).
 *
 * Detects three patterns inside the article `description` HTML:
 *   1. exact-dup    — the same normalised paragraph text appears 2+ times
 *   2. near-dup     — two paragraphs share a high word-overlap (Jaccard ≥ 0.55),
 *                     min length 60 chars — typically two definitional leads
 *   3. double-lead  — among the first 3 paragraphs, two are near-dup intros
 *                     (both contain the place name + an em-dash definition)
 *
 * Read-only: writes a JSON report, mutates nothing.
 *
 * Usage:
 *   node scripts/seo-find-dupes.js --user-id 1
 *   node scripts/seo-find-dupes.js --user-id 1 --only 384,362
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const API = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '');
const REPORT = path.join(__dirname, '.seo-dupes-report.json');

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const USER_ID = getArg('user-id', '1');
const ONLY = (getArg('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const o = { method: 'GET', timeout: 30000, headers: { 'Cache-Control': 'no-cache' }, ...opts };
    if (mod === https) o.rejectUnauthorized = false;
    const req = mod.request(url, o, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(buf ? JSON.parse(buf) : null); } catch { resolve(buf); }
        } else reject(new Error(`HTTP ${res.statusCode} ${url}`));
      });
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

function normalize(t) {
  return t.toLowerCase().replace(/[«»"'(),.:;—–-]/g, ' ').replace(/\s+/g, ' ').trim();
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

function detect(detail) {
  const html = detail.description || '';
  const ps = paragraphs(html).filter((p) => p.text.length >= 40);
  const findings = [];

  // 1. exact duplicates
  const seen = new Map();
  for (const p of ps) {
    const key = normalize(p.text);
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
      if (head[i].text.length < 60 || head[j].text.length < 60) continue;
      if (findings.some((f) => f.type === 'exact-dup' && f.a === head[i].idx && f.b === head[j].idx)) continue;
      const sh = sharedShingles(head[i].text, head[j].text);
      const sim = jaccard(head[i].text, head[j].text);
      const leadZone = head[i].idx <= 2 && head[j].idx <= 2;
      if (sh.n >= (leadZone ? 2 : 3) || sim >= 0.5) {
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

  return findings;
}

async function main() {
  let list = await listAuthorTravels(USER_ID);
  if (ONLY.length) list = list.filter((t) => ONLY.includes(t.id));
  console.log(`scanning ${list.length} travels (user_id=${USER_ID})`);

  const report = [];
  let n = 0;
  for (const t of list) {
    n++;
    try {
      const detail = await getTravel(t.id);
      const findings = detect(detail);
      if (findings.length) {
        report.push({ id: t.id, slug: detail.slug, name: detail.name, findings });
        console.log(`  ⚠ #${String(t.id).padEnd(5)} ${findings.map((f) => f.type).join(',')}  ${(detail.name || '').slice(0, 55)}`);
      }
    } catch (e) {
      console.error(`  ❌ #${t.id} ${e.message}`);
    }
    if (n % 40 === 0) await new Promise((r) => setTimeout(r, 400));
  }

  fs.writeFileSync(REPORT, JSON.stringify({ runAt: new Date().toISOString(), userId: USER_ID, total: list.length, affected: report.length, report }, null, 2));
  console.log(`\n${report.length}/${list.length} articles with duplicates → ${path.relative(process.cwd(), REPORT)}`);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
