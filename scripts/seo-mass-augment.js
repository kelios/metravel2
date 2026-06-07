#!/usr/bin/env node
/**
 * Mass FAQ + editor-comment augmentation for a single author's published
 * travels on metravel.by.
 *
 * For each article it:
 *   1. Classifies the article by type (vello/usadba/park/gorod/...)
 *   2. Builds a thematic FAQ block (microdata schema.org/FAQPage) with 3-4 Q&A
 *      slotted from the article's country, year, points categories and title.
 *   3. Builds a short editor's comment (prefixed "От редакции metravel:")
 *      that nudges readers to share their own route, ask questions, or
 *      contribute facts — on-topic per classification.
 *
 * Safety:
 *   - Idempotent FAQ: skips articles whose description already contains the
 *     <section data-faq="metravel-seo"> marker.
 *   - Idempotent comments: skips travels that already have a comment from the
 *     editor user (--editor-user-id) starting with the COMMENT_PREFIX marker.
 *   - --dry-run writes nothing — only emits generated HTML and txt under
 *     scripts/.seo-faq/{id}.html and scripts/.seo-comments/{id}.txt so a human
 *     can spot-check before --apply.
 *   - --apply writes both: FAQ via reusing scripts/seo-edit.js composeDescription
 *     + buildUpsertPayload (so backups/regression detection are inherited), and
 *     comments via POST /api/travel-comments/.
 *
 * Usage:
 *   node scripts/seo-mass-augment.js --user-id 1 --dry-run
 *   node scripts/seo-mass-augment.js --user-id 1 --only 384,362,442 --dry-run
 *   node scripts/seo-mass-augment.js --user-id 1 --apply --limit 5
 *   node scripts/seo-mass-augment.js --user-id 1 --apply --faq-only
 *   node scripts/seo-mass-augment.js --user-id 1 --apply --comments-only
 *
 * Tokens:
 *   - Author edits  → METRAVEL_TOKEN env or ~/.metravel_token
 *   - Editor poster → METRAVEL_EDITOR_TOKEN env or ~/.metravel_editor_token
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');

const seoEdit = require('./seo-edit');

const API = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '');
const FAQ_MARKER = 'data-faq="metravel-seo"';
const COMMENT_PREFIX = 'От редакции metravel:';
const OUT_FAQ_DIR = path.join(__dirname, '.seo-faq');
const OUT_COMMENT_DIR = path.join(__dirname, '.seo-comments');
const LOG_PATH = path.join(__dirname, '.seo-mass-augment.log.json');

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const has = (n) => args.includes(`--${n}`);

const USER_ID = getArg('user-id', '1');
const EDITOR_USER_ID = parseInt(getArg('editor-user-id', '120'), 10);
const LIMIT = parseInt(getArg('limit', '0'), 10) || 0;
const ONLY = (getArg('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean).map(Number);
const DRY = has('dry-run');
const APPLY = has('apply');
const FAQ_ONLY = has('faq-only');
const COMMENTS_ONLY = has('comments-only');

if (!DRY && !APPLY) {
  console.error('ERROR: pass --dry-run (preview) or --apply (write)');
  process.exit(1);
}

// --- tokens ---------------------------------------------------------------
function loadToken(envName, fileName) {
  if (process.env[envName]) return process.env[envName].trim();
  const p = path.join(os.homedir(), fileName);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  return null;
}
const AUTHOR_TOKEN = loadToken('METRAVEL_TOKEN', '.metravel_token');
const EDITOR_TOKEN = loadToken('METRAVEL_EDITOR_TOKEN', '.metravel_editor_token');

// --- io --------------------------------------------------------------------
function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const o = { method: 'GET', timeout: 30000, headers: { 'Cache-Control': 'no-cache' }, ...opts };
    if (mod === https) o.rejectUnauthorized = false;
    const req = mod.request(url, o, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(buf ? JSON.parse(buf) : null); } catch { resolve(buf); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} ${url}: ${buf.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${url}`)); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function listAuthorTravels(userId) {
  const where = JSON.stringify({ user_id: userId, publish: 1, moderation: 1 });
  let list = [];
  let page = 1;
  while (true) {
    const u = `${API}/travels/?where=${encodeURIComponent(where)}&page=${page}&perPage=100`;
    const res = await fetchJson(u);
    const items = res.data || res.results || res.items || [];
    list = list.concat(items);
    const total = Number(res.total || res.count || list.length);
    if (list.length >= total || items.length === 0) break;
    page++;
  }
  return list;
}

async function getTravel(id) {
  return fetchJson(`${API}/travels/${id}/?_cb=${Date.now()}-${id}`);
}

async function listCommentsOnTravel(travelId) {
  return fetchJson(`${API}/travel-comments/?travel_id=${travelId}`);
}

async function postComment(travelId, text) {
  return fetchJson(`${API}/travel-comments/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${EDITOR_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: Buffer.from(JSON.stringify({ travel_id: travelId, text }), 'utf8'),
  });
}

async function putTravel(payload) {
  return fetchJson(`${API}/travels/upsert/`, {
    method: 'PUT',
    headers: {
      Authorization: `Token ${AUTHOR_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: Buffer.from(JSON.stringify(payload), 'utf8'),
  });
}

// --- classification --------------------------------------------------------

/**
 * Map an article to one of a small set of types so a topic-appropriate FAQ
 * template can fire. Order matters — more specific patterns win.
 */
function classify(travel) {
  const name = String(travel.name || '');
  const points = (travel.travelAddress || []).map((p) => `${p.address || ''} ${p.categoryName || ''}`.toLowerCase()).join(' ');
  const t = `${name} ${points}`.toLowerCase();

  if (/велом|велосипед|велом[ао]ршрут/i.test(t)) return 'velo';
  if (/морское око|татр|закопан|закопане|долин/i.test(t)) return 'tatry';
  if (/zatorland|energylandia|парк опыт|динозавр|парк свет|парк аттрак|magiczne ogrody|аквапарк/i.test(t)) return 'park-attractions';
  if (/карьер|лазурн|купан|пляж|плавуч|kąpielisko|kapielisko|закшувек|грудек/i.test(t)) return 'quarry-beach';
  if (/морск[ао]я|национальн[ыо][йа]\s*парк|албани|карабурун|саран[уы]|круиз|остров/i.test(t)) return 'sea-tour';
  if (/экотроп|болот|ельн[ия]|национальн[ыо]й парк/i.test(t)) return 'ekotropa';
  if (/озер[ао]|родник|источник|криниц/i.test(t)) return 'lake';
  if (/замок|дворец|усадьб|резиденц|костел|костёл|синагог|храм|монастыр|замчишч/i.test(t)) return 'estate';
  if (/краков|варшав|вроцлав|познан|гданьск|торун|ошмян|гродн|могилев|минск|витебск|брест|город|старый город|стары[йе]/i.test(t)) return 'city-walk';
  if (/маршрут|выходн|на 1 день|на один день|поход/i.test(t)) return 'route-day';

  return 'default';
}

// --- FAQ templates ---------------------------------------------------------

const COUNTRY_PRACTICAL = {
  'Беларусь': {
    visa: 'Внутри Беларуси — никаких визовых вопросов. Гражданам РФ и стран ЕАЭС въезд по внутреннему паспорту, для большинства стран ЕС нужна виза или безвизовый въезд через КПП «Брест/Гродно» по упрощённой схеме — уточняйте у пограничной службы перед поездкой.',
    transport: 'Если без машины — смотрите расписания дизелей и автобусов на rasp.rw.by и mintrans.gov.by. Многие точки маршрута стоят в стороне от трасс, поэтому реалистично объехать всё за день получается на машине или велосипеде.',
    currency: 'Расчёт в белорусских рублях (BYN), в сельской местности часто работают только наличные. Заправки и крупные магазины принимают карты.',
    safety: 'Маршрут проходит по обжитой местности — связь МТС/A1/life:) ловит почти везде. Заранее скачайте офлайн-карты (Maps.me/Organic Maps), особенно если планируете лесные участки.'
  },
  'Польша': {
    visa: 'Для белорусов и россиян нужна шенгенская виза. Польские консульства в Минске/Гродно/Бресте чаще выдают мультивизы C; уточняйте список документов и квоты на visa.gov.pl перед записью.',
    transport: 'Между городами быстрее всего PKP Intercity (intercity.pl) и автобусы FlixBus. Внутри городов — Jakdojade или Google Maps с расписанием. Парковки в исторических центрах платные, ищите по приложению AnyPark/SkyCash.',
    currency: 'Расчёт в злотых (PLN), карта принимается почти везде. В деревнях и фуд-траках держите немного наличных.',
    safety: 'Польша безопасна для туристов; на крупных вокзалах и в центрах городов обычное «не оставляйте сумку без присмотра». Экстренный номер — 112.'
  },
  'Албания': {
    visa: 'Для граждан Беларуси и России — безвиз до 90 дней. На КПП обычно ставят штамп без вопросов. Заграна должен быть действителен ещё минимум 3 месяца после возвращения.',
    transport: 'Внутри страны — фургончики-фургоны (furgon) и старые автобусы; они дешёвые и ходят по расписанию «когда наполнится». Аренда машины — самый удобный способ, но горные дороги требуют опыта.',
    currency: 'Лек (ALL); евро тоже берут в туристических местах, но по невыгодному курсу. Банкоматы есть в крупных городах.',
    safety: 'Албания спокойнее своей репутации, но горные серпантины и местные водители требуют внимания. Связь — Vodafone/One покрывают побережье и крупные трассы.'
  }
};

const FALLBACK_PRACTICAL = {
  visa: 'Перед поездкой проверьте визовые требования для своей страны на официальном сайте посольства — правила меняются.',
  transport: 'Между точками маршрута удобнее всего на машине или с организованной группой. Общественный транспорт работает, но требует пересадок и времени.',
  currency: 'Расчёт в местной валюте; в туристических местах принимают карты, но небольшой запас наличных не помешает.',
  safety: 'Маршрут считается безопасным для самостоятельных путешественников. Скачайте офлайн-карты и сохраните номера экстренных служб.'
};

function getPractical(country) {
  return COUNTRY_PRACTICAL[country] || FALLBACK_PRACTICAL;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function qaBlock(question, answerHtml) {
  return `<details itemprop="mainEntity" itemscope itemtype="https://schema.org/Question">
<summary itemprop="name"><strong>${escapeHtml(question)}</strong></summary>
<div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><div itemprop="text">
${answerHtml}
</div></div>
</details>`;
}

function wrapFaq(title, qaHtmls) {
  return `
<section class="seo-faq" ${FAQ_MARKER} itemscope itemtype="https://schema.org/FAQPage">
<h2>${escapeHtml(title)}</h2>
${qaHtmls.join('\n')}
</section>
`.trim() + '\n';
}

/**
 * Build the FAQ block for the given travel using its classification.
 * Templates lean on generic country+type information rather than per-place
 * facts so the same generator can run across 293 articles without per-article
 * web-research. Per-place specifics are still pulled from the article's own
 * data (name, year, point categories) where available.
 */
function buildFaq(travel, type) {
  const country = travel.countryName || '';
  const year = travel.year ? String(travel.year) : null;
  const pr = getPractical(country);
  const points = (travel.travelAddress || []).map((p) => ({ a: p.address || '', c: p.categoryName || '' }));
  const firstPoint = points[0] && points[0].a.split(',')[0].trim();
  const seasonHint = year ? `Маршрут пройден в ${year} году — основа описания верна, но даты, цены и часы могут меняться, лучше сверять на месте.` : 'Описание построено на личной поездке автора — даты, цены и часы могут меняться, лучше сверять на месте.';

  const qas = [];

  switch (type) {
    case 'velo':
      qas.push(qaBlock(
        'Сколько в реальности занимает этот веломаршрут и кому подойдёт?',
        `<p>Описанный маршрут реалистичен для среднеподготовленного велотуриста: ровный темп, привалы на точках, без гонки. Если едете семьёй или впервые на дальние дистанции — добавьте 30–40% запаса по времени на остановки, перекусы и фото. Дети от 10 лет на хороших дорогах едут без проблем.</p>`
      ));
      qas.push(qaBlock(
        'Что взять с собой на длинный веломаршрут?',
        `<p>Запасную камеру под ваш размер колеса, насос, мультитул, аптечку, воду (1,5–2 л на день), перекус, лёгкий дождевик и фару — летние сумерки приходят быстро. На белорусских грунтовках полезны крылья и более широкие покрышки 35–47C.</p>`
      ));
      qas.push(qaBlock(
        'Как добраться до старта маршрута без машины?',
        `<p>${pr.transport}</p>`
      ));
      qas.push(qaBlock(
        'Где переночевать или продолжить маршрут на 2 дня?',
        `<p>Ищите агроусадьбы рядом с трассой по booking/Airbnb или белорусским сервисам (ruralbelarus.by). На многих веломаршрутах есть смысл закрыть кольцо через ж/д: добраться до конечной станции и вернуться поездом, чтобы не повторять трек.</p>`
      ));
      break;

    case 'tatry':
      qas.push(qaBlock(
        'Когда лучше идти в Татры на этот маршрут?',
        `<p>Снежные участки на верхних тропах держатся до конца мая — июня; устойчивая летняя погода — июль–сентябрь. В мае Морское око часто ещё в снегу и под коркой льда, в октябре уже снова закрывается ранний снег. Перед выходом смотрите прогноз и состояние троп на pogoda.tpn.pl и tpn.pl.</p>`
      ));
      qas.push(qaBlock(
        'Сколько стоит вход в Татранский нацпарк и где брать билеты?',
        `<p>Вход в TPN платный (актуально на 2026 — около 12–15 PLN с человека, льготы для детей и студентов). Билеты — на кассах у входов и онлайн через bilety.tpn.pl. Парковка у входа Palenica Białczańska платная и в сезон забивается уже к 8 утра.</p>`
      ));
      qas.push(qaBlock(
        'Можно ли с детьми и нужно ли горное снаряжение?',
        `<p>До Морского ока ведёт асфальтированная дорога ~9 км в одну сторону — подходит даже для коляски и пожилых людей. Если планируете подъём выше (Чёрный пруд, Рысы) — нужны треккинговые ботинки, лёгкие кошки/палки весной и хороший прогноз. В сезон в Татрах ежегодно бывают НП и спасатели TOPR — не отклоняйтесь от маркированных троп.</p>`
      ));
      break;

    case 'park-attractions':
      qas.push(qaBlock(
        'Когда лучше ехать в этот парк и как избежать очередей?',
        `<p>Будни в первой половине дня — самые свободные. Выходные, праздники и польские школьные каникулы (ferie zimowe в феврале, wakacje в июле-августе) дают пиковую нагрузку: очереди на популярные аттракционы доходят до часа. Билеты онлайн обычно дешевле и снимают очередь в кассу.</p>`
      ));
      qas.push(qaBlock(
        'Сколько стоит вход и что включено в билет?',
        `<p>Цены меняются ежегодно — последние тарифы и список включённых аттракционов смотрите на официальном сайте парка. Один билет, как правило, покрывает все аттракционы внутри; еду и парковку оплачивают отдельно.</p>`
      ));
      qas.push(qaBlock(
        'Подходит ли семьям с маленькими детьми?',
        `<p>В большинстве крупных парков есть детская зона с ограничением по росту (обычно от 90–105 см на динамические аттракционы) и спокойные семейные карусели. Возьмите сменку, перекус и воду — внутри еда дороже. Коляска допускается, но на сами аттракционы её приходится оставлять у входа.</p>`
      ));
      qas.push(qaBlock(
        'Как добраться без машины?',
        `<p>${pr.transport}</p>`
      ));
      break;

    case 'quarry-beach':
      qas.push(qaBlock(
        'Когда здесь купальный сезон и какие часы работы?',
        `<p>Купание со спасателями обычно с конца июня до начала сентября. Часы и точные даты сезона ежегодно публикуют городские службы — перед поездкой сверьте на официальном сайте объекта. Прогулка по территории и обзорные точки доступны круглый год.</p>`
      ));
      qas.push(qaBlock(
        'Сколько стоит вход и нужны ли билеты?',
        `<p>Вход обычно бесплатный, билетов нет, но действует лимит на одновременное нахождение в воде/на понтонах — в жаркие выходные собирается очередь. Самые свободные часы — будни до 11:00. Цены актуальны на 2026 год, уточняйте перед поездкой.</p>`
      ));
      qas.push(qaBlock(
        'Безопасно ли купаться и брать детей?',
        `<p>В обустроенных бассейнах под присмотром спасателей — да. Купание в самих затопленных карьерах вне зон строго запрещено: глубина, холодные слои и затопленная техника каждый сезон становятся причиной трагедий. С детьми держитесь оборудованной зоны и понтонов.</p>`
      ));
      qas.push(qaBlock(
        'Как добраться от центра города?',
        `<p>${pr.transport}</p>`
      ));
      break;

    case 'sea-tour':
      qas.push(qaBlock(
        'Когда лучшее время для морской экскурсии и как выбрать оператора?',
        `<p>Лучший сезон — с июня по сентябрь: вода прогрета, штормы редки. Выбирайте оператора по отзывам последних месяцев и наличию страховки — не первой попавшейся «зазывалкой» на причале. Уточните, входят ли в цену маска/трубка и обед.</p>`
      ));
      qas.push(qaBlock(
        'Что взять на лодочную прогулку?',
        `<p>Крем SPF 50+, головной убор, лёгкую куртку (на скорости и в тени бывает прохладно), воду, таблетки от укачивания, если склонны к нему. Камеру/телефон — в водонепроницаемом чехле, на скорости брызги летят.</p>`
      ));
      qas.push(qaBlock(
        'Какие документы и визы нужны?',
        `<p>${pr.visa}</p>`
      ));
      break;

    case 'ekotropa':
      qas.push(qaBlock(
        'Когда лучше идти на эту экотропу?',
        `<p>Болотные тропы интереснее всего в конце весны и в начале осени: на болотах цветёт пушица или клюква, насекомых меньше, краски — самые сочные. Зимой по гати можно идти, но многие точки маршрута закрываются снегом. Сверяйте прогноз и наличие воды на тропе перед выходом.</p>`
      ));
      qas.push(qaBlock(
        'Что взять с собой и как одеться?',
        `<p>Высокие резиновые сапоги или треккинговые ботинки с гетрами, дождевик, репеллент, перекус и воду. На белорусских болотах летом активны слепни и комары — без репеллента и закрытых рукавов трудно. Бинокль и фотоаппарат с зумом порадуют наблюдением птиц.</p>`
      ));
      qas.push(qaBlock(
        'Подходит ли с детьми и нужен ли проводник?',
        `<p>Большинство обустроенных экотроп безопасны и интересны детям от 6–7 лет, если им посильна дистанция. Дикие участки болот без гати требуют проводника — не уходите с маркированных троп: внешне сухое место может оказаться топью. У белорусских ООПТ обычно есть инспекторы и местные гиды — звоните в администрацию.</p>`
      ));
      break;

    case 'lake':
      qas.push(qaBlock(
        'Можно ли здесь купаться и какая вода?',
        `<p>Большинство лесных озёр пригодны для купания, но дно бывает заболоченным или илистым, а вода — холодной даже в июле из-за родников. Официально оборудованных пляжей со спасателями тут чаще нет, поэтому купание — на свой страх и риск. С детьми лучше выбирать пологий песчаный участок.</p>`
      ));
      qas.push(qaBlock(
        'Как доехать к озеру и где парковаться?',
        `<p>${pr.transport}</p>`
      ));
      qas.push(qaBlock(
        'Можно ли рыбачить и ставить палатку?',
        `<p>В Беларуси базовая любительская рыбалка с удочкой обычно бесплатна на «фонде общего пользования», но платные участки и нерестовый запрет (как правило, апрель — начало июня) надо проверять на mlh.by/rybalka. Палатка — только в обустроенных кемпингах или у разрешённых стоянок. В нацпарках действуют отдельные правила.</p>`
      ));
      break;

    case 'estate':
      qas.push(qaBlock(
        'В каком состоянии усадьба и можно ли войти внутрь?',
        `<p>Многие белорусские и польские усадьбы — частично руинированы или законсервированы. Куда-то пускают (в составе музея, отеля или культурного центра), куда-то — только осмотр снаружи. Если идёте на конкретную точку, заранее посмотрите её страницу в Гугл-картах: там часто свежие фото и текущий статус доступа.</p>`
      ));
      qas.push(qaBlock(
        'Платить ли за вход и в какие часы открыто?',
        `<p>${seasonHint} Музеи на территории усадеб обычно открыты со среды по воскресенье, выходные дни — понедельник и вторник. Билет — символический (обычно 3–10 у.е. в эквиваленте), для детей и студентов часто скидка.</p>`
      ));
      qas.push(qaBlock(
        'Как лучше добираться: машиной или общественным транспортом?',
        `<p>${pr.transport}</p>`
      ));
      qas.push(qaBlock(
        'Что почитать о владельцах усадьбы перед визитом?',
        `<p>Хороший базовый источник — статьи в Википедии и портал radzima.org / globus.tut.by для Беларуси; для Польши — zabytek.pl и сайт NID. Имена владельцев меняли усадьбу несколько раз — после раздела Речи Посполитой, после 1917-го, после Второй мировой, поэтому годы и хозяева в разных источниках расходятся. Авторская статья даёт «человеческую» версию, а Википедия — формальную.</p>`
      ));
      break;

    case 'city-walk':
      qas.push(qaBlock(
        'Сколько времени реально занимает прогулка по этому маршруту?',
        `<p>На вдумчивый осмотр — от 3 до 6 часов в зависимости от заходов в музеи и кофе-паузы. Если идёте впервые в город, не пытайтесь закрыть всё сразу: лучше пройти 60–70% точек, но действительно их прожить.</p>`
      ));
      qas.push(qaBlock(
        'Где удобнее всего поесть и выпить кофе на маршруте?',
        `<p>Историческое кафе или столетняя цукерня в старом городе обычно стоят рядом с самим маршрутом — ищите в Гугл-картах локальные сети с высоким рейтингом, а не туристические «трапы» у главной площади. На обед хорошо работают bary mleczne / молочные бары в Польше и кафе при музеях.</p>`
      ));
      qas.push(qaBlock(
        'Как добраться и где парковаться?',
        `<p>${pr.transport}</p>`
      ));
      qas.push(qaBlock(
        'Подходит ли маршрут с детьми и колясками?',
        `<p>Старые города обычно пешеходные, но брусчатка тяжёлая для колясок — берите коляску с большими колёсами. У большинства музеев есть детская программа или сувенирные «квесты» — это спасает программу с маленькими детьми.</p>`
      ));
      break;

    case 'route-day':
      qas.push(qaBlock(
        'Сколько по времени и километрам реально занимает этот маршрут на один день?',
        `<p>Заложите 8–10 часов «от двери до двери» с учётом дороги, перерывов и одного-двух подробных заходов в точки. Если вы из Минска, реалистично выехать в 8 и вернуться к 19–20.</p>`
      ));
      qas.push(qaBlock(
        'Подойдёт ли маршрут без машины?',
        `<p>${pr.transport}</p>`
      ));
      qas.push(qaBlock(
        'Что взять с собой и в какую обувь?',
        `<p>Удобная обувь, дождевик/тёплый слой, аптечка, термос с чаем, перекус. Многие точки этого маршрута — лесные тропы и грунтовки, поэтому кроссовки удобнее, чем «городские» туфли. На полевые усадьбы возьмите спрей от клещей и осмотрите ноги после.</p>`
      ));
      qas.push(qaBlock(
        'Что есть рядом, чтобы расширить маршрут на 2 дня?',
        `<p>Рядом, как правило, можно найти агроусадьбу или гостевой дом — ищите по rural.by / booking. С ночёвкой получится утром заехать ещё на 1–2 точки, которые в однодневный план не помещаются (это часто более удалённые озёра или замки).</p>`
      ));
      break;

    default:
      qas.push(qaBlock(
        'Когда лучше всего поехать по этому маршруту?',
        `<p>${seasonHint}</p>`
      ));
      qas.push(qaBlock(
        'Как добраться?',
        `<p>${pr.transport}</p>`
      ));
      qas.push(qaBlock(
        'Какие документы и валюта нужны?',
        `<p>${pr.visa} ${pr.currency}</p>`
      ));
      qas.push(qaBlock(
        'Есть ли что-то важное про безопасность?',
        `<p>${pr.safety}</p>`
      ));
  }

  const heading = firstPoint ? `Частые вопросы: ${firstPoint}` : `Частые вопросы по маршруту${country ? ` (${country})` : ''}`;
  return wrapFaq(heading, qas);
}

// --- editor comment templates ----------------------------------------------

function buildComment(travel, type) {
  let body;
  switch (type) {
    case 'velo':
      body = `Маршрут классно ложится в выходной день: реальный темп, без «гонки», точки расставлены с умом. Расскажите, какой у вас был средний километраж в час и что меняли — может, добавляли пункт «K» или закладывали ночёвку? И если есть свежие фото покрытия (асфальт/грунт/гать) — особенно по сезону, добавьте в комментарии, людям это сильно помогает планировать.`;
      break;
    case 'tatry':
      body = `Татры — это всегда история про погоду. Поделитесь, в каком месяце и какие условия вам попадались: снег у Морского ока в мае, дождь в долинах летом, очереди на парковке. Если ходили выше — на Чёрный пруд, Рысы, Гевонт — расскажите, как со временем и силами, это самая частая тема вопросов.`;
      break;
    case 'park-attractions':
      body = `Парки развлечений в Польше очень меняются год к году — то новый аттракцион открыли, то наоборот закрыли. Расскажите, что вам зашло из «новинок», а что разочаровало, и как удавалось обходить очереди (бронь онлайн, утро в будни, обед в дальней зоне). Если ездили с детьми — пиши́те возраст: это спасает других родителей от слишком сложных или, наоборот, слишком детских покупок билетов.`;
      break;
    case 'quarry-beach':
      body = `Карьерные «купальные» места — это всегда баланс между «классно» и «безопасно». Расскажите, в какие часы и дни вам удавалось зайти без давки, и что с водой — холодные ключи, медузы (если у моря), волна. И если совмещали в один день с городом или другой природной точкой — поделитесь, как успели по времени.`;
      break;
    case 'sea-tour':
      body = `Морские экскурсии очень зависят от оператора и погоды — одна группа в восторге, другая в шторм возвращается без половины программы. Поделитесь, какого оператора брали и за сколько, что вошло в цену, и какая была вода/волна. Если у кого-то получалось добраться самостоятельно (без экскурсии) — отдельное спасибо за маршрут.`;
      break;
    case 'ekotropa':
      body = `Болотные экотропы — тема, в которой важна сезонность и обувь. Расскажите, в каком месяце шли, насколько мокро было на гати, какой репеллент работал. Если кому удавалось встретить редких птиц, лосей, тетеревов — обязательно поделитесь, в этих местах люди часто едут именно за наблюдением.`;
      break;
    case 'lake':
      body = `Лесные озёра — это всегда вопрос «купаться или просто смотреть». Расскажите, какая была вода (тёплая, ключевая, илистое дно), удобный ли подъезд, рыбачили ли. И если сами знаете в окрестностях ещё одно-два малоизвестных озера — добавьте в комментарии, такие подсказки самые ценные.`;
      break;
    case 'estate':
      body = `За такими усадьбами всегда тянется длинный шлейф историй — от владельцев до пожаров и реставраций. Если у вас в семье есть связь с этими местами, или встречали редкие краеведческие источники о хозяевах — поделитесь, факты иногда расходятся между Википедией и местными краеведами. Свежие фото внутри (если открыто) тоже бесценны: статус доступа меняется чуть ли не ежегодно.`;
      break;
    case 'city-walk':
      body = `Старые города очень меняются — что год назад было живой кофейней, сегодня уже сувенирка. Расскажите, что вам зашло «по еде и кофе» (не туристические трапы у площади, а живые места), какие музеи стоит закладывать в маршрут, а какие — пропустить. И если ходили с детьми — добавьте, что их зацепило: это часто решает, заходить ли семьёй.`;
      break;
    case 'route-day':
      body = `Расскажите, как маршрут лёг по времени: успели всё или оставили на следующий раз? И если есть советы по точкам — где удалось попасть внутрь, где наоборот закрыто было, где остановились пообедать — добавьте в комменты, такие живые детали стоят больше любой обзорной статьи.`;
      break;
    default:
      body = `Маршрут получился по делу. Поделитесь, в каком сезоне ездили, что добавили бы или убрали, и какие точки рядом, по-вашему, заслуживают отдельной поездки. Свежие фото и контакты местных проводников тоже пригодятся другим путешественникам.`;
  }

  // Soft prefix so the editorial voice reads from the very first word, even
  // though the API renders the comment author byline from auth_user (= "Sergey
  // Savran" until backend renders user_name from Profile instead).
  return `${COMMENT_PREFIX} ${body}`;
}

// --- single-article runner -------------------------------------------------

async function processArticle(listItem, log) {
  const id = listItem.id;
  const detail = await getTravel(id);
  const type = classify(detail);
  const entry = { id, slug: detail.slug, name: detail.name, type };

  // FAQ ---
  if (!COMMENTS_ONLY) {
    const oldDesc = detail.description || '';
    const already = oldDesc.includes(FAQ_MARKER);
    if (already) {
      entry.faq = 'skip-already-present';
    } else {
      // Prefer a pre-generated per-article file (workflow agents drop personal
      // FAQs there). Fall back to the type template only when no file exists.
      const faqFile = path.join(OUT_FAQ_DIR, `${id}.html`);
      let faqHtml;
      let faqSource;
      if (fs.existsSync(faqFile)) {
        faqHtml = fs.readFileSync(faqFile, 'utf8');
        faqSource = 'file';
      } else {
        faqHtml = buildFaq(detail, type);
        faqSource = 'template';
        fs.mkdirSync(OUT_FAQ_DIR, { recursive: true });
        fs.writeFileSync(faqFile, faqHtml, 'utf8');
      }
      // Personalized FAQ files may omit the marker; force-inject if missing so
      // idempotency still works on re-runs.
      if (!faqHtml.includes(FAQ_MARKER)) {
        faqHtml = faqHtml.replace(
          /<section\b/i,
          `<section ${FAQ_MARKER}`
        );
        // If the file has no <section> at all, wrap it.
        if (!faqHtml.includes(FAQ_MARKER)) {
          faqHtml = `<section class="seo-faq" ${FAQ_MARKER}>\n${faqHtml}\n</section>\n`;
        }
        if (faqSource === 'file') fs.writeFileSync(faqFile, faqHtml, 'utf8');
      }
      entry.faqLength = faqHtml.length;
      entry.faqSource = faqSource;
      if (APPLY) {
        const newDesc = seoEdit.composeDescription(oldDesc, { append: faqHtml });
        const payload = seoEdit.buildUpsertPayload(detail, { description: newDesc, meta: detail.meta_description });
        if (!AUTHOR_TOKEN) throw new Error('METRAVEL_TOKEN/~/.metravel_token missing');
        await putTravel(payload);
        // mini-verify
        const after = await getTravel(id);
        const problems = seoEdit.detectRegression(detail, after, { expectChanged: true, newDescription: newDesc });
        if (problems.length) {
          // attempt rollback
          const revert = seoEdit.buildUpsertPayload(detail, { description: oldDesc, meta: detail.meta_description });
          await putTravel(revert).catch(() => {});
          throw new Error(`REGRESSION: ${problems.join('; ')}`);
        }
        entry.faq = 'applied';
      } else {
        entry.faq = 'dry-run-written';
      }
    }
  }

  // Comment ---
  if (!FAQ_ONLY) {
    const existing = await listCommentsOnTravel(id);
    const already = Array.isArray(existing) && existing.some(
      (c) => c.user === EDITOR_USER_ID && typeof c.text === 'string' && c.text.startsWith(COMMENT_PREFIX)
    );
    if (already) {
      entry.comment = 'skip-already-present';
    } else {
      const cmtFile = path.join(OUT_COMMENT_DIR, `${id}.txt`);
      let commentText;
      let cmtSource;
      if (fs.existsSync(cmtFile)) {
        commentText = fs.readFileSync(cmtFile, 'utf8').trim();
        cmtSource = 'file';
      } else {
        commentText = buildComment(detail, type);
        cmtSource = 'template';
        fs.mkdirSync(OUT_COMMENT_DIR, { recursive: true });
        fs.writeFileSync(cmtFile, commentText, 'utf8');
      }
      // Force prefix so the editor signature appears even on personal files.
      if (!commentText.startsWith(COMMENT_PREFIX)) {
        commentText = `${COMMENT_PREFIX} ${commentText}`;
        if (cmtSource === 'file') fs.writeFileSync(cmtFile, commentText, 'utf8');
      }
      entry.commentLength = commentText.length;
      entry.commentSource = cmtSource;
      if (APPLY) {
        if (!EDITOR_TOKEN) throw new Error('METRAVEL_EDITOR_TOKEN/~/.metravel_editor_token missing');
        const posted = await postComment(id, commentText);
        entry.comment = 'posted';
        entry.commentId = posted?.id;
      } else {
        entry.comment = 'dry-run-written';
      }
    }
  }

  log.push(entry);
  const tag = `[${entry.faq || '-'}|${entry.comment || '-'}|${type}]`;
  console.log(`  #${String(id).padEnd(5)} ${tag.padEnd(40)} ${(detail.name || '').slice(0, 60)}`);
  return entry;
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log(`mode=${APPLY ? 'APPLY' : 'DRY-RUN'}${FAQ_ONLY ? ' (faq-only)' : ''}${COMMENTS_ONLY ? ' (comments-only)' : ''}`);
  console.log(`author user_id=${USER_ID}, editor user_id=${EDITOR_USER_ID}`);

  let list = await listAuthorTravels(USER_ID);
  if (ONLY.length) list = list.filter((t) => ONLY.includes(t.id));
  if (LIMIT) list = list.slice(0, LIMIT);
  console.log(`📦 ${list.length} travels to process`);

  const log = [];
  let i = 0;
  for (const t of list) {
    i++;
    try {
      await processArticle(t, log);
    } catch (e) {
      console.error(`  ❌ #${t.id} ${e.message}`);
      log.push({ id: t.id, name: t.name, error: e.message });
    }
    if (APPLY && i % 25 === 0) {
      // gentle pause every 25 mutations
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  fs.writeFileSync(LOG_PATH, JSON.stringify({ runAt: new Date().toISOString(), mode: APPLY ? 'apply' : 'dry-run', log }, null, 2));
  console.log(`\n💾 log → ${path.relative(process.cwd(), LOG_PATH)}`);

  const counts = log.reduce((acc, e) => {
    acc[`faq:${e.faq || 'na'}`] = (acc[`faq:${e.faq || 'na'}`] || 0) + 1;
    acc[`com:${e.comment || 'na'}`] = (acc[`com:${e.comment || 'na'}`] || 0) + 1;
    if (e.error) acc.errors = (acc.errors || 0) + 1;
    return acc;
  }, {});
  console.log('\nSummary:', JSON.stringify(counts, null, 2));
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
