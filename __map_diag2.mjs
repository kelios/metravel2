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
  geolocation: coords,
  permissions: ['geolocation'],
  locale: 'ru-RU',
});
const page = await context.newPage();

await page.addInitScript((c) => {
  try { window.localStorage.removeItem('metravel:lastKnownCoords'); } catch (e) {}
  const make = () => ({ coords: { ...c, accuracy: 40, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
  navigator.geolocation.getCurrentPosition = (s) => { try { s(make()); } catch(e){} };
  navigator.geolocation.watchPosition = (s) => { try { s(make()); } catch(e){} return 1; };
  window.__geoProbe = () => new Promise((res) => navigator.geolocation.getCurrentPosition((p)=>res({lat:p.coords.latitude,lng:p.coords.longitude})));
}, coords);

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.leaflet-container', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(9000);

const probe = await page.evaluate(async () => {
  const g = await window.__geoProbe();
  // find leaflet map instance by scanning container props
  let center = null, zoom = null;
  const lc = document.querySelector('.leaflet-container');
  if (lc) {
    for (const k in lc) {
      const v = lc[k];
      if (v && typeof v.getCenter === 'function' && typeof v.getZoom === 'function') {
        try { const c = v.getCenter(); center = { lat: c.lat, lng: c.lng }; zoom = v.getZoom(); } catch(e){}
        break;
      }
    }
  }
  return { geo: g, mapCenter: center, mapZoom: zoom };
});

console.log(`SCENARIO=${tag}`);
console.log('PROBE', JSON.stringify(probe, null, 2));
await page.screenshot({ path: `/private/tmp/claude-501/-Users-juliasavran-Sites-metravel2-metravel2/85340bda-e87e-45b5-8eeb-c09cf830a138/scratchpad/map-${tag}.png` });
await browser.close();
