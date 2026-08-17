#!/usr/bin/env node
/*
 * Geo-verifies quest step coordinates against public OSM/Nominatim.
 *
 * Unlike audit-quest-coordinates.js (forward search only), this also REVERSE
 * geocodes the stored point ("what is actually at these coordinates") to catch
 * markers that landed on a parking lot / bus stop / road instead of the POI the
 * task describes, and it prints a ready-to-paste suggested coordinate + maps_url
 * for every suspicious point. Works on a LOCAL quest data file (during
 * authoring, before migration) or on the live API (existing quest).
 *
 * Read-only: it never writes to the backend. An editor reviews the suggestions
 * and applies them via apply-quest-patches.js (prod) or by editing the data file.
 *
 * Examples:
 *   # local data file, single quest, human report
 *   node scripts/quest-geocheck.js --source-file=scripts/krakow-quest-data.js --quest-id=krakow-kazimezh
 *   # live quest from prod, machine-readable
 *   node scripts/quest-geocheck.js --quest-id=warsaw-syrenka --json
 *   # all live quests
 *   node scripts/quest-geocheck.js
 */

const {
  fetchQuestBundles,
  loadLocalBundles,
  parseSteps: parseRawSteps,
} = require('./lib/questBundles');

const DEFAULT_API_URL = 'https://metravel.by';
const DEFAULT_THRESHOLD_METERS = 60;
// A hop that moves the player back along the route's main axis by more than this
// (into already-covered territory) is flagged as backtracking. Small side-steps
// (e.g. a church one corner north of the start) stay under it.
const DEFAULT_BACKTRACK_METERS = 150;
// Adult walking-quest length budget: straight-line sum of consecutive legs.
// Streets add ~15–25% on top, so 4000 m straight ≈ 4.5–5 km actually walked —
// the ceiling a family covers on foot. Kids quests need a lower --max-route-m.
const DEFAULT_MAX_ROUTE_METERS = 4000;
const DEFAULT_MAX_LEG_METERS = 1200;
const USER_AGENT = 'metravel-quest-geocheck/1.0';

// Reverse-geocode categories that mean "you placed the point on infrastructure,
// not on the object the task is about". Flagged as a likely mis-placed marker.
const INFRA_TYPES = new Set([
  'parking',
  'parking_space',
  'parking_entrance',
  'bus_stop',
  'tram_stop',
  'station',
  'platform',
  'footway',
  'pedestrian',
  'service',
  'track',
  'residential',
  'unclassified',
  'cycleway',
  'path',
  'crossing',
]);

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

// Parentheticals that are editorial notes, not place names — ignore them.
const NOTE_PARENTHETICAL = /^(по желанию|опционально|optional|на выбор|см\.?\s|see\s|map|карт)/i;

// Strip leading emoji/symbols and an editorial note in parentheses, e.g.
// "☕ Good Day Coffee & Cake (по желанию)" -> "Good Day Coffee & Cake".
function cleanPlaceText(value) {
  return normalizeWhitespace(
    String(value || '')
      .replace(/\([^)]*\)\s*$/u, (m) => (NOTE_PARENTHETICAL.test(m.slice(1, -1).trim()) ? '' : m))
      .replace(/^[^\p{L}\p{N}]+/u, ''),
  );
}

// Build the most specific searchable place string for a step. Prefers a
// human place name from maps_url (?q=Name), then a parenthetical proper name
// inside location/title, then location/title text — always suffixed with city.
function withCity(base, cityName) {
  if (!base) return '';
  const hasCity = cityName && base.toLowerCase().includes(String(cityName).toLowerCase());
  return normalizeWhitespace([base, hasCity ? '' : cityName].filter(Boolean).join(', '));
}

function buildStepQuery(step, cityName) {
  const fromMaps = extractMapsQuery(step.maps_url || step.mapsUrl);
  if (fromMaps) return withCity(fromMaps, cityName);

  const location = cleanPlaceText(stripAnswerPrefix(step.location));
  const title = cleanPlaceText(stripAnswerPrefix(step.title));
  const parenthetical = [location, title]
    .map((value) => String(value || '').match(/\(([^)]+)\)/)?.[1])
    .filter((p) => p && !NOTE_PARENTHETICAL.test(p.trim()))[0];
  if (parenthetical) return withCity(parenthetical, cityName);

  return withCity(location || title, cityName);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${url}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

async function searchNominatim(query, limit) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=' +
    encodeURIComponent(String(limit)) +
    '&q=' +
    encodeURIComponent(query);
  return fetchJson(url);
}

async function reverseNominatim(lat, lng) {
  const url =
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' +
    encodeURIComponent(String(lat)) +
    '&lon=' +
    encodeURIComponent(String(lng));
  return fetchJson(url);
}

function mapsUrl(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function kindOf(result) {
  return `${result?.category || result?.class || '?'}/${result?.type || '?'}`;
}

function isInfra(result) {
  return INFRA_TYPES.has(String(result?.type || ''));
}

// Bundle loading (paginated catalog walk, local data files) lives in
// scripts/lib/questBundles.js — shared with the other quest audit scripts.
// Intro steps are not a location to verify, so they are dropped here.
function parseSteps(bundle) {
  return parseRawSteps(bundle).filter((step) => !step.is_intro);
}

// --- Address verification helpers ---------------------------------------
// The `location` field is a human-readable address shown in the UI
// (e.g. "ul. Szeroka 40"). We geocode it and compare to the stored point,
// and we compare the reverse-geocoded street/house at the point to the
// stated address — catching "address says X but the marker is on a parking lot".

const STREET_RE = /(\bul\.?\b|\bulica\b|\bpl\.?\b|\bplac\b|\bal\.?\b|\baleja\b|\bпросп|\bулица\b|\bпер\.?\b|\bвул\.?\b|\bвулиц|\bstreet\b|\bstr\.?\b|\brue\b|\bvia\b)/i;

function looksLikeAddress(location) {
  const s = normalizeWhitespace(location);
  if (!s) return false;
  // a street keyword, or a bare "<word> <number>" that reads like an address
  return STREET_RE.test(s) || /[\p{L}].*\b\d{1,4}[a-z]?\b/u.test(s);
}

function parseHouseNumber(location) {
  const m = normalizeWhitespace(location).match(/\b(\d{1,4})[a-z]?\b/);
  return m ? m[1] : null;
}

// Street name from the stated address: drop the street keyword and house number.
function parseStreetName(location) {
  return normalizeWhitespace(
    String(location || '')
      .replace(STREET_RE, ' ')
      .replace(/\b\d{1,4}[a-z]?\b/g, ' ')
      .replace(/[(),]/g, ' '),
  ).toLowerCase();
}

function normStreet(value) {
  return normalizeWhitespace(value).toLowerCase().replace(/[.,]/g, '');
}

// Nominatim fails on a leading street-type prefix ("ul. Szeroka 40" -> nothing,
// but "Szeroka 40" -> the building). Strip it before geocoding the address.
function stripStreetPrefix(value) {
  return normalizeWhitespace(
    String(value || '').replace(
      /^\s*(ul\.?|ulica|pl\.?|plac|al\.?|aleja|aleje|вул\.?|вулиця|ул\.?|улица|str\.?|street|rue|via)\s+/i,
      '',
    ),
  );
}

// --- Route-order (anti-backtracking) analysis ---------------------------
// Pure geometry, no network. Projects the steps (in `order`) onto the route's
// principal axis (PCA) and flags any hop that jumps back into already-covered
// territory — the "1→2→3, back to 1, then 4" mistake. Small detours (a point a
// corner behind the start) stay under DEFAULT_BACKTRACK_METERS.
function analyzeRouteOrder(steps, backtrackMeters, limits) {
  const pts = steps
    .map((s, i) => ({
      i,
      order: typeof s.order === 'number' ? s.order : i + 1,
      id: s.step_id || s.id || String(i + 1),
      title: s.title || '',
      lat: toNumber(s.lat),
      lng: toNumber(s.lng),
    }))
    .filter((p) => p.lat != null && p.lng != null && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    .sort((a, b) => a.order - b.order || a.i - b.i);

  // Straight-line route budget (sum of consecutive legs + longest leg).
  let totalM = 0;
  let maxLeg = null;
  for (let k = 1; k < pts.length; k += 1) {
    const d = haversineMeters(pts[k - 1].lat, pts[k - 1].lng, pts[k].lat, pts[k].lng);
    totalM += d;
    if (!maxLeg || d > maxLeg.m) {
      maxLeg = { m: d, from: `${pts[k - 1].order} ${pts[k - 1].id}`, to: `${pts[k].order} ${pts[k].id}` };
    }
  }
  const length = {
    total_m: Math.round(totalM),
    max_leg: maxLeg ? { ...maxLeg, m: Math.round(maxLeg.m) } : null,
    max_route_m: limits ? limits.maxRouteMeters : DEFAULT_MAX_ROUTE_METERS,
    max_leg_m: limits ? limits.maxLegMeters : DEFAULT_MAX_LEG_METERS,
  };
  length.over_route = length.max_route_m > 0 && length.total_m > length.max_route_m;
  length.over_leg = length.max_leg_m > 0 && !!maxLeg && maxLeg.m > length.max_leg_m;

  if (pts.length < 3) return { analyzed: false, backtracks: [], length };

  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng0 = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  const mPerLat = 110540;
  const mPerLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const xy = pts.map((p) => ({ ...p, x: (p.lng - lng0) * mPerLng, y: (p.lat - lat0) * mPerLat }));

  // Principal axis of the point cloud (dominant travel direction).
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of xy) {
    sxx += p.x * p.x;
    syy += p.y * p.y;
    sxy += p.x * p.y;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ax = Math.cos(theta);
  let ay = Math.sin(theta);
  // Orient the axis so "forward" points from the first step toward the last.
  const first = xy[0];
  const last = xy[xy.length - 1];
  if ((last.x - first.x) * ax + (last.y - first.y) * ay < 0) {
    ax = -ax;
    ay = -ay;
  }
  for (const p of xy) p.t = p.x * ax + p.y * ay;

  // Compass label for the forward direction (y = north, x = east).
  const dir =
    Math.abs(ay) >= Math.abs(ax)
      ? ay < 0
        ? 'север→юг'
        : 'юг→север'
      : ax >= 0
        ? 'запад→восток'
        : 'восток→запад';

  const backtracks = [];
  let runMax = xy[0].t;
  for (let k = 1; k < xy.length; k += 1) {
    const back = runMax - xy[k].t;
    if (back > backtrackMeters) {
      backtracks.push({
        from: `${xy[k - 1].order} ${xy[k - 1].id}`,
        to: `${xy[k].order} ${xy[k].id}`,
        to_title: xy[k].title,
        back_m: Math.round(back),
        hop_m: Math.round(Math.hypot(xy[k].x - xy[k - 1].x, xy[k].y - xy[k - 1].y)),
      });
    }
    if (xy[k].t > runMax) runMax = xy[k].t;
  }

  return { analyzed: true, axis_dir: dir, backtracks, length };
}

async function geocheckQuest(bundle, options) {
  const cityName = bundle.city?.name || bundle.city_name || '';
  const steps = parseSteps(bundle);
  const stepReports = [];

  // --route-only: pure-geometry mode (length/order), no Nominatim calls.
  const stepsToGeocode = options.routeOnly ? [] : steps;

  for (const step of stepsToGeocode) {
    const label = `${step.order || '?'} ${step.step_id || step.id}`;
    const lat = toNumber(step.lat);
    const lng = toNumber(step.lng);

    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      stepReports.push({
        label,
        title: step.title,
        verdict: 'FAIL',
        reason: `invalid coordinates ${step.lat},${step.lng}`,
        stored: null,
      });
      continue;
    }

    const query = buildStepQuery(step, cityName);

    // Reverse: what is actually at the stored point?
    let here = null;
    try {
      here = await reverseNominatim(lat, lng);
    } catch (error) {
      here = { error: error.message || String(error) };
    }
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));

    // Forward: where does the place name actually resolve to?
    let candidates = [];
    if (query) {
      try {
        const results = await searchNominatim(query, options.limit);
        candidates = (Array.isArray(results) ? results : [])
          .map((result) => ({
            lat: Number(result.lat),
            lng: Number(result.lon),
            kind: kindOf(result),
            infra: isInfra(result),
            name: result.display_name,
            importance: Number(result.importance) || 0,
            distance: haversineMeters(lat, lng, Number(result.lat), Number(result.lon)),
          }))
          .filter((c) => Number.isFinite(c.distance));
      } catch (error) {
        candidates = [];
        here = here || {};
        here.searchError = error.message || String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    const byDistance = candidates.slice().sort((a, b) => a.distance - b.distance);
    const nearest = byDistance[0] || null;
    // Best "real POI" candidate (not infrastructure), nearest among those.
    const bestPoi = byDistance.find((c) => !c.infra) || null;
    const hereInfra = here && !here.error ? isInfra(here) : false;

    // Address check: geocode the stated `location` address, compare to point,
    // and compare the reverse-geocoded street/house at the point to the address.
    let address = null;
    const stated = normalizeWhitespace(step.location);
    if (looksLikeAddress(stated)) {
      let expected = null;
      try {
        // Build the address query with the LATIN locality + country from the
        // reverse result (the data's city is often Cyrillic, e.g. "Краков",
        // which fails to geocode against a Polish street like "ul. Szeroka 40").
        const hereA = here && !here.error ? here.address || {} : {};
        const locality = hereA.city || hereA.town || hereA.village || hereA.municipality || cityName;
        const country = hereA.country || '';
        const placeText = stripStreetPrefix(cleanPlaceText(stated));
        const parts = [placeText];
        if (locality && !placeText.toLowerCase().includes(String(locality).toLowerCase())) parts.push(locality);
        if (country) parts.push(country);
        const res = await searchNominatim(normalizeWhitespace(parts.filter(Boolean).join(', ')), 1);
        const top = Array.isArray(res) ? res[0] : null;
        if (top) {
          expected = {
            lat: Number(top.lat),
            lng: Number(top.lon),
            kind: kindOf(top),
            name: top.display_name,
            distance: haversineMeters(lat, lng, Number(top.lat), Number(top.lon)),
          };
        }
      } catch (error) {
        expected = { error: error.message || String(error) };
      }
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));

      const statedStreet = parseStreetName(stated);
      const hereAddr = here && !here.error ? here.address || {} : {};
      const hereStreet = normStreet(hereAddr.road || hereAddr.pedestrian || hereAddr.footway || '');
      const ns = normStreet(statedStreet);
      address = {
        stated,
        street: statedStreet || null,
        house: parseHouseNumber(stated),
        expected,
        here_road: hereAddr.road || null,
        here_house: hereAddr.house_number || null,
        street_match: ns && hereStreet ? hereStreet.includes(ns) || ns.includes(hereStreet) : null,
      };
    }
    const addrExpected = address && address.expected && !address.expected.error ? address.expected : null;
    // Only a house-numbered address pins a specific building reliably. A
    // street-only address ("ul. Józefa") geocodes to an arbitrary point along
    // the street, so it must NOT drive a FAIL or a high-confidence suggestion.
    const addrPrecise = !!(addrExpected && address && address.house);
    const addrFar = !!(addrPrecise && addrExpected.distance > options.thresholdMeters);

    // Verdict (priority): stated-address mismatch > title match far > on-infra.
    //  FAIL — point is far from the place it should be (by address or by name).
    //  WARN — point sits on infrastructure (parking/stop/road) per reverse geocode.
    //  OK   — resolves within threshold and isn't on infrastructure.
    const titleFar = !!(nearest && nearest.distance > options.thresholdMeters);
    let verdict = 'OK';
    let reason = '';
    if (!query && !address) {
      verdict = 'SKIP';
      reason = 'no searchable title/location';
    } else if (addrFar) {
      verdict = 'FAIL';
      reason = `stated address "${stated}" geocodes ~${Math.round(addrExpected.distance)}m from the point`
        + (hereInfra ? ` — point is on ${kindOf(here)}` : '');
    } else if (titleFar) {
      verdict = 'FAIL';
      reason = `nearest match "${query}" is ${Math.round(nearest.distance)}m away (> ${options.thresholdMeters}m)`;
    } else if (hereInfra) {
      verdict = 'WARN';
      reason = `point sits on ${kindOf(here)} (infrastructure, not the object)`
        + (address && address.house && address.street_match === false ? `; stated "${stated}"` : '');
    } else if (query && candidates.length === 0 && !addrExpected) {
      verdict = 'WARN';
      reason = `no Nominatim result for "${query}" — verify manually`;
    } else {
      reason = `match within ${Math.round((nearest && nearest.distance) || (addrExpected && addrExpected.distance) || 0)}m`;
    }

    // Suggestion when not OK: prefer the geocoded address (most precise, has a
    // house number), else the nearest real-POI candidate.
    let suggestion = null;
    if (verdict !== 'OK' && verdict !== 'SKIP') {
      const poi = bestPoi || nearest;
      const chosen =
        addrPrecise && addrExpected.distance >= 8
          ? { ...addrExpected, confidence: 'high' }
          : poi && poi.distance >= 8
            ? { ...poi, confidence: poi.infra ? 'low' : 'medium' }
            : null;
      if (chosen) {
        const slat = Number(chosen.lat.toFixed(6));
        const slng = Number(chosen.lng.toFixed(6));
        suggestion = {
          lat: slat,
          lng: slng,
          maps_url: mapsUrl(slat, slng),
          kind: chosen.kind,
          name: chosen.name,
          distance_from_stored_m: Math.round(chosen.distance),
          confidence: chosen.confidence,
        };
      }
    }

    stepReports.push({
      label,
      title: step.title,
      query,
      stored: { lat, lng, maps_url: mapsUrl(lat, lng) },
      here: here && !here.error
        ? { kind: kindOf(here), name: here.display_name, infra: hereInfra }
        : { error: (here && (here.error || here.searchError)) || 'reverse failed' },
      address: address
        ? {
            stated: address.stated,
            expected_distance_m: addrExpected ? Math.round(addrExpected.distance) : null,
            expected_name: addrExpected ? addrExpected.name : null,
            here_road: address.here_road,
            here_house: address.here_house,
            street_match: address.street_match,
          }
        : null,
      candidates: byDistance.slice(0, options.limit).map((c) => ({
        distance_m: Math.round(c.distance),
        kind: c.kind,
        name: c.name,
        infra: c.infra,
      })),
      verdict,
      reason,
      suggestion,
    });
  }

  const route = analyzeRouteOrder(steps, options.backtrackMeters, {
    maxRouteMeters: options.maxRouteMeters,
    maxLegMeters: options.maxLegMeters,
  });

  return {
    quest_id: bundle.quest_id || bundle.title,
    city: cityName,
    step_count: steps.length,
    steps: stepReports,
    route,
  };
}

function printRouteLength(route) {
  const len = route && route.length;
  if (!len || !len.total_m) return;
  const routeMark = len.over_route ? ` ⚠ БОЛЬШЕ лимита ${len.max_route_m}м — маршрут разбросан, ужимай зону` : '';
  const legMark = len.over_leg ? ` ⚠ перегон больше ${len.max_leg_m}м` : '';
  console.log(`        route length: ${len.total_m}м по прямым${routeMark}`);
  if (len.max_leg) {
    console.log(`        max leg: ${len.max_leg.m}м [${len.max_leg.from} → ${len.max_leg.to}]${legMark}`);
  }
}

function printRouteOrder(route) {
  printRouteLength(route);
  if (!route || !route.analyzed) return;
  if (route.backtracks.length === 0) {
    console.log(`        route order: OK — последователен (ось ${route.axis_dir}), возвратов нет`);
    return;
  }
  console.log(`        route order: ⚠ ${route.backtracks.length} возврат(а) назад по маршруту (ось ${route.axis_dir}):`);
  for (const b of route.backtracks) {
    console.log(
      `          ⤺ [${b.from}] → [${b.to}] ${b.to_title}: уводит ~${b.back_m}м назад в пройденную зону (переход ${b.hop_m}м). Переставь order (nearest-neighbor).`,
    );
  }
}

function printHuman(report) {
  const issues = report.steps.filter((s) => s.verdict === 'FAIL' || s.verdict === 'WARN');
  const backtracks = report.route && report.route.analyzed ? report.route.backtracks.length : 0;
  console.log(
    `\n${report.quest_id} (${report.city}): ${report.step_count ?? report.steps.length} steps, ${issues.length} to review${backtracks ? `, ${backtracks} backtrack(s)` : ''}`,
  );
  for (const s of report.steps) {
    if (s.stored == null) {
      console.log(`  ${s.verdict} [${s.label}] ${s.title}: ${s.reason}`);
      continue;
    }
    console.log(`  ${s.verdict} [${s.label}] ${s.title}`);
    console.log(`        stored:  ${s.stored.lat.toFixed(6)}, ${s.stored.lng.toFixed(6)}  ${s.stored.maps_url}`);
    if (s.here.error) {
      console.log(`        here:    (reverse geocode failed: ${s.here.error})`);
    } else {
      console.log(`        here:    ${s.here.kind}${s.here.infra ? ' ⚠ infra' : ''} — ${s.here.name}`);
    }
    if (s.address) {
      const a = s.address;
      const mismatch = a.street_match === false ? ' ⚠ street mismatch' : '';
      console.log(
        `        address: "${a.stated}" -> geocodes ${a.expected_distance_m != null ? a.expected_distance_m + 'm away' : '(not found)'}; point on ${a.here_road || '?'}${a.here_house ? ' ' + a.here_house : ''}${mismatch}`,
      );
    }
    if (s.query) console.log(`        search:  "${s.query}"`);
    s.candidates.forEach((c, i) => {
      console.log(`          ${i + 1}) ${c.distance_m}m  ${c.kind}${c.infra ? ' (infra)' : ''}  ${c.name}`);
    });
    if (s.verdict !== 'OK') console.log(`        reason:  ${s.reason}`);
    if (s.suggestion) {
      console.log(
        `        suggest: ${s.suggestion.lat}, ${s.suggestion.lng}  ${s.suggestion.maps_url}  (${s.suggestion.kind}, ${s.suggestion.confidence} confidence, ${s.suggestion.distance_from_stored_m}m from stored)`,
      );
    }
  }
  printRouteOrder(report.route);
}

async function main() {
  if (hasArg('help')) {
    console.log(
      [
        'Usage: node scripts/quest-geocheck.js [options]',
        '  --quest-id=<id>        check one quest (by string quest_id)',
        '  --source-file=<path>   read steps from a local quest-data.js (authoring mode)',
        '  --api-url=<url>         API base (default https://metravel.by); ignored with --source-file',
        '  --threshold=<m>        FAIL distance in meters (default 60)',
        '  --backtrack-m=<m>      route backtrack distance to flag (default 150; 0 disables)',
        '  --max-route-m=<m>      warn when straight-line route total exceeds this (default 4000; 0 disables)',
        '  --max-leg-m=<m>        warn when a single leg exceeds this (default 1200; 0 disables)',
        '  --limit=<n>            Nominatim candidates per step (default 3)',
        '  --delay-ms=<ms>        pause between Nominatim calls (default 1100, keep >=1100)',
        '  --route-only           pure geometry (length + order), no Nominatim — fast, safe for all quests',
        '  --json                 emit machine-readable JSON instead of the human report',
      ].join('\n'),
    );
    return;
  }

  const apiUrl = getArg('api-url', DEFAULT_API_URL);
  const questId = getArg('quest-id', '');
  const sourceFile = getArg('source-file', '');
  const thresholdMeters = Number(getArg('threshold', DEFAULT_THRESHOLD_METERS));
  const backtrackMeters = Math.max(0, Number(getArg('backtrack-m', DEFAULT_BACKTRACK_METERS)));
  const maxRouteMeters = Math.max(0, Number(getArg('max-route-m', DEFAULT_MAX_ROUTE_METERS)));
  const maxLegMeters = Math.max(0, Number(getArg('max-leg-m', DEFAULT_MAX_LEG_METERS)));
  const limit = Number(getArg('limit', 3));
  const delayMs = Math.max(1100, Number(getArg('delay-ms', 1100)));
  const routeOnly = hasArg('route-only');
  const asJson = hasArg('json');

  const bundles = sourceFile
    ? loadLocalBundles(sourceFile, questId)
    : await fetchQuestBundles(apiUrl, questId);

  const reports = [];
  for (const bundle of bundles) {
    const report = await geocheckQuest(bundle, {
      thresholdMeters,
      backtrackMeters,
      maxRouteMeters,
      maxLegMeters,
      limit,
      delayMs,
      routeOnly,
    });
    reports.push(report);
    if (!asJson) printHuman(report);
  }

  const totalIssues = reports.reduce(
    (sum, r) => sum + r.steps.filter((s) => s.verdict === 'FAIL').length,
    0,
  );
  const totalBacktracks = reports.reduce(
    (sum, r) => sum + (r.route && r.route.analyzed ? r.route.backtracks.length : 0),
    0,
  );
  const totalOverBudget = reports.reduce(
    (sum, r) => sum + (r.route && r.route.length && (r.route.length.over_route || r.route.length.over_leg) ? 1 : 0),
    0,
  );

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          threshold_m: thresholdMeters,
          backtrack_m: backtrackMeters,
          max_route_m: maxRouteMeters,
          max_leg_m: maxLegMeters,
          reports,
          fail_count: totalIssues,
          backtrack_count: totalBacktracks,
          over_budget_count: totalOverBudget,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `\nGeo-check FAIL points: ${totalIssues} · route backtracks: ${totalBacktracks} · over length budget: ${totalOverBudget}`,
    );
  }
  if (totalIssues > 0 || totalBacktracks > 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { analyzeRouteOrder, haversineMeters };
