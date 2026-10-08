#!/usr/bin/env node
/**
 * Создание pillar-хаба «Маршруты выходного дня из Минска» через PUT /travels/upsert/.
 * Текст — scripts/weekend-minsk-hub-content.html (13 маршрутов + 2 смежных хаба).
 * Точек нет (как у путеводителя по Минску, id 646) — хаб-навигатор по ссылкам.
 *
 * node scripts/create-weekend-minsk-hub.js [--publish] [--id=N] [--dry-run]
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token. Создавать ТОЛЬКО токеном Юли (id 1).
 */
const fs = require('fs');
const path = require('path');

const { createToolSession, TokenError, formatTokenError, parseResponseJson } = require('./lib/metravel-tool-session');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const doPublish = args.includes('--publish');
const idArg = args.find(a => a.startsWith('--id='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = 'https://metravel.by/api';

function createSession() { return createToolSession({ origin: API_BASE, profile: 'owner', expectedUserId: 1, explicit: tokenArg ? tokenArg.split('=').slice(1).join('=') : undefined }); }
const SESSION = createSession();


const description = fs.readFileSync(path.join(__dirname, 'weekend-minsk-hub-content.html'), 'utf8').trim();

const payload = {
    id: idArg ? Number(idArg.split('=')[1]) : null,
    name: 'Маршруты выходного дня из Минска: 13 проверенных поездок на один день',
    slug: 'marshruty-vykhodnogo-dnia-iz-minska-13-proverennykh-poezdok-na-odin-den',
    description,
    coordsMeTravel: [],
    countries: [3],
    categories: [19, 20],
    transports: [],
    month: [],
    complexity: [],
    companions: [],
    over_nights_stay: [],
    plus: 'Все 13 маршрутов проверены лично: природа, усадьбы, история и озёра — на любой вкус и радиус, большинство мест бесплатные.',
    minus: 'До родников, лесных озёр и дальних усадеб без машины не добраться; к озеру Глубокому — лесные дороги.',
    recommendation: 'Выбирайте раздел под настроение и сезон: весной — родники, летом — Ислочь и озёра, осенью — усадебные парки, зимой — Линия Сталина.',
    youtube_link: 'https://metravel.by',
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    visa: false,
    publish: doPublish,
    moderation: doPublish,
    year: 2026,
};

async function main() {
    console.log(`🚀 Хаб «Маршруты выходного дня из Минска» → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'}, ${doPublish ? 'PUBLISH' : 'DRAFT'}, id=${payload.id})`);
    console.log(`   desc=${description.length} chars`);
    if (isDryRun) { console.log('DRY RUN — ничего не отправлено.'); return; }
    const res = await SESSION.request(`${API_BASE}/travels/upsert/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) { console.error(formatTokenError(new TokenError('response', { status: res.status }))); process.exit(1); }
    let data; try { data = parseResponseJson(text); } catch { data = {}; }
    console.log(`✅ HTTP ${res.status} | id=${data.id} | slug=${data.slug} | publish=${data.publish}`);
    console.log(`   URL: https://metravel.by/travels/${data.slug || data.id}`);
}
main().catch(e => { console.error('Fatal:', formatTokenError(e)); process.exit(1); });
