#!/usr/bin/env node
/**
 * Scan all published travels on metravel.by for broken internal links.
 *
 * Output: scripts/.seo-broken-links/report.json with structure:
 *   { generatedAt, totalScanned, totalLinks, broken: [{srcId, srcSlug, srcUrl, href, kind, reason}] }
 *
 * Internal hrefs we care about:
 *   /travels/<slug>          → must exist in published-travel slug set
 *   /quests/<city>/<questId> → must exist in /api/quests catalog
 *   #anchor / mailto:/tel:   → ignored
 *   http(s)://metravel.by/…  → normalised to relative and checked
 *   other absolute URLs      → ignored (we only fix internal)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '');
const OUT_DIR = path.join(__dirname, '.seo-broken-links');

function getJson(url) {
  return new Promise((resolve, reject) => {
    const opts = { timeout: 60000, rejectUnauthorized: false };
    https
      .get(url, opts, (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} on ${url}`));
          }
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            reject(new Error(`Bad JSON from ${url}: ${e.message}`));
          }
        });
      })
      .on('error', reject)
      .on('timeout', () => reject(new Error(`timeout ${url}`)));
  });
}

async function fetchAllTravels() {
  const items = [];
  let page = 1;
  const limit = 100;
  for (;;) {
    const data = await getJson(`${API_BASE}/travels/?limit=${limit}&page=${page}`);
    if (!data || !Array.isArray(data.data)) break;
    items.push(...data.data);
    if (!data.next_page_url || data.data.length === 0) break;
    page += 1;
    if (page > 50) break; // safety
  }
  return items;
}

async function fetchTravelDetail(id) {
  return getJson(`${API_BASE}/travels/${id}/`);
}

async function fetchQuests() {
  try {
    const data = await getJson(`${API_BASE}/quests/`);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  } catch (e) {
    console.warn(`[warn] quests fetch failed: ${e.message}`);
    return [];
  }
}

function extractHrefs(html) {
  if (!html || typeof html !== 'string') return [];
  const out = [];
  const re = /<a\b[^>]*\shref\s*=\s*(["'])(.*?)\1/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = (m[2] || '').trim();
    if (href) out.push(href);
  }
  return out;
}

function normaliseHref(href) {
  if (!href) return null;
  if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return null;
  if (href.startsWith('#')) return null;
  let url = href;
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);
      if (u.hostname !== 'metravel.by' && u.hostname !== 'www.metravel.by') return null;
      url = u.pathname + (u.search || '') + (u.hash || '');
    }
  } catch {
    return null;
  }
  if (!url.startsWith('/')) return null;
  url = url.split('#')[0].split('?')[0];
  url = url.replace(/\/+$/, '');
  return url || '/';
}

function classify(pathname) {
  if (pathname.startsWith('/travels/')) {
    const slug = pathname.slice('/travels/'.length);
    return { kind: 'travel', slug };
  }
  if (pathname.startsWith('/quests/')) {
    const parts = pathname.slice('/quests/'.length).split('/').filter(Boolean);
    if (parts.length === 0) return { kind: 'quests-index' };
    if (parts.length === 1) return { kind: 'quest-city', city: parts[0] };
    return { kind: 'quest-detail', city: parts[0], questId: parts[1] };
  }
  if (pathname === '/' || pathname === '/travels' || pathname === '/quests' || pathname === '/articles') {
    return { kind: 'static', pathname };
  }
  return { kind: 'other', pathname };
}

async function main() {
  console.log('Fetching list of all travels…');
  const summary = await fetchAllTravels();
  console.log(`  got ${summary.length} entries`);

  const validSlugs = new Set();
  for (const t of summary) {
    if (t && t.slug) validSlugs.add(String(t.slug));
  }

  console.log('Fetching quests catalog…');
  const quests = await fetchQuests();
  const validQuestIds = new Set();
  const validQuestCities = new Set();
  for (const q of quests) {
    if (!q) continue;
    if (q.id != null) validQuestIds.add(String(q.id));
    if (q.slug) validQuestIds.add(String(q.slug));
    if (q.city) validQuestCities.add(String(q.city).toLowerCase());
    if (q.city_slug) validQuestCities.add(String(q.city_slug).toLowerCase());
  }
  console.log(`  quests: ${quests.length} entries, ${validQuestIds.size} ids, ${validQuestCities.size} cities`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const broken = [];
  let totalLinks = 0;
  let scanned = 0;

  for (const t of summary) {
    scanned += 1;
    let detail;
    try {
      detail = await fetchTravelDetail(t.id);
    } catch (e) {
      console.warn(`[skip ${t.id}] ${e.message}`);
      continue;
    }
    const html = detail.description || '';
    const hrefs = extractHrefs(html);
    totalLinks += hrefs.length;
    if (hrefs.length === 0) continue;

    for (const rawHref of hrefs) {
      const path = normaliseHref(rawHref);
      if (!path) continue;
      const c = classify(path);
      let reason = null;
      if (c.kind === 'travel') {
        if (!validSlugs.has(c.slug)) reason = 'travel slug not found';
      } else if (c.kind === 'quest-detail') {
        if (!validQuestIds.has(c.questId)) reason = 'quest id not found';
      }
      if (reason) {
        broken.push({
          srcId: detail.id,
          srcName: detail.name,
          srcUrl: detail.url,
          href: rawHref,
          path,
          kind: c.kind,
          reason,
        });
      }
    }

    if (scanned % 25 === 0) {
      console.log(`  scanned ${scanned}/${summary.length}, broken so far: ${broken.length}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalScanned: scanned,
    totalLinks,
    brokenCount: broken.length,
    validSlugCount: validSlugs.size,
    broken,
  };
  const out = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n→ wrote ${out}`);
  console.log(`Summary: scanned ${scanned}, total internal links ${totalLinks}, broken ${broken.length}`);

  const grouped = new Map();
  for (const b of broken) {
    const key = `${b.srcId} ${b.srcName}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(b);
  }
  if (grouped.size) {
    console.log('\nBroken links by article:');
    for (const [k, list] of grouped) {
      console.log(`  ${k}`);
      for (const b of list) {
        console.log(`    ${b.kind}  ${b.path}   (${b.reason})`);
      }
    }
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message);
    process.exit(1);
  });
}
