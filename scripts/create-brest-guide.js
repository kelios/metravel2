#!/usr/bin/env node
/**
 * Статья-путеводитель по Бресту через PUT /travels/upsert/.
 * Текст — scripts/brest-guide-content.html. Точки — ниже (сохраняются в
 * scripts/brest-guide-points.json для Мастера; в payload пускаются только если
 * --with-points, т.к. точки требуют непустой image).
 *
 * node scripts/create-brest-guide.js [--publish] [--with-points] [--id=N] [--dry-run]
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const doPublish = args.includes('--publish');
const withPoints = args.includes('--with-points');
const idArg = args.find(a => a.startsWith('--id='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = 'https://metravel.by/api';

function resolveToken() {
    if (tokenArg) return tokenArg.split('=').slice(1).join('=');
    if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN;
    try { const p = path.join(os.homedir(), '.metravel_token'); if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim(); } catch { return null; }
    return null;
}
const TOKEN = resolveToken();
if (!TOKEN && !isDryRun) { console.error('❌ Нужен токен'); process.exit(1); }

const description = fs.readFileSync(path.join(__dirname, 'brest-guide-content.html'), 'utf8').trim();

// Точки путеводителя (country=3 Беларусь). categories — categoryTravelAddress id.
// 76=Музей, 85=Театр, 39=Достопримечательность, 90=Парк.
const points = [
    { lat: 52.0871481, lng: 23.6547217, country: 3, address: 'Брестская крепость (Цитадель)', categories: [39] },
    { lat: 52.0799979, lng: 23.6546238, country: 3, address: 'Археологический музей «Берестье»', categories: [76] },
    { lat: 52.0856602, lng: 23.6721882, country: 3, address: 'Брестский музей железнодорожной техники (музей паровозов)', categories: [76] },
    { lat: 52.0895284, lng: 23.6946244, country: 3, address: 'Улица Советская — пешеходная, фонарщик и памятник Тысячелетия', categories: [39] },
    { lat: 52.0854829, lng: 23.6901394, country: 3, address: 'Свято-Симеоновский кафедральный собор', categories: [39] },
    { lat: 52.091635, lng: 23.686436, country: 3, address: 'Аллея кованых фонарей на улице Гоголя', categories: [39] },
    { lat: 52.0961, lng: 23.6797, country: 3, address: 'Парк культуры и отдыха (набережная Мухавца)', categories: [90] },
    { lat: 52.0906431, lng: 23.6860781, country: 3, address: 'Брестский академический театр драмы', categories: [85] },
    { lat: 52.100010, lng: 23.681038, country: 3, address: 'Железнодорожный вокзал Брест-Центральный', categories: [39] },
];

fs.writeFileSync(path.join(__dirname, 'brest-guide-points.json'), JSON.stringify(points, null, 2));

const coordsMeTravel = withPoints
    ? points.map(p => ({ id: null, lat: p.lat, lng: p.lng, address: p.address, country: p.country, categories: p.categories, image: '' }))
    : [];

const payload = {
    id: idArg ? Number(idArg.split('=')[1]) : null,
    name: 'Брест: путеводитель по крепости, фонарщику и старому городу',
    slug: 'brest-putevoditel-po-kreposti-fonarshchiku-i-staromu-gorodu',
    description,
    coordsMeTravel,
    countries: [3],
    categories: [20],
    transports: [],
    month: [],
    complexity: [],
    companions: [],
    over_nights_stay: [],
    plus: 'Мемориал мирового уровня, уникальный живой фонарщик каждый вечер, компактный пешеходный центр, сильный музей паровозов, доступные цены.',
    minus: 'Многие музеи закрыты по понедельникам; время зажигания фонарей меняется каждый день по календарю заката.',
    recommendation: 'Заложите минимум полный день на крепость и центр, а лучше — выходные с выездом в Каменец, Коссово или Ружаны. Вечером обязательно к фонарщику на Советскую.',
    youtube_link: 'https://metravel.by',
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    visa: false,
    publish: doPublish,
    moderation: doPublish,
    year: 2024,
    userIds: '1', // автор — Юля (ignatieva_julia@tut.by), user id 1; статьи ведутся от её имени
    user: 1,
};

async function main() {
    console.log(`🚀 Брест-путеводитель → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'}, ${doPublish ? 'PUBLISH' : 'DRAFT'}, points=${coordsMeTravel.length})`);
    if (isDryRun) { console.log('DRY RUN — ничего не отправлено.'); return; }
    const res = await fetch(`${API_BASE}/travels/upsert/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${TOKEN}` },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) { console.error(`❌ HTTP ${res.status}: ${text.slice(0, 800)}`); process.exit(1); }
    let data; try { data = JSON.parse(text); } catch { data = {}; }
    console.log(`✅ HTTP ${res.status} | id=${data.id} | slug=${data.slug} | points=${(data.travelAddress||data.coordsMeTravel||[]).length}`);
    console.log(`   URL: https://metravel.by/travels/${data.slug || data.id}`);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
