#!/usr/bin/env node
/**
 * Pillar-хаб «Где купаться под Краком» через PUT /travels/upsert/ (тикет #760).
 * Компилятивный хаб из точек существующих статей автора (Закшувек 384, Грудек 442,
 * Пляжи 465, Попроцаны 554, Чёрный Став/Бобровая 404). Текст —
 * scripts/krakow-swim-hub-content.html, фото — только metravel.by из своих статей.
 *
 * node scripts/create-krakow-swim-hub.js [--publish] [--with-points] [--id=N] [--dry-run]
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token. Автор — Юля (id 1).
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

const description = fs.readFileSync(path.join(__dirname, 'krakow-swim-hub-content.html'), 'utf8').trim();

// Точки хаба (country=160 Польша). categories — categoryTravelAddress id:
// 101=Пляж, 84=Озеро, 163=Карьер, 21=Водохранилище, 90=Парк.
// Координаты взяты из точек статей-источников (384/465/404/554/442).
const points = [
    { lat: 50.0364047, lng: 19.9097898, country: 160, address: 'Kąpielisko Zakrzówek, Wyłom, Краков, Малопольское воеводство, Польша', categories: [163, 101] },
    { lat: 50.0479959, lng: 19.7875786, country: 160, address: 'Zalew na Piaskach (Kryspinów), Budzyń, gmina Liszki, Польша', categories: [101, 21] },
    { lat: 50.0529093, lng: 20.3297024, country: 160, address: 'Bobrowe Rozlewisko, Zabierzów Bocheński, gmina Niepołomice, Польша', categories: [21, 101] },
    { lat: 50.0868556, lng: 18.9917139, country: 160, address: 'Plaża Paprocany, Promenada, Тыхы, Силезское воеводство, Польша', categories: [84, 101] },
    { lat: 49.8469826, lng: 20.7085075, country: 160, address: 'Kąpielisko Chorwacja, Jurków, gmina Czchów, Малопольское воеводство, Польша', categories: [101] },
    { lat: 50.2254785, lng: 19.3168745, country: 160, address: 'Park Gródek, Pieczyska, Явожно, Силезское воеводство, Польша', categories: [163, 90] },
];

fs.writeFileSync(path.join(__dirname, 'krakow-swim-hub-points.json'), JSON.stringify(points, null, 2));

const coordsMeTravel = withPoints
    ? points.map(p => ({ id: null, lat: p.lat, lng: p.lng, address: p.address, country: p.country, categories: p.categories, image: '' }))
    : [];

const payload = {
    id: idArg ? Number(idArg.split('=')[1]) : null,
    name: 'Где купаться под Краковом: 6 проверенных мест у воды с ценами 2026',
    slug: 'gde-kupatsia-pod-krakovom-6-proverennykh-mest-u-vody',
    description,
    coordsMeTravel,
    countries: [160],
    categories: [19, 20],
    transports: [1],
    month: [6, 7, 8],
    complexity: [1],
    companions: [],
    over_nights_stay: [],
    plus: 'Бесплатный Закшувек с плавучими бассейнами прямо в черте Кракова; песчаный Криспинув в 20 минутах; тихая семейная Бобровая Заводь; до Закшувека и Попроцан легко добраться без машины.',
    minus: 'В самом Кракове, кроме Закшувека, купаться негде; в жаркие выходные на Закшувке очередь на понтоны; на Бобровую Заводь и Хорватский бассейн без машины неудобно; в Грудеке купание запрещено.',
    recommendation: 'На один жаркий день выбирайте Закшувек или Криспинув, с детьми — Бобровую Заводь, на целый день с прогулкой — Попроцаны. Грудек оставьте на несезон: красивее всего он без толпы.',
    youtube_link: '__draft_placeholder__',
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    visa: false,
    publish: doPublish,
    moderation: doPublish,
    year: 2026,
    userIds: '1', // автор — Юля (ignatieva_julia@tut.by), user id 1
    user: 1,
};

async function main() {
    console.log(`🚀 Хаб «Где купаться под Краковом» → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'}, ${doPublish ? 'PUBLISH' : 'DRAFT'}, points=${coordsMeTravel.length}, id=${payload.id})`);
    if (isDryRun) { console.log('DRY RUN — ничего не отправлено.'); return; }
    const res = await fetch(`${API_BASE}/travels/upsert/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${TOKEN}` },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) { console.error(`❌ HTTP ${res.status}: ${text.slice(0, 800)}`); process.exit(1); }
    let data; try { data = JSON.parse(text); } catch { data = {}; }
    console.log(`✅ HTTP ${res.status} | id=${data.id} | slug=${data.slug} | points=${(data.travelAddress || data.coordsMeTravel || []).length}`);
    console.log(`   URL: https://metravel.by/travels/${data.slug || data.id}`);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
