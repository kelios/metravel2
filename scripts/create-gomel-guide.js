#!/usr/bin/env node
/**
 * Статья-путеводитель по Гомелю через PUT /travels/upsert/.
 * Текст — scripts/gomel-guide-content.html. Точки — ниже (сохраняются в
 * scripts/gomel-guide-points.json для Мастера; в payload пускаются только если
 * --with-points, т.к. точки требуют непустой image).
 *
 * node scripts/create-gomel-guide.js [--publish] [--with-points] [--id=N] [--dry-run]
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

const description = fs.readFileSync(path.join(__dirname, 'gomel-guide-content.html'), 'utf8').trim();

// Точки путеводителя (country=3 Беларусь). categories — categoryTravelAddress id.
// 76=Музей, 85=Театр, 39=Достопримечательность, 90=Парк.
const points = [
    { lat: 52.422281, lng: 31.016909, country: 3, address: 'Дворцово-парковый ансамбль Румянцевых-Паскевичей', categories: [39] },
    { lat: 52.428472, lng: 31.018684, country: 3, address: 'Музей истории города Гомеля (Охотничий домик)', categories: [76] },
    { lat: 52.430851, lng: 31.002880, country: 3, address: 'Картинная галерея Г. Х. Ващенко', categories: [76] },
    { lat: 52.424842, lng: 31.013650, country: 3, address: 'Гомельский областной драматический театр', categories: [85] },
    { lat: 52.431899, lng: 31.012336, country: 3, address: 'Гомельский государственный театр кукол', categories: [85] },
    { lat: 52.434279, lng: 31.010029, country: 3, address: 'Гомельский государственный цирк', categories: [39] },
    { lat: 52.427021, lng: 31.014192, country: 3, address: 'Улица Советская — купеческий центр старого Гомеля', categories: [39] },
    { lat: 52.417574, lng: 31.009074, country: 3, address: 'Спасо-Преображенский храм (Спасова слобода)', categories: [39] },
    { lat: 52.415186, lng: 31.008636, country: 3, address: 'Ильинская церковь — старейший деревянный храм Гомеля', categories: [39] },
    { lat: 52.4156, lng: 31.0134, country: 3, address: 'Высокий берег Сожа («Гомельский Кавказ»)', categories: [39] },
];

fs.writeFileSync(path.join(__dirname, 'gomel-guide-points.json'), JSON.stringify(points, null, 2));

const coordsMeTravel = withPoints
    ? points.map(p => ({ id: null, lat: p.lat, lng: p.lng, address: p.address, country: p.country, categories: p.categories, image: '' }))
    : [];

const payload = {
    id: idArg ? Number(idArg.split('=')[1]) : null,
    name: 'Гомель: путеводитель по дворцу, паркам, музеям и старому городу',
    slug: 'gomel-putevoditel-po-dvortsu-parkam-muzeyam-i-staromu-gorodu',
    description,
    coordsMeTravel,
    countries: [3],
    categories: [20],
    transports: [],
    month: [],
    complexity: [],
    companions: [],
    over_nights_stay: [],
    plus: 'Настоящий дворцово-парковый ансамбль в центре, высокий берег Сожа, компактный пешеходный старый город, сильные музеи, доступные цены.',
    minus: 'Многие музеи закрыты по понедельникам; цирковой сезон только с сентября по май.',
    recommendation: 'Лучшее время — май–сентябрь. Заложите минимум полдня на дворцово-парковый ансамбль и вечер на теплоход по Сожу.',
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
    console.log(`🚀 Гомель-путеводитель → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'}, ${doPublish ? 'PUBLISH' : 'DRAFT'}, points=${coordsMeTravel.length})`);
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
