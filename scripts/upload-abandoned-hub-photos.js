#!/usr/bin/env node
/**
 * Загрузка фото точек хаба «Заброшенные дворцы и усадьбы Беларуси» (id 682).
 * Матчит точки по координатам с scripts/abandoned-hub-points.json, качает sourceImage
 * (только metravel.by, из точек статей-доноров) и POST /api/upload
 * collection=travelImageAddress id=<pointId>. Обложка: collection=travelMainImage.
 *
 * METRAVEL_TOKEN=... node scripts/upload-abandoned-hub-photos.js --travel-id=682 [--cover-only|--points-only]
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const idArg = args.find(a => a.startsWith('--travel-id='));
const TRAVEL_ID = idArg ? Number(idArg.split('=')[1]) : null;
const coverOnly = args.includes('--cover-only');
const pointsOnly = args.includes('--points-only');
const API_BASE = 'https://metravel.by/api';
const TOKEN = process.env.METRAVEL_TOKEN;
if (!TOKEN || !TRAVEL_ID) { console.error('❌ Нужны METRAVEL_TOKEN и --travel-id='); process.exit(1); }

const COVER_URL = 'https://metravel.by/address-image/15600/conversions/fe1857f8d298458096fee92a00876d2a.webp'; // Желудок

const points = JSON.parse(fs.readFileSync(path.join(__dirname, 'abandoned-hub-points.json'), 'utf8'));

const key = (lat, lng) => `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;

async function download(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`download ${url}: HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
}

async function upload(collection, id, buf, filename, mime) {
    const form = new FormData();
    form.append('file', new File([buf], filename, { type: mime }));
    form.append('collection', collection);
    form.append('id', String(id));
    const r = await fetch(`${API_BASE}/upload`, { method: 'POST', headers: { Authorization: `Token ${TOKEN}` }, body: form });
    const t = await r.text();
    if (!r.ok) throw new Error(`upload ${collection}/${id}: HTTP ${r.status} ${t.slice(0, 200)}`);
    return t.slice(0, 120);
}

// Конверсии на проде могут отдавать JPEG под именем .webp — тип определяем по magic-байтам.
function sniff(buf) {
    if (buf[0] === 0xff && buf[1] === 0xd8) return { ext: 'jpg', mime: 'image/jpeg' };
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
    if (buf[0] === 0x89 && buf.slice(1, 4).toString() === 'PNG') return { ext: 'png', mime: 'image/png' };
    return { ext: 'jpg', mime: 'image/jpeg' };
}
function nameOf(url, ext) { return url.split('/').pop().split('?')[0].replace(/\.[a-z]+$/i, '') + '.' + ext; }
const hasPhoto = (u) => !!u && !/\/address-image\/?$/.test(u);

async function main() {
    const r = await fetch(`${API_BASE}/travels/${TRAVEL_ID}/`, { headers: { Authorization: `Token ${TOKEN}` } });
    if (!r.ok) throw new Error(`GET travel: HTTP ${r.status}`);
    const travel = await r.json();
    const byCoord = new Map();
    for (const a of travel.travelAddress || []) {
        const [lat, lng] = String(a.coord || '').split(',');
        byCoord.set(key(lat, lng), a);
    }
    console.log(`travel ${TRAVEL_ID}: ${byCoord.size} точек на сервере, ${points.length} в json`);

    if (!coverOnly) {
        let ok = 0, skip = 0, fail = 0;
        for (const p of points) {
            const remote = byCoord.get(key(p.lat, p.lng));
            if (!remote) { console.error(`  ⚠ нет точки на сервере: ${p.address}`); fail++; continue; }
            if (hasPhoto(remote.travelImageThumbUrl)) { console.log(`  ⏭ уже с фото: ${p.address}`); skip++; continue; }
            try {
                const buf = await download(p.sourceImage);
                const { ext, mime } = sniff(buf);
                await upload('travelImageAddress', remote.id, buf, nameOf(p.sourceImage, ext), mime);
                console.log(`  ✅ ${p.address} → point ${remote.id} (${(buf.length / 1024).toFixed(0)} KB)`);
                ok++;
            } catch (e) { console.error(`  ❌ ${p.address}: ${e.message}`); fail++; }
        }
        console.log(`points: ok=${ok} skip=${skip} fail=${fail}`);
        if (fail > 0) process.exitCode = 1;
    }

    if (!pointsOnly) {
        const buf = await download(COVER_URL);
        const { ext, mime } = sniff(buf);
        const res = await upload('travelMainImage', TRAVEL_ID, buf, nameOf(COVER_URL, ext), mime);
        console.log(`cover: ✅ ${res}`);
    }
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
