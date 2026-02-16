#!/usr/bin/env node
/**
 * Fetch the full "Zanocuj w lesie" WFS dataset from the Polish Lasy server
 * and save it as a static GeoJSON file.
 *
 * The Polish WFS server (mapserver.bdl.lasy.gov.pl) geo-blocks requests from
 * certain countries (e.g. Belarus where metravel.by is hosted). This script
 * should be run from a non-blocked location (developer machine, CI in EU, etc.)
 * and the resulting file committed to the repo or deployed alongside the build.
 *
 * Usage:
 *   node scripts/fetch-lasy-wfs-data.js
 *   node scripts/fetch-lasy-wfs-data.js --output public/assets/data/lasy-zanocuj.json
 *
 * The output file is loaded by the map overlay at runtime instead of making
 * live WFS requests from the production server.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_OUTPUT = path.resolve(__dirname, '..', 'public', 'assets', 'data', 'lasy-zanocuj.json');

// Poland bounding box (generous)
const POLAND_BBOX = { south: 49.0, west: 14.0, north: 55.0, east: 24.2 };

const WFS_BASE = 'https://mapserver.bdl.lasy.gov.pl/arcgis/services/WFS_BDL_mapa_turystyczna/MapServer/WFSServer';
const TYPE_NAME = 'WFS_BDL_mapa_turystyczna:Program_Zanocuj_w_lesie';

// Split Poland into grid cells to avoid server limits on large bbox queries
const GRID_COLS = 3;
const GRID_ROWS = 2;

function buildUrl(bbox, attempt) {
  const params = new URLSearchParams();
  params.set('service', 'WFS');
  params.set('request', 'GetFeature');
  params.set('version', attempt.version);
  params.set(attempt.typeParam, TYPE_NAME);
  params.set('outputFormat', attempt.outputFormat);
  params.set('srsName', attempt.srsName);

  const bboxValue =
    attempt.bboxOrder === 'latlon'
      ? `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
      : `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  params.set('bbox', bboxValue);

  return `${WFS_BASE}?${params.toString()}`;
}

function httpsGet(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
  });
}

function splitBBox(bbox, cols, rows) {
  const cells = [];
  const dLat = (bbox.north - bbox.south) / rows;
  const dLng = (bbox.east - bbox.west) / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        south: bbox.south + r * dLat,
        west: bbox.west + c * dLng,
        north: bbox.south + (r + 1) * dLat,
        east: bbox.west + (c + 1) * dLng,
      });
    }
  }
  return cells;
}

function tryParseGeoJson(body) {
  // Check for XML error
  const trimmed = (body || '').trim();
  if (trimmed.startsWith('<') && trimmed.toLowerCase().includes('exceptionreport')) {
    return null;
  }

  // Try JSON first
  if (!trimmed.startsWith('<')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  // GML/XML — not handled in this script (we request GEOJSON format)
  return null;
}

function deduplicateFeatures(features) {
  const seen = new Set();
  return features.filter((f) => {
    // Use geometry coordinates as dedup key
    const key = JSON.stringify(f.geometry?.coordinates);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- Geometry simplification ---

function sqDistToSegment(p, a, b) {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    if (t > 1) { dx = p[0] - b[0]; dy = p[1] - b[1]; }
    else if (t > 0) { dx = p[0] - (a[0] + dx * t); dy = p[1] - (a[1] + dy * t); }
    else { dx = p[0] - a[0]; dy = p[1] - a[1]; }
  } else { dx = p[0] - a[0]; dy = p[1] - a[1]; }
  return dx * dx + dy * dy;
}

function simplifyDP(pts, sqTol) {
  if (pts.length <= 2) return pts;
  let maxSqDist = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = sqDistToSegment(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxSqDist) { maxSqDist = d; idx = i; }
  }
  if (maxSqDist > sqTol) {
    const left = simplifyDP(pts.slice(0, idx + 1), sqTol);
    const right = simplifyDP(pts.slice(idx), sqTol);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}

// ~0.0003 degrees tolerance ≈ ~30m at Poland latitudes — good enough for forest areas
const SIMPLIFY_SQ_TOL = 0.0003 * 0.0003;
const COORD_PRECISION = 5; // ~1m accuracy

function roundCoord(n) {
  const factor = Math.pow(10, COORD_PRECISION);
  return Math.round(n * factor) / factor;
}

function simplifyGeometry(geometry) {
  const { type, coordinates } = geometry;

  const roundPair = (pair) => [roundCoord(pair[0]), roundCoord(pair[1])];

  const simplifyRing = (ring) => {
    const simplified = simplifyDP(ring, SIMPLIFY_SQ_TOL);
    return simplified.map(roundPair);
  };

  let newCoords;
  if (type === 'Polygon') {
    newCoords = coordinates.map(simplifyRing);
  } else if (type === 'MultiPolygon') {
    newCoords = coordinates.map((poly) => poly.map(simplifyRing));
  } else if (type === 'Point') {
    newCoords = roundPair(coordinates);
  } else {
    newCoords = coordinates;
  }

  return { type, coordinates: newCoords };
}

function isValidPolygon(geometry) {
  const { type, coordinates } = geometry;
  if (type === 'Polygon') return coordinates.every((r) => r.length >= 3);
  if (type === 'MultiPolygon') return coordinates.every((p) => p.every((r) => r.length >= 3));
  return true;
}

function optimizeFeatures(features) {
  return features
    .map((f) => ({
      type: 'Feature',
      geometry: simplifyGeometry(f.geometry),
      properties: {
        name: f.properties.nazwa || f.properties.Nazwa || f.properties.NAZWA ||
              f.properties.name || f.properties.Name || f.properties.nadl || '',
      },
    }))
    .filter((f) => isValidPolygon(f.geometry));
}

async function fetchCell(bbox, cellIndex, totalCells) {
  const attempts = [
    { version: '2.0.0', typeParam: 'typeNames', outputFormat: 'GEOJSON', srsName: 'EPSG:4326', bboxOrder: 'latlon' },
    { version: '2.0.0', typeParam: 'typeNames', outputFormat: 'GEOJSON', srsName: 'EPSG:4326', bboxOrder: 'lonlat' },
    { version: '1.1.0', typeParam: 'typeName', outputFormat: 'GEOJSON', srsName: 'EPSG:4326', bboxOrder: 'latlon' },
  ];

  for (const attempt of attempts) {
    const url = buildUrl(bbox, attempt);
    console.log(`  [${cellIndex + 1}/${totalCells}] Fetching (${attempt.version}, ${attempt.bboxOrder})...`);

    try {
      const res = await httpsGet(url, 120000);

      if (res.status !== 200) {
        console.log(`    HTTP ${res.status}, trying next attempt...`);
        continue;
      }

      const geojson = tryParseGeoJson(res.body);
      if (!geojson) {
        console.log(`    Could not parse response as GeoJSON, trying next attempt...`);
        continue;
      }

      console.log(`    Got ${geojson.features.length} features`);
      return geojson.features;
    } catch (err) {
      console.log(`    Error: ${err.message}, trying next attempt...`);
      continue;
    }
  }

  console.warn(`  [${cellIndex + 1}/${totalCells}] All attempts failed for cell bbox: ${JSON.stringify(bbox)}`);
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath = DEFAULT_OUTPUT;

  const outputIdx = args.indexOf('--output');
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    outputPath = path.resolve(args[outputIdx + 1]);
  }

  console.log('Fetching "Zanocuj w lesie" WFS data from Polish Lasy server...');
  console.log(`Output: ${outputPath}`);
  console.log(`Grid: ${GRID_COLS}x${GRID_ROWS} cells covering Poland`);
  console.log('');

  const cells = splitBBox(POLAND_BBOX, GRID_COLS, GRID_ROWS);
  let allFeatures = [];

  for (let i = 0; i < cells.length; i++) {
    const features = await fetchCell(cells[i], i, cells.length);
    allFeatures = allFeatures.concat(features);

    // Rate-limit: wait 2s between cells
    if (i < cells.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Deduplicate (overlapping bbox edges may return same features)
  const unique = deduplicateFeatures(allFeatures);

  console.log('');
  console.log(`Total features fetched: ${allFeatures.length}`);
  console.log(`After deduplication: ${unique.length}`);

  // Optimize: simplify geometry + reduce precision + strip properties
  const optimized = optimizeFeatures(unique);
  console.log(`After optimization: ${optimized.length} features`);

  if (optimized.length === 0) {
    console.error('ERROR: No features fetched. The server may be blocking your IP.');
    console.error('Try running from a different network (EU VPN, CI runner, etc.).');
    process.exit(1);
  }

  const result = {
    type: 'FeatureCollection',
    _meta: {
      source: 'Bank Danych o Lasach (BDL) – Program "Zanocuj w lesie"',
      fetchedAt: new Date().toISOString(),
      featureCount: optimized.length,
      simplificationTolerance: '~30m (Douglas-Peucker)',
      coordPrecision: COORD_PRECISION,
    },
    features: optimized,
  };

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(result), 'utf-8');

  const sizeKb = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`Written ${sizeKb} KB to ${outputPath}`);
  console.log('Done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
