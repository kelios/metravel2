// One-off: fix miscategorized point #343 «Thai Hoa Temple» (travel #129 «Наш Вьетнам»)
// АЭРОПОРТ (cat 8) -> Храм (cat 141). Board task #803 (F-3).
// Reuses seo-edit's safe upsert builder; backs up before write and verifies after.
const path = require('path');
const { buildUpsertPayload } = require('./seo-edit.js');

const API_BASE = 'https://metravel.by/api';
const TRAVEL_ID = 129;
const POINT_ID = 343;
const WRONG_CAT = 8;   // Аэропорт
const RIGHT_CAT = 141; // Храм
const https = require('https');
const fs = require('fs');

function req(method, urlPath, data) {
  return new Promise((resolve, reject) => {
    const body = data != null ? Buffer.from(JSON.stringify(data)) : null;
    const opts = {
      method, timeout: 60000, rejectUnauthorized: false,
      headers: { Authorization: `Token ${process.env.METRAVEL_TOKEN}` },
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = body.length;
    }
    const r = https.request(`${API_BASE}${urlPath}`, opts, (res) => {
      let buf = ''; res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, text: buf }));
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const before = await req('GET', `/travels/${TRAVEL_ID}/`);
  if (before.status !== 200) throw new Error(`GET before HTTP ${before.status}`);
  const detail = JSON.parse(before.text);
  const pts = detail.coordsMeTravel || [];
  const p = pts.find((x) => x.id === POINT_ID);
  if (!p) throw new Error(`point ${POINT_ID} not found`);
  console.log(`before: point ${POINT_ID} categories = ${JSON.stringify(p.categories)}`);
  console.log(`before: points=${pts.length} gallery=${(detail.gallery||[]).length} moderation=${detail.moderation} publish=${detail.publish}`);

  const dir = process.env.BACKUP_DIR || '/private/tmp';
  const bfile = path.join(dir, `t${TRAVEL_ID}-backup.json`);
  fs.writeFileSync(bfile, JSON.stringify(detail, null, 2));
  console.log(`backup -> ${bfile}`);

  if (!Array.isArray(p.categories) || !p.categories.includes(WRONG_CAT)) {
    console.log('point does not have wrong category — nothing to do'); return;
  }
  // Replace airport with храм, preserve any other legit categories.
  p.categories = p.categories.map((c) => (c === WRONG_CAT ? RIGHT_CAT : c));
  console.log(`sending: point ${POINT_ID} categories = ${JSON.stringify(p.categories)}`);

  const payload = buildUpsertPayload(detail, {}); // keeps existing description/meta
  const put = await req('PUT', '/travels/upsert/', payload);
  console.log(`PUT /travels/upsert/ -> HTTP ${put.status}`);
  if (put.status !== 200 && put.status !== 201) { console.error(put.text.slice(0, 600)); process.exit(1); }

  const after = await req('GET', `/travels/${TRAVEL_ID}/`);
  const ad = JSON.parse(after.text);
  const ap = (ad.coordsMeTravel || []).find((x) => x.id === POINT_ID);
  console.log('--- VERIFY ---');
  console.log(`point ${POINT_ID} categories = ${JSON.stringify(ap && ap.categories)}`);
  console.log(`points=${(ad.coordsMeTravel||[]).length} gallery=${(ad.gallery||[]).length} moderation=${ad.moderation} publish=${ad.publish} slug=${ad.slug}`);
  const ok = ap && Array.isArray(ap.categories) && ap.categories.includes(RIGHT_CAT) && !ap.categories.includes(WRONG_CAT)
    && (ad.coordsMeTravel||[]).length === pts.length
    && (ad.gallery||[]).length >= (detail.gallery||[]).length
    && ad.moderation === detail.moderation && ad.publish === detail.publish;
  console.log(ok ? '✅ FIX VERIFIED' : '❌ VERIFY FAILED');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
