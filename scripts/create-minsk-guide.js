#!/usr/bin/env node
/**
 * Создание статьи-путеводителя по Минску (черновик) через PUT /travels/upsert/.
 * Текст — scripts/minsk-guide-content.html, точки — ниже. Обложку/галерею
 * автор добавляет потом в Мастере и публикует.
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/create-minsk-guide.js [--publish] [--dry-run]
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const doPublish = args.includes('--publish');
const apiArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = (apiArg ? apiArg.split('=')[1] : 'https://metravel.by/api').replace(/\/+$/, '');

function resolveToken() {
    if (tokenArg) return tokenArg.split('=').slice(1).join('=');
    if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN;
    try { const p = path.join(os.homedir(), '.metravel_token'); if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
    return null;
}
const TOKEN = resolveToken();
if (!TOKEN && !isDryRun) { console.error('❌ Нужен токен'); process.exit(1); }

const description = fs.readFileSync(path.join(__dirname, 'minsk-guide-content.html'), 'utf8').trim();

// Точки маршрута (country=3 Беларусь). categories — categoryTravelAddress id.
const points = [
    { lat: 53.9047, lng: 27.5567, country: 3, address: 'Верхний город и площадь Свободы', categories: [187] },
    { lat: 53.9079, lng: 27.5575, country: 3, address: 'Троицкое предместье', categories: [39] },
    { lat: 53.9072, lng: 27.5585, country: 3, address: 'Остров Мужества и Скорби (Остров слёз)', categories: [89] },
    { lat: 53.9104, lng: 27.5617, country: 3, address: 'Большой театр оперы и балета', categories: [85] },
    { lat: 53.9034, lng: 27.5744, country: 3, address: 'Парк Горького', categories: [90] },
    { lat: 53.8960, lng: 27.5470, country: 3, address: 'Красный костёл и площадь Независимости', categories: [150] },
    { lat: 53.8915, lng: 27.5476, country: 3, address: 'Михайловский сквер (скульптуры Жбанова)', categories: [89] },
    { lat: 53.8965, lng: 27.5590, country: 3, address: 'Улица Октябрьская (муралы, стрит-арт)', categories: [223] },
    { lat: 53.9180, lng: 27.5870, country: 3, address: 'Комаровский рынок', categories: [122] },
    { lat: 53.8509, lng: 27.5786, country: 3, address: 'Лошицкий усадебно-парковый комплекс', categories: [136] },
    { lat: 53.9165, lng: 27.6135, country: 3, address: 'Центральный ботанический сад НАН', categories: [192] },
    { lat: 53.9310, lng: 27.6512, country: 3, address: 'Национальная библиотека (смотровая площадка)', categories: [12] },
];

// Точки требуют непустой image (только после загрузки фото) — добавляются в Мастере.
// Список точек для Мастера — в scripts/minsk-guide-points.json.
const payload = {
    name: 'Минск за выходные: путеводитель по столице Беларуси',
    slug: 'minsk-za-vykhodnye-putevoditel-po-stolitse-belarusi',
    description,
    coordsMeTravel: [],
    countries: [3],
    categories: [20],
    transports: [],
    month: [],
    complexity: [],
    companions: [],
    over_nights_stay: [],
    plus: 'Компактный пешеходный центр, сильные музеи, много зелёных парков, доступные цены.',
    minus: 'Многие музеи закрыты по понедельникам и вторникам; до части парков далеко от центра.',
    recommendation: 'Лучшее время — май–сентябрь. Заложите вечер на смотровую площадку Национальной библиотеки.',
    youtube_link: 'https://metravel.by',
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    visa: false,
    publish: doPublish,
    moderation: doPublish,
    year: 2024,
};

async function main() {
    console.log(`🚀 Создание статьи «Минск» → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'}, ${doPublish ? 'PUBLISH' : 'DRAFT'})`);
    console.log(`   points=${points.length} desc=${description.length} chars`);
    if (isDryRun) { console.log('DRY RUN — ничего не отправлено.'); return; }
    const res = await fetch(`${API_BASE}/travels/upsert/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${TOKEN}` },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) { console.error(`❌ HTTP ${res.status}: ${text.slice(0, 500)}`); process.exit(1); }
    let data; try { data = JSON.parse(text); } catch { data = {}; }
    console.log(`✅ HTTP ${res.status} | id=${data.id} | slug=${data.slug}`);
    console.log(`   URL: ${API_BASE}/travels/${data.slug || data.id}`);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
