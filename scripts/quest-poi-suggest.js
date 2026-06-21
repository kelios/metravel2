#!/usr/bin/env node
/*
 * Suggests OPTIONAL points-of-interest near a quest's existing route — museums,
 * notable cafes, kosher/Jewish & themed restaurants, attractions/artwork — that
 * an editor may add as non-mandatory stops (a coffee pause, a museum detour like
 * the Czartoryski "Lady with an Ermine", a kosher restaurant in Kazimierz).
 *
 * Read-only: it queries OpenStreetMap (Overpass) and prints candidates with
 * coordinates + maps_url. It does NOT add anything — the editor picks.
 *
 * Examples:
 *   node scripts/quest-poi-suggest.js --quest-id=krakow-kazimierz --radius=200
 *   node scripts/quest-poi-suggest.js --quest-id=krakow-dragon --kinds=museum,kosher --json
 *
 * Notability: POIs with a name AND a wikidata/wikipedia tag rank first (these are
 * the "worth a detour" places); unnamed/no-wiki ones are filtered or de-ranked.
 */

const DEFAULT_API_URL = 'https://metravel.by';
const DEFAULT_RADIUS_M = 180;
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'metravel-quest-poi-suggest/1.0';

// Category -> Overpass tag filters (applied around the route).
const KINDS = {
  museum: ['node["tourism"="museum"]', 'way["tourism"="museum"]'],
  gallery: ['node["tourism"="gallery"]', 'way["tourism"="gallery"]'],
  attraction: ['node["tourism"="attraction"]', 'way["tourism"="attraction"]'],
  artwork: ['node["tourism"="artwork"]'],
  cafe: ['node["amenity"="cafe"]', 'node["shop"="coffee"]'],
  kosher: [
    'node["amenity"="restaurant"]["diet:kosher"~"yes|only"]',
    'node["amenity"="restaurant"]["cuisine"~"kosher|jewish",i]',
    'node["amenity"="cafe"]["cuisine"~"kosher|jewish",i]',
  ],
  viewpoint: ['node["tourism"="viewpoint"]'],
};

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

function mapsUrl(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${url}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

function parseSteps(bundle) {
  const raw = Array.isArray(bundle.steps) ? bundle.steps : JSON.parse(bundle.steps || '[]');
  return raw
    .filter((step) => !step.is_intro)
    .map((step) => ({ lat: toNumber(step.lat), lng: toNumber(step.lng), title: step.title }))
    .filter((p) => p.lat != null && p.lng != null);
}

async function fetchBundle(apiUrl, questId, sourceFile) {
  if (sourceFile) {
    const resolved = require('path').resolve(process.cwd(), sourceFile);
    const data = require(resolved);
    const quests = Array.isArray(data) ? data : [data];
    const quest = quests.find((q) => q?.quest_id === questId) || quests[0];
    if (!quest) throw new Error(`quest "${questId}" not found in ${sourceFile}`);
    return quest;
  }
  const base = apiUrl.replace(/\/+$/, '');
  return fetchJson(`${base}/api/quests/by-quest-id/${encodeURIComponent(questId)}/`);
}

function routeBounds(points, padDeg) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    Math.min(...lats) - padDeg,
    Math.min(...lngs) - padDeg,
    Math.max(...lats) + padDeg,
    Math.max(...lngs) + padDeg,
  ];
}

function buildOverpassQuery(bbox, kinds) {
  const filters = kinds.flatMap((k) => KINDS[k] || []);
  const body = filters.map((f) => `${f}(${bbox.join(',')});`).join('\n  ');
  return `[out:json][timeout:40];\n(\n  ${body}\n);\nout center tags;`;
}

function elementLatLng(el) {
  if (el.type === 'node') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function classify(tags) {
  if (tags.tourism === 'museum') return 'museum';
  if (tags.tourism === 'gallery') return 'gallery';
  if (tags.tourism === 'artwork') return 'artwork';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'attraction') return 'attraction';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'cafe' || tags.shop === 'coffee') return 'cafe';
  return tags.amenity || tags.tourism || tags.shop || 'poi';
}

function isKosher(tags) {
  return (
    /yes|only/i.test(tags['diet:kosher'] || '') ||
    /kosher|jewish/i.test(tags.cuisine || '')
  );
}

async function main() {
  if (hasArg('help')) {
    console.log(
      [
        'Usage: node scripts/quest-poi-suggest.js --quest-id=<id> [options]',
        '  --source-file=<path>  read route from a local quest-data.js instead of the API',
        '  --api-url=<url>       API base (default https://metravel.by)',
        '  --radius=<m>          search distance from the route (default 180)',
        `  --kinds=<list>        comma list of: ${Object.keys(KINDS).join(', ')} (default: museum,gallery,attraction,cafe,kosher)`,
        '  --limit=<n>           max suggestions per kind (default 6)',
        '  --named-only          drop POIs without a name (default on)',
        '  --json                machine-readable output',
      ].join('\n'),
    );
    return;
  }

  const apiUrl = getArg('api-url', DEFAULT_API_URL);
  const questId = getArg('quest-id', '');
  const sourceFile = getArg('source-file', '');
  const radius = Number(getArg('radius', DEFAULT_RADIUS_M));
  const perKind = Number(getArg('limit', 6));
  const asJson = hasArg('json');
  const kinds = getArg('kinds', 'museum,gallery,attraction,cafe,kosher')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => KINDS[k]);

  if (!questId) throw new Error('--quest-id is required (or pass --source-file with a single quest)');
  if (kinds.length === 0) throw new Error(`no valid --kinds; choose from: ${Object.keys(KINDS).join(', ')}`);

  const bundle = await fetchBundle(apiUrl, questId, sourceFile);
  const points = parseSteps(bundle);
  if (points.length === 0) throw new Error('quest has no usable step coordinates');

  // ~0.0016 deg ≈ 180m padding; widen a touch beyond the requested radius.
  const padDeg = Math.max(radius, 120) / 111000 + 0.0005;
  const bbox = routeBounds(points, padDeg);
  const query = buildOverpassQuery(bbox, kinds);

  const res = await fetchJson(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`);
  const existing = points;

  const candidates = [];
  for (const el of res.elements || []) {
    const ll = elementLatLng(el);
    const tags = el.tags || {};
    if (!ll) continue;
    const name = tags.name || tags['name:en'] || tags['name:ru'] || '';
    if (!name) continue; // named-only (default)

    const distToRoute = Math.min(...existing.map((p) => haversineMeters(p.lat, p.lng, ll.lat, ll.lng)));
    if (distToRoute > radius) continue;
    // Skip POIs that essentially coincide with an existing point (already a stop).
    if (distToRoute < 12) continue;

    const notable = !!(tags.wikidata || tags.wikipedia);
    candidates.push({
      name,
      kind: classify(tags),
      kosher: isKosher(tags),
      notable,
      lat: Number(ll.lat.toFixed(6)),
      lng: Number(ll.lng.toFixed(6)),
      maps_url: mapsUrl(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6))),
      dist_to_route_m: Math.round(distToRoute),
      address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || null,
      cuisine: tags.cuisine || null,
      opening_hours: tags.opening_hours || null,
      website: tags.website || tags['contact:website'] || tags.url || null,
      phone: tags.phone || tags['contact:phone'] || null,
      wikipedia: tags.wikipedia || null,
    });
  }

  // Group by kind, notable first, then nearest to route.
  const byKind = {};
  for (const c of candidates) {
    const bucket = c.kosher ? 'kosher' : c.kind;
    (byKind[bucket] = byKind[bucket] || []).push(c);
  }
  const grouped = {};
  for (const [kind, list] of Object.entries(byKind)) {
    grouped[kind] = list
      .sort((a, b) => Number(b.notable) - Number(a.notable) || a.dist_to_route_m - b.dist_to_route_m)
      .slice(0, perKind);
  }

  if (asJson) {
    console.log(JSON.stringify({ quest_id: bundle.quest_id || questId, radius_m: radius, kinds, suggestions: grouped }, null, 2));
    return;
  }

  console.log(`\n${bundle.quest_id || questId}: optional POIs within ${radius}m of the route\n`);
  for (const kind of Object.keys(grouped)) {
    console.log(`### ${kind}`);
    for (const c of grouped[kind]) {
      console.log(
        `  ${c.notable ? '★' : ' '} ${c.name}${c.kosher ? ' [kosher]' : ''} — ${c.dist_to_route_m}m  ${c.lat},${c.lng}  ${c.maps_url}`
          + (c.address ? `  (${c.address})` : '')
          + (c.cuisine ? `  cuisine:${c.cuisine}` : ''),
      );
      if (c.opening_hours || c.website) {
        console.log(
          `      ${c.opening_hours ? '🕒 ' + c.opening_hours : '🕒 часы не указаны в OSM — проверить'}`
            + (c.website ? `   ${c.website}` : ''),
        );
      }
    }
    console.log('');
  }
  const total = Object.values(grouped).reduce((n, l) => n + l.length, 0);
  console.log(`${total} suggestions (★ = notable: has wikidata/wikipedia). Editor picks which to add as OPTIONAL points.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
