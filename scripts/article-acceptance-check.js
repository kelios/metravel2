#!/usr/bin/env node
/**
 * Приёмка одной статьи автора 1 одной командой — то, что раньше было ручным
 * чек-листом шага 8 скилла `metravel-travel-article` и самопроверкой
 * `travel-writer`. Скрипт только ЧИТАЕТ публичный прод-API (без токена, без
 * записи) и по каждому правилу печатает ✓/✗ с конкретикой.
 *
 * Что проверяется:
 *   - картинки тела: HTTP 200, только `travel-description-image` (address-image
 *     умирает вместе с точкой), непустой alt, не «Изображение» и не название
 *     статьи; дубли кадров по md5 и по перцептивному dhash (перекодированная
 *     копия того же снимка md5 не ловит, #1980); галерея — подписи и дубли;
 *   - люди в подписях: alt и `gallery[].caption` с точки зрения места
 *     (правило владельца 20.09.2026), шаблон с кириллическими границами слов;
 *   - структура: «Что рядом» ровно один, «Квесты по городам рядом» ровно один,
 *     каждая ссылка квеста — пара (city_id, quest_id) из `/api/quests/`;
 *   - комментарий редакции: ровно один верхнеуровневый от user 120;
 *   - `created_at` внутри месяца поездки, `month` не пуст;
 *   - имена точек: без улиц/номеров/кодов в качестве имени и без дублей;
 *   - тексты: запрещённые по Беларуси источники (`scan-content-sources`),
 *     `sid=`/`checkin=` в ссылках (`aid=`/`label=` — партнёрка, норма),
 *     `[уточнить]`, `__draft_placeholder__`, U+FFFD, `utm_source=chatgpt.com`,
 *     Instagram-iframe (бэкенд его режет — в теле только ссылка на reel/пост).
 *
 * Корпусный 404-прогон по ВСЕМ статьям — `npm run test:media:body`; здесь одна
 * статья целиком, включая то, что корпусный прогон не видит.
 *
 * Usage:
 *   node scripts/article-acceptance-check.js --id 791 [--url https://metravel.by]
 *     [--json] [--no-images]
 * Код возврата 1 при любом ✗, 2 — ошибка запуска/чтения API.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadPatterns, scanText } = require('./scan-content-sources');

const RICH_TEXT_FIELDS = ['description', 'plus', 'minus', 'recommendation'];
const AUTHOR_USER_ID = 1;
const EDITOR_USER_ID = 120;
const USER_AGENT = 'MeTravelArticleAcceptance/1.0';
const IMAGE_CONCURRENCY = 3;
// Один зависший ответ прода не должен вешать приёмку целиком.
const REQUEST_TIMEOUT_MS = 30000;
// dhash 16×16 = 256 бит; ≤12 — та же картинка после перекодирования (замер #1980:
// 0 у копий, у разных кадров одного места — десятки).
const DHASH_MAX_DISTANCE = 12;

// Один шаблон «людей в подписи» на скилл и проверку. `\b` в JS кириллицу не
// видит, поэтому границы слова — явные lookaround по кириллице.
const PEOPLE_IN_CAPTION_RE = /(?<![А-Яа-яЁё])(Юля|Юли|муж|мы|нас|селфи|человек|идём|едем|велосипедист)(?![А-Яа-яЁё])/iu;

// Имя точки из геокодера: «964», «S7», «DK79», «Krakowska 149», «ul. Długa 5».
const RAW_POINT_NAME_RES = [
  /^\d+[a-zа-я]?$/iu,
  /^[A-Z]{1,3}\s?-?\d{1,4}$/u,
  /^(?:ul\.|ulica|al\.|aleja|улица|ул\.|пр\.)\s/iu,
  /^[\p{L}.'-]+(?:\s[\p{L}.'-]+)*\s\d+[a-zа-я]?(?:\/\d+)?$/iu,
];

function decodeEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  if (!m) return null;
  return decodeEntities(m[2] != null ? m[2] : m[3]);
}

function absoluteUrl(src, origin) {
  if (!src) return null;
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('/')) return `${origin}${src}`;
  if (src.startsWith('http://')) return `https://${src.slice(7)}`;
  return src;
}

function extractImages(html, origin) {
  const out = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    out.push({ src: absoluteUrl(attr(m[0], 'src'), origin), alt: (attr(m[0], 'alt') || '').trim() });
  }
  return out;
}

function extractLinks(html) {
  const out = [];
  const re = /<a\b[^>]*>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const href = attr(m[0], 'href');
    if (href) out.push(href);
  }
  return out;
}

function headingTexts(html) {
  const out = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) out.push(stripTags(m[2]));
  return out;
}

// Жанр 2d (`metravel-travel-article` → правило 3): заголовки — места и эпизоды
// дня, вся практика — один «Если соберётесь». Разделы путеводителя, маркеры
// генерации, `<h1>` в теле и эмодзи в заголовке — дефект. Вопросы FAQ (с «?»)
// на разделы не проверяются: «Как добраться до …?» — нормальный вопрос; эмодзи
// дефект и в них.
const GUIDE_HEADINGS = ['вступление', 'что увидели', 'как прошло', 'итог', 'итоги', 'точки', 'описание',
  'наши впечатления', 'сложность маршрута', 'история', 'легенды и факты', 'маршрут в цифрах'];
const GUIDE_HEADING_PREFIXES = ['практическая информация', 'как добраться', 'что взять', 'что посмотреть',
  'как перемещаться', 'когда лучше ехать', 'когда ехать', 'где поесть', 'где остановиться', 'где жить',
  'главные музеи', 'какие музеи'];
// Keycap-эмодзи («1️⃣») — цифра + U+20E3, в Extended_Pictographic не входит.
const PICTOGRAPH_RE = /[\p{Extended_Pictographic}\u20E3]/u;

function checkGenreHeadings(html) {
  const body = String(html || '');
  const problems = [];
  const h1 = (body.match(/<h1\b/gi) || []).length;
  if (h1) problems.push(`<h1> в теле: ${h1}`);
  let practice = 0;
  for (const text of headingTexts(body)) {
    if (PICTOGRAPH_RE.test(text)) problems.push(`эмодзи в заголовке «${text}»`);
    if (text.endsWith('?')) continue;
    const norm = text.replace(/[\p{Extended_Pictographic}\uFE0F\u20E3\u200D]/gu, '').replace(/^[\d.)\s]+/u, '')
      .replace(/[:.!…\s]+$/u, '').toLowerCase().replace(/ё/g, 'е');
    if (GUIDE_HEADINGS.includes(norm) || GUIDE_HEADING_PREFIXES.some((p) => norm.startsWith(p))) {
      problems.push(`раздел путеводителя «${text}»`);
    }
    if (norm.startsWith('если соберетесь')) practice += 1;
  }
  if (practice > 1) problems.push(`«Если соберётесь» заголовком: ${practice}`);
  return problems;
}

function findPeopleInCaption(text) {
  const m = String(text || '').match(PEOPLE_IN_CAPTION_RE);
  return m ? m[1] : null;
}

function isRawPointName(name) {
  const value = String(name || '').trim();
  if (!value) return true;
  return RAW_POINT_NAME_RES.some((re) => re.test(value));
}

function checkPointNames(points) {
  const problems = [];
  const seen = new Map();
  for (const p of points || []) {
    const name = String(p.address || '').trim();
    if (isRawPointName(name)) problems.push(`точка ${p.id}: «${name}» — адрес/код вместо имени места`);
    const key = name.toLowerCase();
    if (key) seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const [name, count] of seen) if (count > 1) problems.push(`«${name}» ×${count} — дубль имени точки`);
  return problems;
}

function checkCreatedAt(detail) {
  const months = Array.isArray(detail.month) ? detail.month.map(Number) : [];
  const year = Number(detail.year);
  const problems = [];
  if (!months.length) problems.push('month пуст — восстановить по кадрам/тексту');
  const m = String(detail.created_at || '').match(/^(\d{4})-(\d{2})/);
  if (!m) problems.push('created_at отсутствует');
  else if (months.length && (Number(m[1]) !== year || !months.includes(Number(m[2])))) {
    problems.push(`created_at ${detail.created_at} вне поездки (year ${year}, month ${months.join(',')})`);
  }
  return problems;
}

function findPrivateParams(links) {
  return links.filter((href) => /[?&](sid|checkin|checkout)=/i.test(href));
}

function textMarkers(fields) {
  const problems = [];
  for (const [name, value] of Object.entries(fields)) {
    const text = String(value || '');
    const checks = [
      [/\[уточнить\]/giu, '[уточнить]'],
      [/__draft_placeholder__/g, '__draft_placeholder__'],
      [/�/g, 'U+FFFD'],
      [/utm_source=chatgpt\.com/gi, 'utm_source=chatgpt.com'],
      [/<iframe[^>]+instagram\.com/gi, 'Instagram-iframe (в теле — только <p><a href=".../reel/<id>/">)'],
    ];
    for (const [re, label] of checks) {
      const count = (text.match(re) || []).length;
      if (count) problems.push(`${name}: ${label} ×${count}`);
    }
  }
  return problems;
}

function questLinks(html) {
  return extractLinks(html)
    .map((href) => href.replace(/^https?:\/\/(?:www\.)?metravel\.by/i, ''))
    .map((href) => href.match(/^\/quests\/([^/?#]+)\/([^/?#]+)/))
    .filter(Boolean)
    .map((m) => ({ city: decodeURIComponent(m[1]), quest: decodeURIComponent(m[2]), path: m[0] }));
}

function checkQuestLinks(links, quests) {
  const problems = [];
  const warnings = [];
  for (const link of links) {
    const quest = quests.find((q) => String(q.quest_id) === link.quest);
    if (!quest) {
      problems.push(`${link.path}: quest_id «${link.quest}» нет в /api/quests/`);
      continue;
    }
    if (String(quest.city_id) === link.city) continue;
    const aliases = [quest.city_alias, ...(quest.city_legacy_ids || [])].map(String);
    if (aliases.includes(link.city)) warnings.push(`${link.path}: не канонический путь, нужен /quests/${quest.city_id}/${quest.quest_id}`);
    else problems.push(`${link.path}: город «${link.city}» не совпадает с city_id ${quest.city_id}`);
  }
  return { problems, warnings };
}

function hamming(a, b) {
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) distance += 1;
  return distance;
}

// 17×16 grayscale → 256 бит: каждый пиксель сравнивается с правым соседом.
function dhashFromGray(gray, width = 17, height = 16) {
  if (!gray || gray.length < width * height) return null;
  const bits = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) bits.push(gray[y * width + x] > gray[y * width + x + 1] ? 1 : 0);
  }
  return bits;
}

// Перцептивный хэш через локальный ffmpeg: он декодирует webp/jpeg/png
// одинаково, а зависимостей с нативным кодом в проекте нет. Вход — временный
// файл, не stdin: webp из pipe ffmpeg пробует бесконечно и вешает приёмку.
function grayThumbnailWithFfmpeg(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'article-acceptance-'));
  const file = path.join(dir, 'frame');
  try {
    fs.writeFileSync(file, buffer);
    const result = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-i', file, '-vf', 'scale=17:16,format=gray', '-f', 'rawvideo', 'pipe:1'], {
      maxBuffer: 1024 * 1024,
      timeout: 15000,
    });
    if (result.error || result.status !== 0) return null;
    return result.stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function findDuplicates(entries) {
  const pairs = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (a.md5 && a.md5 === b.md5) pairs.push({ a, b, kind: 'md5' });
      else if (a.dhash && b.dhash && hamming(a.dhash, b.dhash) <= DHASH_MAX_DISTANCE) {
        pairs.push({ a, b, kind: `dhash ${hamming(a.dhash, b.dhash)}` });
      }
    }
  }
  return pairs;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function fetchAllQuests(fetchImpl, origin) {
  const quests = [];
  let url = `${origin}/api/quests/?perPage=200`;
  for (let page = 0; url && page < 20; page += 1) {
    const data = await fetchJson(fetchImpl, url);
    quests.push(...(Array.isArray(data) ? data : data.results || []));
    url = Array.isArray(data) ? null : data.next;
  }
  return quests;
}

async function probeImage(fetchImpl, url, grayThumbnail) {
  try {
    const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) return { url, status: response.status };
    const buffer = Buffer.from(await response.arrayBuffer());
    const gray = grayThumbnail ? grayThumbnail(buffer) : null;
    return {
      url,
      status: response.status,
      md5: crypto.createHash('md5').update(buffer).digest('hex'),
      dhash: gray ? dhashFromGray(gray) : null,
    };
  } catch (error) {
    return { url, status: 0, error: error.message };
  }
}

function check(id, title, problems, warnings = []) {
  return { id, title, ok: problems.length === 0, problems, warnings };
}

async function runChecks({ id, origin = 'https://metravel.by', fetchImpl = fetch, images = true, grayThumbnail = grayThumbnailWithFfmpeg } = {}) {
  const detail = await fetchJson(fetchImpl, `${origin}/api/travels/${id}/`);
  const [tree, quests] = await Promise.all([
    fetchJson(fetchImpl, `${origin}/api/travel-comments/tree/?travel_id=${id}`),
    fetchAllQuests(fetchImpl, origin),
  ]);
  const fields = Object.fromEntries(RICH_TEXT_FIELDS.map((f) => [f, detail[f] || '']));
  const body = RICH_TEXT_FIELDS.map((f) => fields[f]).join('\n');
  const name = String(detail.name || '');
  const bodyImages = extractImages(body, origin);
  const gallery = (detail.gallery || []).filter((g) => g && g.url).map((g) => ({ ...g, url: absoluteUrl(g.url, origin) }));
  const results = [];

  const authorIds = String(detail.userIds ?? detail.user?.id ?? '').split(',').map((v) => Number(v.trim()));
  results.push(check('author', 'статья автора 1', authorIds.includes(AUTHOR_USER_ID) ? [] : [`userIds=${detail.userIds} — гостевую статью не правим`]));

  const altProblems = [];
  const familyProblems = [];
  const familyWarnings = [];
  for (const img of bodyImages) {
    const where = img.src || '<без src>';
    if (!img.alt) altProblems.push(`${where}: пустой alt`);
    else if (/^изображение$/iu.test(img.alt) || img.alt.toLowerCase() === name.trim().toLowerCase()) altProblems.push(`${where}: alt «${img.alt}» не описывает кадр`);
    if (!img.src || !/^https:\/\/metravel\.by\//i.test(img.src)) familyProblems.push(`${where}: не своё фото metravel.by`);
    else if (/\/address-image\//i.test(img.src)) familyProblems.push(`${where}: address-image в теле умирает с точкой — перезалить в collection=description`);
    else if (!/\/travel-description-image\//i.test(img.src)) familyWarnings.push(`${where}: не travel-description-image`);
  }
  results.push(check('img-alt', 'alt у каждой картинки тела', altProblems));
  results.push(check('img-family', 'в теле только свои travel-description-image', familyProblems, familyWarnings));

  const captionProblems = [];
  for (const img of bodyImages) {
    const hit = findPeopleInCaption(img.alt);
    if (hit) captionProblems.push(`alt «${img.alt}»: «${hit}»`);
  }
  for (const g of gallery) {
    const hit = findPeopleInCaption(g.caption);
    if (hit) captionProblems.push(`галерея ${g.id} «${g.caption}»: «${hit}»`);
  }
  results.push(check('captions-place', 'подписи с точки зрения места, не людей', captionProblems));
  results.push(check('gallery-captions', 'подписи галереи проставлены',
    gallery.filter((g) => !String(g.caption || '').trim()).map((g) => `галерея ${g.id}: пустая подпись`)));

  if (images) {
    const bodyTargets = bodyImages.filter((img) => img.src && /^https:\/\//i.test(img.src));
    const probed = await mapLimit([...bodyTargets.map((img) => img.src), ...gallery.map((g) => g.url)], IMAGE_CONCURRENCY,
      (url) => probeImage(fetchImpl, url, grayThumbnail));
    const bodyProbes = probed.slice(0, bodyTargets.length).map((p, i) => ({ ...p, where: `тело #${i + 1}` }));
    const galleryProbes = probed.slice(bodyTargets.length).map((p, i) => ({ ...p, where: `галерея ${gallery[i].id}` }));
    results.push(check('img-status', 'каждая картинка тела и галереи отдаёт 200',
      probed.filter((p) => p.status !== 200).map((p) => `${p.url}: ${p.status || p.error}`)));
    const describe = ({ a, b, kind }) => `${a.where} = ${b.where} (${kind}): ${a.url} / ${b.url}`;
    const crossWarnings = findDuplicates([...bodyProbes, ...galleryProbes])
      .filter(({ a, b }) => a.where.startsWith('тело') !== b.where.startsWith('тело'))
      .map(describe);
    const phashNote = probed.some((p) => p.md5) && !probed.some((p) => p.dhash) ? ['перцептивный хэш пропущен: нет ffmpeg'] : [];
    results.push(check('img-duplicates', 'нет дублей кадров (md5 + dhash) в теле и в галерее',
      [...findDuplicates(bodyProbes), ...findDuplicates(galleryProbes)].map(describe), [...crossWarnings, ...phashNote]));
  }

  const headings = headingTexts(fields.description);
  const nearby = headings.filter((h) => /что рядом/iu.test(h)).length;
  results.push(check('nearby', '«Что рядом» ровно один', nearby === 1 ? [] : [`найдено ${nearby}`]));
  results.push(check('genre-2d', 'заголовки по жанру 2d: без <h1>, эмодзи и разделов путеводителя', checkGenreHeadings(fields.description)));
  const questBlocks = headings.filter((h) => /^квесты по городам рядом$/iu.test(h)).length;
  const questCheck = checkQuestLinks(questLinks(fields.description), quests);
  results.push(check('quests', '«Квесты по городам рядом» ровно один, ссылки из /api/quests/',
    [...(questBlocks === 1 ? [] : [`блоков ${questBlocks}`]), ...questCheck.problems], questCheck.warnings));

  const top = Array.isArray(tree.top_level) ? tree.top_level : [];
  const editorial = top.filter((c) => Number(c.user) === EDITOR_USER_ID);
  results.push(check('editorial-comment', 'комментарий редакции ровно один, от user 120',
    editorial.length === 1 ? [] : [`от user 120: ${editorial.length} (всего верхнего уровня ${top.length})`]));

  results.push(check('created-at', 'created_at = дата поездки, month не пуст', checkCreatedAt(detail)));
  results.push(check('point-names', 'имена точек — места, без адресов и дублей', checkPointNames(detail.coordsMeTravel || detail.travelAddress)));

  const patterns = loadPatterns();
  const sourceHits = scanText([name, ...RICH_TEXT_FIELDS.map((f) => fields[f])].join('\n'), patterns, `travel ${id}`);
  results.push(check('sources-by', 'нет запрещённых по Беларуси источников', sourceHits.map((h) => `${h.label}: «${h.match}»`)));
  results.push(check('private-data', 'нет sid=/checkin= в ссылках', findPrivateParams(extractLinks(body)).map((href) => href.slice(0, 160))));
  results.push(check('text-markers', 'нет [уточнить], сентинела и мусора', textMarkers({ ...fields, youtube_link: detail.youtube_link, name })));

  return {
    id: Number(id),
    slug: detail.slug,
    url: `${origin}/travels/${detail.slug}`,
    publish: Boolean(detail.publish),
    moderation: Boolean(detail.moderation),
    images: { body: bodyImages.length, gallery: gallery.length },
    results,
    ok: results.every((r) => r.ok),
  };
}

function formatReport(report) {
  const lines = [`travel ${report.id} ${report.url} (publish=${report.publish}, moderation=${report.moderation}, img тела ${report.images.body}, галерея ${report.images.gallery})`];
  for (const r of report.results) {
    lines.push(`${r.ok ? '✓' : '✗'} ${r.id}: ${r.title}`);
    for (const p of r.problems) lines.push(`    ✗ ${p}`);
    for (const w of r.warnings) lines.push(`    ! ${w}`);
  }
  const failed = report.results.filter((r) => !r.ok).length;
  lines.push(failed ? `ИТОГ: ✗ не прошло проверок: ${failed}` : 'ИТОГ: ✓ все проверки прошли');
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = { images: true, json: false, origin: 'https://metravel.by', id: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--id') args.id = argv[++i];
    else if (argv[i] === '--url') args.origin = String(argv[++i] || '').replace(/\/+$/, '');
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--no-images') args.images = false;
  }
  return args;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.id || !/^\d+$/.test(String(args.id))) {
    process.stderr.write('Usage: node scripts/article-acceptance-check.js --id <travelId> [--url https://metravel.by] [--json] [--no-images]\n');
    return 2;
  }
  let report;
  try {
    report = await runChecks({ id: args.id, origin: args.origin, images: args.images });
  } catch (error) {
    process.stderr.write(`article-acceptance-check: ${error.message}\n`);
    return 2;
  }
  process.stdout.write(`${args.json ? JSON.stringify(report, null, 2) : formatReport(report)}\n`);
  return report.ok ? 0 : 1;
}

if (require.main === module) main().then((code) => process.exit(code));

module.exports = {
  PEOPLE_IN_CAPTION_RE,
  checkCreatedAt,
  checkGenreHeadings,
  checkPointNames,
  checkQuestLinks,
  dhashFromGray,
  extractImages,
  findDuplicates,
  findPeopleInCaption,
  findPrivateParams,
  formatReport,
  hamming,
  isRawPointName,
  questLinks,
  runChecks,
  textMarkers,
};
