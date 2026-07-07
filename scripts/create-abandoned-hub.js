#!/usr/bin/env node
/**
 * Pillar-хаб «Заброшенные дворцы и усадьбы Беларуси» через PUT /travels/upsert/.
 * Компилятивный хаб из точек существующих статей автора (635 усадьбы/замки, 672 маршруты
 * из Минска, 566 автомаршруты, 480 Юцковские). Текст — scripts/abandoned-hub-content.html,
 * фото — только metravel.by из своих статей (address-image точек-доноров + gallery HD).
 *
 * node scripts/create-abandoned-hub.js [--publish] [--with-points] [--id=N] [--dry-run]
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

const description = fs.readFileSync(path.join(__dirname, 'abandoned-hub-content.html'), 'utf8').trim();

// Точки (country=3 Беларусь). categories — categoryTravelAddress id:
// 33=Дворец, 136=Усадьба, 114=Руины, 118=Руины дворца, 116=Руины усадьбы, 141=Храм, 89=Памятник.
// Координаты и фото — из точек статей-доноров 635/672/566 (sourceImage → upload после upsert).
const points = [
    { lat: 53.6008917, lng: 24.9576159, address: 'Желудок: дворец Святополк-Четвертинских', categories: [33], sourceImage: 'https://metravel.by/address-image/15600/conversions/fe1857f8d298458096fee92a00876d2a.webp' },
    { lat: 53.5997711, lng: 24.9562211, address: 'Желудок: склеп-усыпальница в усадебном парке', categories: [89], sourceImage: 'https://metravel.by/address-image/15601/conversions/db981e7dac4f45cb840ae19a5722ed22.webp' },
    { lat: 54.1309611, lng: 25.7666988, address: 'Жемыславль: дворец Умястовских', categories: [33, 116], sourceImage: 'https://metravel.by/address-image/15515/conversions/479f6831a1844bd4a4cc2fff59f4f22c.webp' },
    { lat: 53.9934664, lng: 25.1935472, address: 'Жирмуны: руины усадьбы Радзивиллов', categories: [116], sourceImage: 'https://metravel.by/address-image/15497/conversions/a08a821296d844ddbe0b557c60d1fee4.webp' },
    { lat: 53.6833700, lng: 24.9350467, address: 'Большое Можейково: усадьба Ходкевичей', categories: [136], sourceImage: 'https://metravel.by/address-image/15604/conversions/dcdeaaf23a2742029672708318367337.webp' },
    { lat: 53.6269483, lng: 25.0257472, address: 'Дикушки: усадьба Гробовских', categories: [136, 116], sourceImage: 'https://metravel.by/address-image/15607/conversions/3c26918a64df48f5b016e0ac59366ecb.webp' },
    { lat: 53.6681422, lng: 24.8849849, address: 'Ищелно: усадебно-парковый комплекс Ласковичей', categories: [136, 116], sourceImage: 'https://metravel.by/address-image/15608/conversions/809ed95a2ab54351be5c6ee01e612f0a.webp' },
    { lat: 53.7502270, lng: 28.0175765, address: 'Смиловичи: дворец Монюшко-Ваньковичей', categories: [33, 118], sourceImage: 'https://metravel.by/address-image/15508/conversions/4282c31c031548c1893dcf02a522690d.webp' },
    { lat: 54.2053365, lng: 27.8447456, address: 'Логойск: руины дворца Тышкевичей', categories: [118], sourceImage: 'https://metravel.by/gallery/2791/conversions/i6hol6L2bwkfTs9ofHQvf0mZyC2cZHt1QkDCOD7I-detail_hd.jpg' },
    { lat: 54.0281670, lng: 27.4348301, address: 'Сёмково: дворец Адама Хмары', categories: [33], sourceImage: 'https://metravel.by/address-image/15498/conversions/4af2e9b54d954ca58b940715a68a7e96.webp' },
    { lat: 53.9762277, lng: 26.6925008, address: 'Под Ивенцом: руины усадьбы Тышкевичей', categories: [116], sourceImage: 'https://metravel.by/address-image/15511/conversions/ccf55a329c224e10856ba5bf6c7f90d3.webp' },
    { lat: 53.9767261, lng: 26.6900868, address: 'Под Ивенцом: заброшенный санаторий «Лесное»', categories: [114], sourceImage: 'https://metravel.by/address-image/15512/conversions/1b636ec8c7e847b0be9cc14fdf94af58.webp' },
    { lat: 53.7435666, lng: 27.1181567, address: 'Большие Новосёлки: усадебный дом Костровицких', categories: [136, 116], sourceImage: 'https://metravel.by/address-image/6556/conversions/RcxXnHvhjOCHpPMXKkMjrs6WKJvVrxnlGa2nWcbb-thumb_400_wp.webp' },
    { lat: 53.4434342, lng: 27.1541197, address: 'Кухтичи: усадьба Завишей', categories: [136], sourceImage: 'https://metravel.by/address-image/15510/conversions/8e7a226c12ef472c852d3fd3e015d179.webp' },
    { lat: 53.0245595, lng: 26.3401895, address: 'Грушевка: усадьба Рейтанов', categories: [136], sourceImage: 'https://metravel.by/address-image/15516/conversions/da89db80490f4b41901a35d2b969c836.webp' },
    { lat: 53.0251525, lng: 26.3232840, address: 'Грушевка: часовня-усыпальница Рейтанов', categories: [141], sourceImage: 'https://metravel.by/address-image/15517/conversions/9b5f72bf21824a74919aea7336e424e6.webp' },
    { lat: 52.9170306, lng: 26.4114056, address: 'Совейки: дворец Новицких', categories: [33, 136], sourceImage: 'https://metravel.by/address-image/15057/conversions/4cd326b470a94f6690c7ead794bbf320.webp' },
    { lat: 53.0274504, lng: 25.8163776, address: 'Павлиново: дворец Бохвицей (1906)', categories: [33, 116], sourceImage: 'https://metravel.by/address-image/3836/conversions/548a066c9f5f439b88e15cdd53b738f7.JPG' },
    { lat: 53.0307502, lng: 25.9607062, address: 'Ястрембель: усадебный дом Котлубаев (1897)', categories: [136, 116], sourceImage: 'https://metravel.by/address-image/3841/conversions/e6adc04ef0994d64bc3f091a618cf043.JPG' },
    { lat: 52.9614806, lng: 26.5437361, address: 'Туча: усадьба Еленских', categories: [136], sourceImage: 'https://metravel.by/address-image/15054/conversions/1cd126febc8044f88d0fb042b639c437.webp' },
    { lat: 52.9272806, lng: 26.5607694, address: 'Карацк: усадьба Черноцких', categories: [116], sourceImage: 'https://metravel.by/address-image/15055/conversions/9ee6be067a1d4ccf9146b08a0f863c2e.webp' },
    { lat: 52.8877000, lng: 26.5508167, address: 'Голынка: руины усадьбы Вендорфов', categories: [116], sourceImage: 'https://metravel.by/address-image/15058/conversions/62726d9fe4344521b148702f055dc890.webp' },
    { lat: 52.3677204, lng: 23.3672204, address: 'Высокое: дворец Сапег-Потоцких', categories: [33, 116], sourceImage: 'https://metravel.by/address-image/15503/conversions/2f8c14e923da418e89e9f1565987d74f.webp' },
    { lat: 55.3842417, lng: 26.5731361, address: 'Видзы-Ловчинские: усадьба Вавжецких', categories: [116], sourceImage: 'https://metravel.by/address-image/15047/conversions/8bb5eb4fd934440c8bb2027916b5465b.webp' },
    { lat: 51.8044553, lng: 29.5012715, address: 'Наровля: дворец Горваттов', categories: [33, 118], sourceImage: 'https://metravel.by/address-image/15520/conversions/2c41bcdd59f84e58af7d33c581525d92.webp' },
    // Волна 2 (13 мест из ресёрча): 115=Руины замка, 114=Руины
    { lat: 54.2511747, lng: 26.0204315, address: 'Гольшанский замок (руины замка Сапег)', categories: [115], sourceImage: 'https://metravel.by/address-image/3518/conversions/HpT9Zy6hsmp98u3gP8nkjWwGOwmniS4JjLkh08m6-thumb_400_wp.webp' },
    { lat: 54.3092241, lng: 26.2830305, address: 'Кревский замок', categories: [115], sourceImage: 'https://metravel.by/address-image/3523/conversions/0TBMykf9UrzpGjSohx32ZetFSp7fkVSX1ogiKqFP-thumb_400_wp.webp' },
    { lat: 54.6012569, lng: 30.0543494, address: 'Смольяны: башня замка «Белый Ковель»', categories: [115], sourceImage: 'https://metravel.by/address-image/3327/conversions/WbpSWD8swfhzqz3zbHFBLLlcnGtNcOiDGlTpd4OU-thumb_400_wp.webp' },
    { lat: 52.8604020, lng: 24.8958478, address: 'Ружаны: дворцовый комплекс Сапег', categories: [118, 33], sourceImage: 'https://metravel.by/address-image/3738/conversions/TgTy1HVTFlIpVlyD9GhLrB9sRnqedue7bfaMORmt-thumb_400_wp.webp' },
    { lat: 53.5180096, lng: 30.2588882, address: 'Быховский замок', categories: [115], sourceImage: 'https://metravel.by/address-image/3266/conversions/BDiSPfF4j5lIADmORrxDE0XHGj2w5l5ONQ8tFW0w-thumb_400_wp.webp' },
    { lat: 53.3466702, lng: 27.0806208, address: 'Наднеман: усадьба Наркевича-Иодко', categories: [116], sourceImage: 'https://metravel.by/address-image/437/conversions/8678db12eb06404f9ae322f453346679.JPG' },
    { lat: 53.0091790, lng: 26.6773818, address: 'Красная Звезда: руины летнего дворца Радзивиллов', categories: [118], sourceImage: 'https://metravel.by/address-image/3492/conversions/4BL7xdRv8luKIJsq1sy0BlS5d65iV2eyxbEIyfEL-thumb_400_wp.webp' },
    { lat: 53.8843624, lng: 28.6151962, address: 'Рованичи: дворец Слотвинских', categories: [33, 116], sourceImage: 'https://metravel.by/address-image/3598/conversions/gNZKPh2o9Md7kCTlEf8hazKU5FtTkZif01qdQQPB-thumb_400_wp.webp' },
    { lat: 52.4930999, lng: 24.4803007, address: 'Линово: дворцово-парковый комплекс Трэмбицких', categories: [116], sourceImage: 'https://metravel.by/address-image/3821/conversions/ef55ICoBrT0inak3ovYTl29eVs4fnnL3lDvE5fHv-thumb_400_wp.webp' },
    { lat: 52.4937988, lng: 24.4786484, address: 'Линово: бровар (1921)', categories: [114], sourceImage: 'https://metravel.by/address-image/7932/conversions/d1f9705022274a60a0ab1f5045e8f5e5.webp' },
    { lat: 52.2842772, lng: 23.3455117, address: 'Червинцы: усадьба Пузынов', categories: [116], sourceImage: 'https://metravel.by/address-image/3831/conversions/LLAYYJPMeV7YVmLUmn02Ajeqp5eshbmkVhBAU0eH-thumb_400_wp.webp' },
    { lat: 55.8533064, lng: 27.7160919, address: 'Опытная: дворец Нитославских', categories: [116, 33], sourceImage: 'https://metravel.by/address-image/5487/conversions/93e15f18a1534b3aac81f1595761e213.JPG' },
    { lat: 54.6449671, lng: 30.4315785, address: 'Высокое (Оршанский район): усадьба Макшицких', categories: [136, 116], sourceImage: 'https://metravel.by/address-image/3306/conversions/VVntU3lcMIVnT0CcbhJqV1iLZpxTPLJPOZKpF7rn-thumb_400_wp.webp' },
];

fs.writeFileSync(path.join(__dirname, 'abandoned-hub-points.json'), JSON.stringify(points, null, 2));

const coordsMeTravel = withPoints
    ? points.map(p => ({ id: null, lat: p.lat, lng: p.lng, address: p.address, country: 3, categories: p.categories, image: '' }))
    : [];

const payload = {
    id: idArg ? Number(idArg.split('=')[1]) : null,
    name: 'Заброшенные дворцы и усадьбы Беларуси: 25 атмосферных мест с фото и координатами',
    slug: 'zabroshennye-dvortsy-i-usadby-belarusi-24-atmosfernykh-mesta-s-foto-i-koordinatami',
    description,
    coordsMeTravel,
    countries: [3],
    categories: [19, 20],
    transports: [1],
    month: [5, 9],
    complexity: [1],
    companions: [],
    over_nights_stay: [],
    plus: 'Все 25 мест проверены лично — от дворца Четвертинских в Желудке до Горваттов в Наровле; никаких толп и касс, свои фото и координаты каждой точки.',
    minus: 'Почти все здания аварийные — внутрь заходить опасно; часть комплексов за заборами; до дальних руин без машины не добраться; летом клещи и крапива.',
    recommendation: 'Езжайте в мае или сентябре: без листвы видна кладка, без жары — приятна дорога. На один день берите гродненский маршрут (Желудок — Можейково — Ищелно), на два — Брестчину с Совейками.',
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
    console.log(`🚀 Хаб «Заброшенные дворцы и усадьбы Беларуси» → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'}, ${doPublish ? 'PUBLISH' : 'DRAFT'}, points=${coordsMeTravel.length}, id=${payload.id})`);
    console.log(`   desc=${description.length} chars, name=${payload.name.length} chars`);
    const tooLong = points.filter(p => p.address.length > 100);
    if (tooLong.length) { console.error('❌ address >100 chars:', tooLong.map(p => p.address)); process.exit(1); }
    if (isDryRun) { console.log('DRY RUN — ничего не отправлено.'); return; }
    const res = await fetch(`${API_BASE}/travels/upsert/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${TOKEN}` },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) { console.error(`❌ HTTP ${res.status}: ${text.slice(0, 800)}`); process.exit(1); }
    let data; try { data = JSON.parse(text); } catch { data = {}; }
    console.log(`✅ HTTP ${res.status} | id=${data.id} | slug=${data.slug} | publish=${data.publish} | points=${(data.travelAddress || data.coordsMeTravel || []).length}`);
    console.log(`   URL: https://metravel.by/travel/${data.id}`);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
