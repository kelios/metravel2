import { chromium } from '@playwright/test';

const SCEN = {
  krakow: { latitude: 50.0614, longitude: 19.9366 },
  minsk: { latitude: 53.9006, longitude: 27.559 },
  minskOffset: { latitude: 53.95, longitude: 27.70 },
};
const which = process.argv[2] || 'krakow';
const coords = SCEN[which];
const tag = process.argv[3] || which;
const URL = 'http://127.0.0.1:8081/map';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  geolocation: coords, permissions: ['geolocation'], locale: 'ru-RU',
});
const page = await context.newPage();
await page.addInitScript((c) => {
  try { window.localStorage.removeItem('metravel:lastKnownCoords'); } catch (e) {}
  const make = () => ({ coords: { ...c, accuracy: 40, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
  navigator.geolocation.getCurrentPosition = (s) => { try { s(make()); } catch(e){} };
  navigator.geolocation.watchPosition = (s) => { try { s(make()); } catch(e){} return 1; };
}, coords);

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.leaflet-container', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(9000);

const out = await page.evaluate(() => {
  // Find a leaflet layer (path/marker) that holds ._map, then read center/zoom.
  function findMap() {
    const els = document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-marker-icon, .leaflet-tile');
    for (const el of els) {
      for (const k in el) {
        const v = el[k];
        if (v && v._map && typeof v._map.getZoom === 'function') return v._map;
      }
    }
    // fallback: container keys
    const lc = document.querySelector('.leaflet-container');
    if (lc && lc._leaflet_id != null && window.L && window.L.Map) {}
    return null;
  }
  const map = findMap();
  let res = { mapCenter: null, mapZoom: null };
  if (map) {
    try { const c = map.getCenter(); res.mapCenter = { lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4) }; res.mapZoom = map.getZoom(); } catch(e){ res.err = String(e); }
  }
  // circle bbox in px
  const paths = Array.from(document.querySelectorAll('svg path'));
  const circle = paths.find(p => (p.getAttribute('stroke-dasharray')||'').includes('6'));
  if (circle) { try { const b = circle.getBBox(); res.circlePx = Math.round(Math.max(b.width,b.height)); } catch(e){} }
  res.markers = document.querySelectorAll('.leaflet-marker-icon').length;
  return res;
});
console.log(`SCENARIO=${tag} expected=${JSON.stringify(coords)}`);
console.log('OUT', JSON.stringify(out, null, 2));
await page.screenshot({ path: `/private/tmp/claude-501/-Users-juliasavran-Sites-metravel2-metravel2/85340bda-e87e-45b5-8eeb-c09cf830a138/scratchpad/map-${tag}.png` });
await browser.close();
