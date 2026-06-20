#!/usr/bin/env node
/*
 * Audits quest step coordinates against public OSM/Nominatim search results.
 *
 * Example:
 *   node scripts/audit-quest-coordinates.js --quest-id=warsaw-syrenka --threshold=80
 *
 * This script is intentionally read-only. It is a content QA helper, not a
 * migration tool: it reports suspicious points so an editor can choose the
 * correct stand point or object geometry before patching backend data.
 */

const DEFAULT_API_URL = 'https://metravel.by';
const DEFAULT_THRESHOLD_METERS = 80;
const USER_AGENT = 'metravel-quest-coordinate-audit/1.0';

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(aLat, aLng, bLat, bLng) {
  const radius = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stripAnswerPrefix(value) {
  return normalizeWhitespace(value)
    .replace(/^\d+[\s.)-]+/, '')
    .replace(/\s+-\s+.+$/, '')
    .trim();
}

function stripGoogleMapsCoordinateQuery(url) {
  const match = String(url || '').match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  return match ? null : undefined;
}

function extractMapsQuery(mapsUrl) {
  try {
    const parsed = new URL(String(mapsUrl || ''));
    const q = parsed.searchParams.get('q');
    if (q && !/^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(q.trim())) return q;
  } catch {
    // Ignore malformed URLs.
  }
  return '';
}

function buildStepQuery(step, cityName, referenceQueries) {
  const key = String(step.step_id || step.id || '').trim();
  if (key && referenceQueries.has(key)) return referenceQueries.get(key);

  const mapsUrl = String(step.maps_url || step.mapsUrl || '');
  if (stripGoogleMapsCoordinateQuery(mapsUrl) === undefined) {
    const q = extractMapsQuery(mapsUrl);
    if (q) return q;
  }

  const location = stripAnswerPrefix(step.location);
  const title = stripAnswerPrefix(step.title);
  const parenthetical = [location, title]
    .map((value) => String(value || '').match(/\(([^)]+)\)/)?.[1])
    .find(Boolean);
  if (parenthetical) return normalizeWhitespace([parenthetical, cityName].filter(Boolean).join(', '));

  const base = location || title;
  return normalizeWhitespace([base, cityName].filter(Boolean).join(', '));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${url}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

async function searchNominatim(query, limit = 3) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=' +
    encodeURIComponent(String(limit)) +
    '&q=' +
    encodeURIComponent(query);
  return fetchJson(url);
}

function parseSteps(bundle) {
  const raw = Array.isArray(bundle.steps) ? bundle.steps : JSON.parse(bundle.steps || '[]');
  return raw.filter((step) => !step.is_intro);
}

async function fetchQuestBundles(apiUrl, questId) {
  const base = apiUrl.replace(/\/+$/, '');
  if (questId) {
    return [await fetchJson(`${base}/api/quests/by-quest-id/${encodeURIComponent(questId)}/`)];
  }

  // The list endpoint is paginated: { data | results, next_page_url }. Walk
  // every page and collect quest_ids before expanding each bundle.
  const ids = [];
  let url = `${base}/api/quests/`;
  const seen = new Set();
  while (url && !seen.has(url)) {
    seen.add(url);
    const page = await fetchJson(url);
    const rows = Array.isArray(page) ? page : page.data || page.results || [];
    for (const quest of rows) {
      if (quest?.quest_id) ids.push(quest.quest_id);
    }
    const next = Array.isArray(page) ? null : page.next_page_url || page.next || null;
    url = next ? (next.startsWith('http') ? next : `${base}${next}`) : null;
  }

  const bundles = [];
  for (const id of ids) {
    bundles.push(await fetchJson(`${base}/api/quests/by-quest-id/${encodeURIComponent(id)}/`));
  }
  return bundles;
}

function loadReferenceQueries(sourceFile, questId) {
  const queries = new Map();
  if (!sourceFile) return queries;

  const resolved = require('path').resolve(process.cwd(), sourceFile);
  const data = require(resolved);
  const quests = Array.isArray(data) ? data : [data];
  const quest = questId ? quests.find((item) => item?.quest_id === questId) : quests[0];
  if (!quest) return queries;

  for (const step of quest.steps || []) {
    const q = extractMapsQuery(step.mapsUrl || step.maps_url);
    if (step.step_id && q) queries.set(String(step.step_id), q);
  }
  return queries;
}

async function auditQuest(bundle, options) {
  const cityName = bundle.city?.name || bundle.city_name || '';
  const steps = parseSteps(bundle);
  let issues = 0;

  console.log(`\n${bundle.quest_id || bundle.title}: ${steps.length} steps`);

  for (const step of steps) {
    const lat = toNumber(step.lat);
    const lng = toNumber(step.lng);
    const label = `${step.order || '?'} ${step.step_id || step.id}`;

    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      issues += 1;
      console.log(`  FAIL ${label}: invalid coordinates ${step.lat},${step.lng}`);
      continue;
    }

    const query = buildStepQuery(step, cityName, options.referenceQueries);
    if (!query) {
      console.log(`  SKIP ${label}: no searchable title/location`);
      continue;
    }

    const results = await searchNominatim(query, options.limit);
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));

    if (!Array.isArray(results) || results.length === 0) {
      console.log(`  WARN ${label}: no Nominatim result for "${query}"`);
      continue;
    }

    const ranked = results
      .map((result, index) => {
        const rLat = Number(result.lat);
        const rLng = Number(result.lon);
        return {
          index,
          lat: rLat,
          lng: rLng,
          distance: haversineMeters(lat, lng, rLat, rLng),
          result,
        };
      })
      .filter((item) => Number.isFinite(item.distance));

    const first = ranked[0];
    const nearest = ranked.slice().sort((a, b) => a.distance - b.distance)[0];
    const firstDistance = Math.round(first.distance);
    const nearestDistance = Math.round(nearest.distance);
    const firstKind = `${first.result.class || '?'}/${first.result.type || '?'}`;
    const nearestKind = `${nearest.result.class || '?'}/${nearest.result.type || '?'}`;
    const status = first.distance > options.thresholdMeters ? 'FAIL' : 'OK';

    if (status === 'FAIL') issues += 1;

    console.log(
      `  ${status} ${label}: ${lat.toFixed(6)},${lng.toFixed(6)} -> first ${firstDistance}m (${firstKind}) via "${query}"`,
    );

    if (nearest.index !== first.index) {
      console.log(`       nearest candidate: ${nearestDistance}m (${nearestKind}) ${nearest.result.display_name}`);
    }
    console.log(`       first candidate:   ${first.result.display_name}`);
  }

  return issues;
}

async function main() {
  const apiUrl = getArg('api-url', DEFAULT_API_URL);
  const questId = getArg('quest-id', '');
  const thresholdMeters = Number(getArg('threshold', DEFAULT_THRESHOLD_METERS));
  const limit = Number(getArg('limit', 3));
  const delayMs = Number(getArg('delay-ms', 1100));
  const sourceFile = getArg('source-file', '');

  if (hasArg('help')) {
    console.log(
      'Usage: node scripts/audit-quest-coordinates.js [--quest-id=id] [--api-url=url] [--source-file=path] [--threshold=80]',
    );
    return;
  }

  const bundles = await fetchQuestBundles(apiUrl, questId);
  const referenceQueries = loadReferenceQueries(sourceFile, questId);
  let issues = 0;
  for (const bundle of bundles) {
    issues += await auditQuest(bundle, { thresholdMeters, limit, delayMs, referenceQueries });
  }

  console.log(`\nCoordinate audit issues: ${issues}`);
  if (issues > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
