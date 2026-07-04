#!/usr/bin/env node
/**
 * Обновление статьи-путеводителя по Могилёву через PUT /travels/upsert/.
 * Статья УЖЕ существует на сайте (id=154, опубликована в 2018) — этот скрипт
 * ДОПОЛНЯЕТ её полным текстом путеводителя (музеи, Буйничское поле, маршруты,
 * FAQ), сохраняя авторские точки и фото. Текст — scripts/mogilev-guide-content.html.
 *
 * Существующие точки статьи (ратуша, собор, кафе Ale House, Архиерейский дворец)
 * сохраняются как есть (points ниже начинаются с них, с их реальными id/image).
 * Новые точки добавляются без id — бэк создаст их при сохранении.
 *
 * node scripts/create-mogilev-guide.js [--publish] [--with-points] [--id=154] [--dry-run]
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

const description = fs.readFileSync(path.join(__dirname, 'mogilev-guide-content.html'), 'utf8').trim();

// Точки путеводителя (country=3 Беларусь). categories — categoryTravelAddress id.
// 76=Музей, 85=Театр, 39=Достопримечательность, 90=Парк.
// Первые 4 точки — уже существующие в статье id=154 (сохраняем их id/image/categories как на сайте).
const points = [
    { id: 2628, lat: 53.8984373, lng: 30.3340234, country: 3, address: 'Могилёвская ратуша, 1А, Ленинская улица, Стары горад, Ленинский район, Могилёв, Могилёвская область, 212030, Беларусь', categories: [107], image: 'https://metravel.by/address-image/3367/conversions/AtCzyRYipAICgkQ7AlFSAIMZs2pmQtYAyrfCWMvW-thumb_400_wp.webp' },
    { id: 2629, lat: 53.9022649, lng: 30.3407578, country: 3, address: 'Собор Успения Девы Марии и Св. Станислава, 4, Комсомольская улица, Стары горад, Ленинский район, Могилёв, Могилёвская область, 212030, Беларусь', categories: [127], image: 'https://metravel.by/address-image/3368/conversions/b57vlkohx4Dh4rFZgbxlAKf6CoiGqmd7ykbCuebH-thumb_400_wp.webp' },
    { id: 2631, lat: 53.9047142, lng: 30.3435484, country: 3, address: '61, Ленинская улица, Стары горад, Ленинский район, Могилёв, Могилёвская область, 212030, Беларусь', categories: [50, 109], image: 'https://metravel.by/address-image/3370/conversions/vlJCE8IzInTceEIizZ46RJhUrRzq5mfrTyGoSrgq-thumb_400_wp.webp' },
    { id: 2632, lat: 53.8951911, lng: 30.3344901, country: 3, address: 'Архірэйскі палац, 1, улица Архиерейский Вал Канисского, Стары горад, Ленинский район, Могилёв, Могилёвская область, 212030, Беларусь', categories: [33], image: 'https://metravel.by/address-image/3371/conversions/t8sfmasNHkROxZrSf1we7rztdVQpPneZhcjacI5V-thumb_400_wp.webp' },
    // Новые точки — добавляются этим апдейтом
    { id: null, lat: 53.902280, lng: 30.340768, country: 3, address: 'Площадь Звёзд — памятник Звездочёту и 12 стульев зодиака, Могилёв', categories: [39], image: '' },
    { id: null, lat: 53.893600, lng: 30.345600, country: 3, address: 'Свято-Никольский женский монастырь, Могилёв', categories: [39], image: '' },
    { id: null, lat: 53.897514, lng: 30.333304, country: 3, address: 'Могилёвский областной драматический театр, Первомайская улица, 7, Могилёв', categories: [85], image: '' },
    { id: null, lat: 53.894583, lng: 30.331940, country: 3, address: 'Могилёвский областной краеведческий музей имени Е. Р. Романова, площадь Славы, 1, Могилёв', categories: [76], image: '' },
    { id: null, lat: 53.894548, lng: 30.330654, country: 3, address: 'Музей В. К. Бялыницкого-Бирули, улица Ленинская, 37, Могилёв', categories: [76], image: '' },
    { id: null, lat: 53.861670, lng: 30.254170, country: 3, address: 'Мемориальный комплекс «Буйничское поле», Могилёвский район', categories: [39], image: '' },
    { id: null, lat: 53.863333, lng: 30.267778, country: 3, address: 'Могилёвский зоосад, Буйничи', categories: [90], image: '' },
    { id: null, lat: 53.863197, lng: 30.260590, country: 3, address: 'Белорусская этнографическая деревня XIX века, Буйничи', categories: [39], image: '' },
];

fs.writeFileSync(path.join(__dirname, 'mogilev-guide-points.json'), JSON.stringify(points, null, 2));

const coordsMeTravel = withPoints
    ? points.map(p => ({ id: p.id, lat: p.lat, lng: p.lng, address: p.address, country: p.country, categories: p.categories, image: p.image }))
    : [];

const payload = {
    id: idArg ? Number(idArg.split('=')[1]) : 154,
    name: 'Могилёв, город истории, легенд и уютных улиц: что посмотреть и как спланировать поездку',
    slug: 'mogilev-gorod-istorii-legend-i-uiutnykh-ulits-chto-posmotret-i-kak-splanirovat-poezdku',
    description,
    coordsMeTravel,
    countries: [3],
    categories: [6],
    transports: [1],
    month: [8],
    complexity: [1],
    companions: [],
    over_nights_stay: [],
    plus: 'Компактный пешеходный старый город: ратуша с трубачом, звездочёт, барочные храмы; сильный военно-исторический комплекс Буйничское поле рядом с зоосадом и этнодеревней; доступные цены, минимум туристов.',
    minus: 'Многие музеи закрыты по понедельникам (Ленинская, 37 — ещё и по вторникам); на площади Звёзд по выходным много свадебных пар.',
    recommendation: 'На старый город хватит одного дня, но лучше закладывать выходные — Буйничское поле, зоосад и этнодеревня в Буйничах стоят отдельного полудня и рядом друг с другом.',
    youtube_link: '__draft_placeholder__',
    thumbs200ForCollectionArr: [],
    travelImageThumbUrlArr: [],
    travelImageAddress: [],
    visa: false,
    publish: doPublish,
    moderation: doPublish,
    year: 2018,
};

async function main() {
    console.log(`🚀 Могилёв-путеводитель → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'}, ${doPublish ? 'PUBLISH' : 'DRAFT'}, points=${coordsMeTravel.length}, id=${payload.id})`);
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
