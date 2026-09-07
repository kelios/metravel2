#!/usr/bin/env node
/**
 * One-off: подписи и координаты двух точек усадьбы Костровицких в travel #480
 * «Родники Юцковские — ДОТ 34 — Усадебный дом Костровицких». Борд: #1864.
 *
 * Что было не так
 * ---------------
 * Точка 14548 («Руины») подписана строкой обратного геокодера
 * «Конный клуб "Дикие Сайгаки", Садовая улица, …»: геокодер взял ближайший
 * ИМЕНОВАННЫЙ объект OSM — действующий конный клуб (OSM way 373893594,
 * leisure=horse_riding, 72 м от координаты), — а на фото точки кирпичные руины.
 * Читатель видел «конный клуб» + чип «РУИНЫ» + развалины на снимке: три
 * источника спорили друг с другом (отчёт TestFlight, Alena Nikitsich,
 * 06.09.2026, билд 1.0.5 (8)).
 *
 * Причина, по которой геокодер промахнулся, — сама координата: 53.7432874,
 * 27.1151204 стоит внутри выгула конного клуба, в 228 м от снятого объекта.
 * Поэтому одной подписи мало: без переноса маркера карта продолжила бы
 * показывать руины на территории работающего заведения.
 *
 * Что на фото (по источникам, не по догадке)
 * ------------------------------------------
 * 14548 — руины конюшни усадьбы Костровицких, огромное двухэтажное здание из
 * красного кирпича у дороги, кровля не сохранилась:
 *   - OSM way 373893590: building=stable, historic=ruins, material=brick,
 *     tourism=attraction; центроид 53.7427776, 27.1184876 (22 м от Заводской
 *     улицы — «возле дороги», как и написано в теле статьи);
 *   - problr.by, отдельная карточка «Усадьба Костровицких: конюшня»,
 *     53.74279, 27.118343, кон. XIX — нач. XX вв.;
 *   - planetabelarus.by: «Недалеко от усадебного дома сохранилось здание
 *     конюшни из красного кирпича»;
 *   - spadchyna.info: «рядом с усадьбой находится конюшня (иногда её упоминали
 *     как амбар или хлев)» — поэтому в подписи именно «конюшня», как её зовут
 *     все источники и само тело статьи («Возле дороги расположились руины
 *     конюшни»), без попытки уточнить спорное исходное назначение.
 *
 * 14549 — «Дом для рабочих (Мурованка)», 1912: на фото целое здание с крышей,
 * окнами и датой в кирпичном медальоне, то есть категория «Руины» ему тоже
 * противоречила:
 *   - OSM node 4945382379: historic=building, name:ru=«Дом для рабочих
 *     (Мурованка)», start_date=1912, ref=globus.tut.by; 53.7420980, 27.1203706;
 *   - тело статьи подписывает этот же кадр «Дом для рабочих»;
 *   - текущая координата 53.7419035, 27.1130852 — 480 м мимо, на безымянной
 *     сельской застройке.
 *
 * Почему через upsert
 * -------------------
 * Отдельного эндпоинта для строки TravelAddress нет, штатный путь — тот же,
 * что у `fix-point-343-category.js`: GET детали → правка coordsMeTravel →
 * `buildUpsertPayload` → PUT /travels/upsert/. Round-trip безопасен:
 * `image` возвращается как `{host}/address-image/{item.image}`, а
 * `_normalize_coordinate_image` снимает ровно этот префикс, так что снимок
 * точки остаётся привязан к своей строке и cleanup оригинала не запускается.
 * `description` на записи не санитайзится (обычный CharField + setattr), но
 * скрипт всё равно сверяет тело байт в байт: в статье живёт FAQPage на
 * `<details>`.
 *
 * Запуск:
 *   node scripts/fix-travel-480-estate-points.js            # репетиция (умолчание)
 *   node scripts/fix-travel-480-estate-points.js --apply    # запись на прод
 * Токен: env METRAVEL_TOKEN или ~/.metravel_token.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const { buildUpsertPayload, backupFileName } = require('./seo-edit.js');

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '');
const TRAVEL_ID = 480;

/**
 * Умолчание — репетиция, запись требует явного `--apply`.
 *
 * Так наоборот было ровно до SEO-OPS-001 (#1107/#1325/#1389/#1390): скрипт
 * искал `--dry-run` в argv, и любая опечатка (`--dry-ryn`) отвечала умолчанием,
 * а умолчанием была запись в живой прод. Неизвестный флаг здесь — стоп, а не
 * молчаливое согласие.
 */
const KNOWN_FLAGS = new Set(['--apply', '--dry-run']);
const argv = process.argv.slice(2);
const unknownFlags = argv.filter((a) => !KNOWN_FLAGS.has(a));
if (unknownFlags.length) {
  console.error(`Неизвестный аргумент: ${unknownFlags.join(' ')}. Допустимо только --apply или --dry-run.`);
  process.exit(2);
}
if (argv.includes('--apply') && argv.includes('--dry-run')) {
  console.error('--apply и --dry-run взаимоисключающие.');
  process.exit(2);
}
const isDryRun = !argv.includes('--apply');

const CAT_RUINS = 114; // Руины
const CAT_HOUSE = 36; // Дом

/** Целевое состояние точек. `categories` указан всегда — чтобы правка была декларацией, а не дельтой. */
const FIXES = [
  {
    id: 14548,
    address:
      'Руины конюшни усадьбы Костровицких, Большие Новосёлки, Дзержинский район, Минская область, Беларусь',
    lat: 53.7427776,
    lng: 27.1184876,
    categories: [CAT_RUINS],
    why: 'подпись называла соседний конный клуб; маркер стоял в 228 м, в его выгуле',
  },
  {
    id: 14549,
    address:
      'Дом для рабочих (Мурованка), Большие Новосёлки, Дзержинский район, Минская область, Беларусь',
    lat: 53.742098,
    lng: 27.1203706,
    categories: [CAT_HOUSE],
    why: 'точка была без имени объекта, «Руины» противоречили целому зданию, маркер стоял в 480 м',
  },
];

function resolveToken() {
  if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN.trim();
  try {
    const p = path.join(os.homedir(), '.metravel_token');
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  } catch {
    /* ignore */
  }
  return null;
}

const TOKEN = resolveToken();
if (!TOKEN) {
  console.error('Нужен токен: env METRAVEL_TOKEN или ~/.metravel_token');
  process.exit(1);
}

function req(method, urlPath, data) {
  return new Promise((resolve, reject) => {
    const body = data != null ? Buffer.from(JSON.stringify(data)) : null;
    const opts = {
      method,
      timeout: 60000,
      headers: { Authorization: `Token ${TOKEN}` },
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = body.length;
    }
    const r = https.request(`${API_BASE}${urlPath}`, opts, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, text: buf }));
    });
    r.on('error', reject);
    r.on('timeout', () => {
      r.destroy();
      reject(new Error('timeout'));
    });
    if (body) r.write(body);
    r.end();
  });
}

const describe = (p) =>
  `${p.id} [${(p.categories || []).join(',')}] ${p.lat},${p.lng} | ${p.address}`;

(async () => {
  const before = await req('GET', `/travels/${TRAVEL_ID}/`);
  if (before.status !== 200) throw new Error(`GET before HTTP ${before.status}`);
  const detail = JSON.parse(before.text);
  const points = detail.coordsMeTravel || [];

  // Бэкап снимает только настоящий прогон. Репетиция, кладущая файл в тот же
  // каталог, делает СЕБЯ последним снимком — и `--restore 480` после неё
  // поднимает уже исправленное состояние вместо предзапускового.
  //
  // Имя обязано лечь в схему `<id>-<ts>.json`: `latestBackup()` в seo-edit.js
  // отбирает файлы по префиксу `${id}-`, и снимок с любым другим именем он не
  // видит — тогда напечатанный ниже `--restore 480` молча поднял бы ЧУЖОЙ,
  // более старый снимок статьи.
  const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '.seo-backups');
  let backupFile = null;
  if (!isDryRun) {
    fs.mkdirSync(backupDir, { recursive: true });
    backupFile = path.join(
      backupDir,
      backupFileName(TRAVEL_ID, new Date().toISOString().replace(/[:.]/g, '-')),
    );
    fs.writeFileSync(backupFile, JSON.stringify(detail, null, 2));
    console.log(`backup -> ${backupFile}`);
  }

  console.log('--- BEFORE ---');
  for (const fix of FIXES) {
    const p = points.find((x) => x.id === fix.id);
    if (!p) throw new Error(`point ${fix.id} not found in travel ${TRAVEL_ID}`);
    console.log(`  ${describe(p)}`);
  }

  for (const fix of FIXES) {
    const p = points.find((x) => x.id === fix.id);
    p.address = fix.address;
    p.lat = fix.lat;
    p.lng = fix.lng;
    p.categories = [...fix.categories];
  }

  console.log('--- AFTER (планируется) ---');
  for (const fix of FIXES) {
    console.log(`  ${describe(points.find((x) => x.id === fix.id))}  // ${fix.why}`);
  }

  if (isDryRun) {
    console.log('[DRY] PUT /travels/upsert/ пропущен');
    return;
  }

  const payload = buildUpsertPayload(detail, {}); // тело и мета остаются как есть
  const put = await req('PUT', '/travels/upsert/', payload);
  console.log(`PUT /travels/upsert/ -> HTTP ${put.status}`);
  if (put.status !== 200 && put.status !== 201) {
    console.error(put.text.slice(0, 800));
    process.exit(1);
  }

  const after = await req('GET', `/travels/${TRAVEL_ID}/`);
  if (after.status !== 200) throw new Error(`GET after HTTP ${after.status}`);
  const ad = JSON.parse(after.text);
  const ap = ad.coordsMeTravel || [];

  console.log('--- VERIFY ---');
  const problems = [];
  for (const fix of FIXES) {
    const p = ap.find((x) => x.id === fix.id);
    if (!p) {
      problems.push(`точка ${fix.id} пропала`);
      continue;
    }
    console.log(`  ${describe(p)}`);
    if (p.address !== fix.address) problems.push(`${fix.id}: подпись не сохранилась`);
    if (Math.abs(p.lat - fix.lat) > 1e-6 || Math.abs(p.lng - fix.lng) > 1e-6) {
      problems.push(`${fix.id}: координата не сохранилась`);
    }
    if ([...(p.categories || [])].sort().join(',') !== [...fix.categories].sort().join(',')) {
      problems.push(`${fix.id}: категории не сохранились`);
    }
    if (/Дикие Сайгаки|Сайгак/i.test(p.address)) problems.push(`${fix.id}: чужое имя всё ещё в подписи`);
  }

  // Регрессии, ради которых стоит откатываться: тело статьи (в нём FAQPage на
  // <details>), состав точек и галереи, статус публикации, слаг.
  const beforePoint = (id) => (points.find((x) => x.id === id) || {}).image;
  for (const fix of FIXES) {
    const p = ap.find((x) => x.id === fix.id);
    if (p && p.image !== beforePoint(fix.id)) problems.push(`${fix.id}: снимок точки подменён`);
  }
  if ((ad.description || '') !== (detail.description || '')) problems.push('тело статьи изменилось');
  if (ap.length !== points.length) problems.push(`точек было ${points.length}, стало ${ap.length}`);
  if ((ad.gallery || []).length < (detail.gallery || []).length) problems.push('галерея усохла');
  if (ad.publish !== detail.publish || ad.moderation !== detail.moderation) problems.push('статус публикации изменился');
  if (ad.slug !== detail.slug) problems.push('слаг изменился');
  if ((ad.meta_description || '') !== (detail.meta_description || '')) problems.push('meta_description изменился');

  console.log(
    `points=${ap.length} gallery=${(ad.gallery || []).length} publish=${ad.publish} moderation=${ad.moderation} slug=${ad.slug} description=${(ad.description || '').length} симв.`,
  );
  if (problems.length) {
    console.error('❌ VERIFY FAILED:');
    for (const p of problems) console.error(`   - ${p}`);
    // `--backup-dir` печатается всегда: seo-edit.js читает только этот флаг и
    // не знает про BACKUP_DIR, поэтому снимок, уведённый env-переменной, откат
    // без флага не нашёл бы — и снова поднял бы более старый снимок из
    // каталога по умолчанию.
    console.error(
      `откат: node scripts/seo-edit.js --restore ${TRAVEL_ID} --backup-dir "${backupDir}" (снимок: ${backupFile})`,
    );
    process.exit(1);
  }
  console.log('✅ FIX VERIFIED');
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
