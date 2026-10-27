'use strict';

const { createHash } = require('node:crypto');
const { buildQuestSeoMetadata, buildBrandedSeoTitle, clampMetaDescription } = require('../../utils/questSeo');
const { getQuestIntro, getQuestSteps } = require('../../utils/questStoryText');
const { buildQuestCityAliasMap, buildQuestCityLandingGroups, findNearbyQuestCityGroups, questRouteKey } = require('../../utils/questCityAlias');
const { buildQuestCountryLandingGroups, questCountryLandingIsLinkable, questIsoCountryCode } = require('../../utils/questCountryLanding');
const { buildQuestCityWalkModel } = require('../../utils/questCityWalk');
const { findQuestCityTravelLinks } = require('../../utils/questTravelLinks');
const { buildQuestLocalePath } = require('../../utils/questLocaleRouting');
const { buildQuestRouteDigest, findQuestSpoilerLeaks } = require('./questSpoilerGuard');
const { scoreQuestPageLevel } = require('./questPageDepth');
const { createSsgTranslator, assertCatalogMatchesReceipt } = require('./questLocalePackage');
const { projectQuestDiscoveryRow } = require('../../utils/questDiscovery');
const { selectPopularQuests } = require('../../utils/questPopularity');
const { buildTravelLinkGraphs } = require('../../utils/travelLinkGraph');
const { safePublicImageUrl } = require('../../utils/questPublicPage');

const ORIGIN = 'https://metravel.by';
const LOCALES = ['ru', 'be', 'uk', 'pl', 'en'];
const FALLBACK_IMAGE = ORIGIN + '/og-home.jpg';
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const paragraphList = (text) => String(text || '').split(/\n{2,}/).map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean);
const item = (title, path = null, text = '', facts = '', lang = null) => ({ title: String(title || ''), path, text, facts, lang });
const section = (heading, paragraphs = [], items = []) => ({ heading, paragraphs, items });
function absoluteImage(image) {
  const parsed = new URL(image || FALLBACK_IMAGE, ORIGIN);
  if (!safePublicImageUrl(parsed.href)) throw new Error('Invalid quest cover URL');
  return parsed.href;
}

function formatQuestDuration(duration, ssg) {
  const total = Number(duration) || 0;
  if (total <= 0) return '';
  const hours = Math.floor(total / 60), mins = total % 60;
  if (hours && mins) return ssg.t('seo:utils.questSeo.value1_ch_value2_min_a31b9fed', { value1: hours, value2: mins });
  return ssg.t(hours ? 'seo:utils.questSeo.value1_ch_d6644461' : 'seo:utils.questSeo.value1_min_7c081c0f', { value1: hours || mins });
}

function introModel(quest, bundle, ssg) {
  const steps = getQuestSteps(bundle), intro = getQuestIntro(bundle);
  const city = String(quest.city_name || quest.cityName || bundle.city?.name || '').trim();
  const points = Number(quest.points) || steps.length;
  const duration = formatQuestDuration(quest.duration_min ?? quest.durationMin ?? bundle.duration_min, ssg);
  const start = String(intro?.location || steps[0]?.location || city).trim();
  return { paragraphs: paragraphList(intro?.story), facts: [
    city && ssg.t('seoSsg:questDetail.factCity', { value1: city }),
    points > 0 && ssg.tp('seoSsg:questDetail.factRoute', points),
    duration && ssg.t('seoSsg:questDetail.factDuration', { value1: duration }),
    start && ssg.t('seoSsg:questDetail.factStart', { value1: start }),
  ].filter(Boolean) };
}

function buildDetail(quest, bundle, route, record, locale, city, snapshot, ssg) {
  const translated = locale !== 'ru';
  const heading = String(translated ? bundle.title : quest.title).trim();
  const cityName = translated ? bundle.city?.name || quest.city_name : quest.city_name;
  const seo = buildQuestSeoMetadata({ title: heading, cityName, points: quest.points,
    durationMin: quest.duration_min ?? quest.durationMin,
    ...(translated ? { translate: ssg.t, translatePlural: ssg.tp, locale: ssg.languageTag } : {}) });
  const path = buildQuestLocalePath(Number(route.cityId), route.questId, locale);
  const intro = introModel({ ...quest, city_name: cityName }, bundle, ssg);
  const digest = buildQuestRouteDigest(bundle, (kind, value) => ssg.t(
    kind === 'hours' ? 'quests:app.tabs.quests.city.index.walkOpeningHours' : 'quests:app.tabs.quests.city.index.walkTicket', { value1: value }));
  const sections = [];
  if (digest.length) sections.push(section(ssg.t('seoSsg:questDetail.routeHeading'), [ssg.t('seoSsg:questDetail.routeLead')],
    digest.map((point) => item(point.location ? `${point.title} — ${point.location}` : point.title,
      null, point.sentences.join(' '), point.facts.join(' · ')))));
  if (city) {
    const targetLang = translated ? 'ru' : null;
    const siblings = city.quests.filter((other) => other.quest_id !== quest.quest_id).slice(0, 6).map((other) => {
      const otherRoute = questRouteKey(other);
      const key = `${otherRoute.cityId}/${otherRoute.questId}`;
      const translatedBundle = snapshot.bundles[locale]?.[key];
      const translatedRecord = snapshot.source_snapshot.quests.find((row) => row.city_id === Number(otherRoute.cityId) && row.quest_slug === otherRoute.questId);
      const hasTranslation = translated && translatedRecord?.locales[locale]?.published && translatedRecord.locales[locale].complete && translatedBundle;
      return item(hasTranslation ? translatedBundle.title : other.title,
        hasTranslation ? buildQuestLocalePath(Number(otherRoute.cityId), otherRoute.questId, locale) : otherRoute.path,
        '', '', hasTranslation ? null : targetLang);
    });
    const linkCityName = translated ? bundle.city?.name_localized || city.cityName : city.cityName;
    sections.push(section(ssg.t('seoSsg:questDetail.linksHeading'), [ssg.t('seoSsg:questDetail.linksLead')], [
      item(ssg.t('seoSsg:questDetail.cityQuests', { value1: linkCityName }), `/quests/${city.segment}`, '', '', targetLang), ...siblings,
    ]));
    const nearby = findNearbyQuestCityGroups(city, snapshot.cityGroups, { limit: 4 });
    if (nearby.length) sections.push(section(ssg.t('quests:app.tabs.quests.city.index.nearbyTitle'), [], nearby.map((other) =>
      item(other.cityName || other.segment, `/quests/${other.segment}`, '', ssg.tp('seoSsg:questDetail.nearbyCity', other.quests.length, { value1: Math.round(other.distanceKm) }), targetLang))));
    const travels = findQuestCityTravelLinks({ name: city.cityName, ...city }, snapshot.travel_links, 4);
    if (travels.length) sections.push(section(ssg.t('seoSsg:questDetail.travelsHeading', { value1: linkCityName }),
      [ssg.t('seoSsg:questDetail.travelsLead')], travels.map((travel) => item(travel.title, travel.path, '', '', targetLang))));
    sections.push(section('', [], [item(ssg.t('quests:app.tabs.quests.city.index.back'), '/quests', '', '', targetLang)]));
  }
  const page = { meta: { title: seo.title, description: seo.description, canonical: ORIGIN + path,
    image: absoluteImage(quest.cover_url || quest.coverUrl), tourist_type: ssg.t('seoSsg:questDetail.touristType'), city_name: cityName || '' }, heading,
  kicker: ssg.t('seoSsg:questDetail.kicker'), lead: seo.description, ...intro, sections };
  // A second, independent check inspects final published prose against raw private gameplay.
  const leaks = findQuestSpoilerLeaks(publicPageText(page, true), bundle, digest);
  if (leaks.errors.length) throw new Error(`Quest public projection has spoiler leaks: ${path}`);
  return { kind: 'detail', locale, canonical_path: path, city_id: Number(route.cityId), quest_slug: route.questId,
    country_code: questIsoCountryCode(quest),
    source_revision: record.source_revision, content_revision: record.locales[locale].content_revision, page };
}

function ruPlural(count, one, few, many) {
  const form = new Intl.PluralRules('ru').select(count);
  return form === 'one' ? one : form === 'few' ? few : many;
}

function buildCity(city, bundles, travels, countries, ssg) {
  const name = city.cityName, count = city.quests.length;
  const walk = buildQuestCityWalkModel(city.quests, bundles);
  const path = `/quests/${city.segment}`;
  const sections = [];
  if (walk.places.length) sections.push(section(`Что увидите по дороге: ${name}`, [
    'Точки маршрутов — реальные места города. Ниже — заметки о них из самих квестов: что это за места и чем они интересны. Заданий и ответов здесь нет.',
  ], walk.places.map((place) => item(place.location ? `${place.title} — ${place.location}` : place.title, null,
    place.sentences.join(' '), [place.openingHours && `Часы работы: ${place.openingHours}`, place.ticketPrice && `Билет: ${place.ticketPrice}`].filter(Boolean).join(' · ')))));
  if (walk.routes.length) sections.push(section('Как устроены маршруты', walk.routes.map((route) => {
    const difficulty = { easy: 'лёгкая', medium: 'средняя', hard: 'сложная' }[route.difficulty];
    const duration = formatQuestDuration(route.durationMin, ssg);
    const summary = [route.pointCount > 0 && `${route.pointCount} ${ruPlural(route.pointCount, 'точка', 'точки', 'точек')}`,
      duration && `примерно ${duration}`, difficulty && `сложность — ${difficulty}`].filter(Boolean);
    return [route.title && summary.length && `Квест «${route.title}»: ${summary.join(', ')}.`,
      route.optionalCount > 0 && `По желанию — ${route.optionalCount} ${ruPlural(route.optionalCount, 'точка', 'точки', 'точек')}: их можно пропустить.`,
      route.startLocation && route.finishLocation && `Старт — ${route.startLocation}, финиш — ${route.finishLocation}.`,
      route.museumCount > 0 && `Музеев по дороге: ${route.museumCount} — часы работы лучше проверить заранее.`,
      route.petFriendly && 'Маршрут отмечен как подходящий для прогулки с собакой.'].filter(Boolean).join(' ');
  }).filter(Boolean)));
  sections.push(section(`Квесты города: ${name}`, [], city.quests.map((quest) => item(quest.title, questRouteKey(quest).path))));
  const nearby = findNearbyQuestCityGroups(city, countries.cityGroups, { limit: 4 });
  if (nearby.length) sections.push(section('Квесты в соседних городах', [`${name} уже в плане? Посмотрите другие города с квестами рядом.`], nearby.map((other) =>
    item(other.cityName || other.segment, `/quests/${other.segment}`, '', `${other.quests.length} ${ruPlural(other.quests.length, 'квест', 'квеста', 'квестов')}, ${Math.round(other.distanceKm)} км`))));
  const links = findQuestCityTravelLinks({ name, ...city }, travels, 4);
  if (links.length) sections.push(section(`Путешествия: ${name}`, ['Статьи и готовые маршруты путешественников помогут дополнить прогулку.'], links.map((link) => item(link.title, link.path))));
  const country = countries.groups.find((group) => group.countryCode === city.countryCode && questCountryLandingIsLinkable(group));
  sections.push(section('', [], [
    ...(country ? [item(`Все квесты страны: ${country.countryName}`, `/quests/country/${country.countryAlias}`)] : []),
    item('Все городские квесты', '/quests'),
  ]));
  const coverQuest = city.quests.find((quest) => quest.cover_url || quest.coverUrl);
  const page = { meta: { title: buildBrandedSeoTitle(`Городские квесты: ${name} — прогулки с заданиями`),
    description: clampMetaDescription(`${name}: что посмотреть на прогулке — ${count} ${ruPlural(count, 'квест', 'квеста', 'квестов')} с заданиями по реальным местам. Квесты рядом и маршруты путешественников.`),
    canonical: ORIGIN + path, image: absoluteImage(coverQuest?.cover_url || coverQuest?.coverUrl), tourist_type: '', city_name: name },
  heading: `Городские квесты: ${name}`, kicker: '',
  lead: `${name}: бесплатные пешеходные квесты-прогулки с заданиями и легендами по реальным местам, прямо со смартфона — как самостоятельная экскурсия без гида. Любой маршрут можно распечатать как подарочный квест-бук с картой и дипломом. Выберите маршрут и отправляйтесь гулять пешком.`,
  paragraphs: [], facts: [], sections };
  return { kind: 'city', locale: 'ru', city_id: Number(city.cityId), city_ids: city.cityIds,
    aliases: [...(city.legacyAliases || []), ...(city.legacyCityIds || []).map(String), ...city.cityIds.map(String)],
    canonical_path: path, source_revision: hash(city.quests.map((quest) => quest.quest_id)), content_revision: hash(page), page };
}

function buildCountry(country) {
  const count = country.quests.length, cities = country.cities.length, name = country.countryName;
  const path = `/quests/country/${country.countryAlias}`;
  const questLabel = `${count} ${ruPlural(count, 'квест', 'квеста', 'квестов')}`;
  const coverQuest = country.quests.find((quest) => quest.cover_url || quest.coverUrl);
  const page = { meta: { title: buildBrandedSeoTitle(`Квесты страны: ${name} — города и маршруты`),
    description: clampMetaDescription(`${name}: ${questLabel} в городах страны. Городов с маршрутами: ${cities}. Выберите прогулку с заданиями и откройте её на телефоне.`),
    canonical: ORIGIN + path, image: absoluteImage(coverQuest?.cover_url || coverQuest?.coverUrl), tourist_type: '', city_name: '' },
  heading: `Квесты страны: ${name}`, kicker: '',
  lead: `${name}: на одной странице собраны ${questLabel} с заданиями по реальным местам. Выберите город или маршрут и поделитесь подборкой.`, paragraphs: [], facts: [], sections: [
    section(`Квесты и города: ${name}`, [`На этой странице собраны ${questLabel} в стране ${name}. Маршруты распределены по городам; городов с квестами: ${cities}. Можно сравнить варианты и отправить одну общую ссылку попутчикам.`]),
    section('Города с квестами', ['Откройте страницу города, чтобы увидеть его маршруты и практические советы.'], country.cities.map((city) => item(city.cityName, `/quests/${city.cityAlias}`, '', `${city.questCount} ${ruPlural(city.questCount, 'квест', 'квеста', 'квестов')}`))),
    section('Как выбрать маршрут', [`Сначала выберите город в стране ${name}, затем сравните длительность и число точек. Большинство маршрутов можно проходить без гида в своём темпе.`, 'Перед поездкой проверьте погоду и дорогу до стартовой точки, зарядите телефон и оставьте время на остановки.']),
    section(`Все квесты страны: ${name}`, [], country.quests.map((quest) => item(quest.title, questRouteKey(quest).path, '', quest.city_name || ''))),
    section('', [], [item('Все городские квесты', '/quests')]),
  ] };
  return { kind: 'country', locale: 'ru', country_code: country.countryCode, country_alias: country.countryAlias,
    canonical_path: path, source_revision: hash(country.quests.map((quest) => quest.quest_id)), content_revision: hash(page), page };
}

/** Exactly the visible prose; link labels are excluded by the existing quality contract. */
function publicPageText(page, includeLinks = false) {
  return [page.kicker, page.heading, page.lead, ...page.paragraphs, ...page.facts,
    ...page.sections.flatMap((part) => [part.heading, ...part.paragraphs,
      ...part.items.flatMap((entry) => [includeLinks || !entry.path ? entry.title : '', entry.text, entry.facts])]),
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function scoreCohort(cohort, kind, locale, countries) {
  const scores = scoreQuestPageLevel(cohort.map((entry) => ({ path: entry.canonical_path, kind: `quest-${kind}`, text: publicPageText(entry.page) })));
  scores.forEach((score, index) => { cohort[index].quality = { indexable: score.issues.length === 0,
    word_count: score.words, own_fivegram_ratio: score.ratio === null ? (score.words > 0 ? 1 : 0) : score.ratio }; });
  if (kind === 'country') cohort.forEach((entry) => {
    const country = countries.find((row) => row.countryCode === entry.country_code);
    if (!questCountryLandingIsLinkable(country)) entry.quality.indexable = false;
  });
  // A non-empty detail cohort with zero eligible pages denotes lost public content.
  if (kind !== 'country' && cohort.length && !cohort.some((entry) => entry.quality.indexable)) throw new Error(`No ${locale} ${kind} page clears the public content floors`);
}

/**
 * Emits pages in publication order (details by locale, then RU landings) while
 * only one locale's private bundles are resident: the corpus never is.
 * `source.bundles(locale)` loads that locale on demand; returns the discovery.
 */
function projectQuestWeb(source, catalogs, emit) {
  const snapshot = source.header;
  if (!snapshot || snapshot.schema_version !== 2 || !Array.isArray(snapshot.catalog)
      || !snapshot.source_snapshot || !Array.isArray(snapshot.source_snapshot.quests)
      || snapshot.catalog.length > 500) throw new Error('Invalid private quest publication snapshot');
  const byIdentity = assertCatalogMatchesReceipt(snapshot.catalog, snapshot.source_snapshot, questRouteKey);
  if (byIdentity.size !== snapshot.source_snapshot.quests.length
      || new Set(snapshot.catalog.map((quest) => questRouteKey(quest)?.path)).size !== snapshot.catalog.length) throw new Error('Duplicate quest publication identity');
  const cityGroups = buildQuestCityLandingGroups(snapshot.catalog, buildQuestCityAliasMap(snapshot.catalog));
  const context = { ...snapshot, cityGroups, travel_links: snapshot.travel_links || [] };
  const countries = buildQuestCountryLandingGroups(snapshot.catalog, { locale: 'ru' });
  let landings = [], discovery;
  for (const locale of LOCALES) {
    const localeBundles = source.bundles(locale);
    if (locale === 'ru' && !localeBundles) throw new Error('Invalid private quest publication snapshot');
    const localeContext = { ...context, bundles: { [locale]: localeBundles } };
    const ssg = createSsgTranslator(catalogs, locale);
    const details = [];
    for (const quest of snapshot.catalog) {
      const route = questRouteKey(quest);
      if (!route) throw new Error('Unroutable published quest');
      const key = `${route.cityId}/${route.questId}`, record = byIdentity.get(key);
      if (!record.locales[locale]?.published || !record.locales[locale].complete) continue;
      const bundle = localeBundles?.[key];
      if (!bundle || !Array.isArray(bundle.steps) || typeof bundle.title !== 'string' || !bundle.title.trim()) throw new Error('Missing exact-locale private bundle');
      if (bundle.quest_id != null && bundle.quest_id !== route.questId) throw new Error('Private bundle identity mismatch');
      if (locale !== 'ru' && bundle.content_locale !== locale) throw new Error('Private locale bundle fell back to another language');
      details.push(buildDetail(quest, bundle, route, record, locale, cityGroups.find((group) => group.cityIds.includes(String(route.cityId))), localeContext, ssg));
    }
    scoreCohort(details, 'detail', locale, countries);
    if (locale === 'ru') {
      const bundles = new Map(Object.entries(localeBundles).map(([key, bundle]) => [key.split('/').slice(1).join('/'), bundle]));
      const ru = createSsgTranslator(catalogs, 'ru');
      const cities = cityGroups.map((city) => buildCity(city, bundles, context.travel_links, { groups: countries, cityGroups }, ru));
      const countryPages = countries.map(buildCountry);
      scoreCohort(cities, 'city', 'ru', countries);
      scoreCohort(countryPages, 'country', 'ru', countries);
      landings = [...cities, ...countryPages];
      // A landing's source identity includes its selected quest revisions. Content
      // hashes also include the cohort verdict; a sibling edit can change robots.
      for (const page of landings) {
        const selected = page.kind === 'city'
          ? cityGroups.find((city) => `/quests/${city.segment}` === page.canonical_path).quests
          : countries.find((country) => country.countryCode === page.country_code).quests;
        page.source_revision = hash(selected.map((quest) => {
          const route = questRouteKey(quest);
          return byIdentity.get(`${route.cityId}/${route.questId}`).source_revision;
        }));
        page.content_revision = hash({ page: page.page, quality: page.quality });
      }
      const catalog = snapshot.catalog.map(projectQuestDiscoveryRow);
      if (catalog.some((quest) => !quest)) throw new Error('Invalid public discovery metadata');
      discovery = { catalog, preview: selectPopularQuests(catalog, 8),
        travel_graph: buildTravelLinkGraphs(context.travel_links, snapshot.catalog, localeBundles),
        cities: cityGroups.map((city) => ({ title: city.cityName, path: `/quests/${city.segment}` })),
        countries: countries.filter(questCountryLandingIsLinkable).map((country) => ({ title: country.countryName, path: `/quests/country/${country.countryAlias}` })) };
    }
    details.forEach(emit);
  }
  landings.forEach(emit);
  return discovery;
}

function buildQuestWebProjection(snapshot, catalogs) {
  const pages = [];
  const discovery = projectQuestWeb({ header: snapshot, bundles: (locale) => snapshot.bundles?.[locale] }, catalogs, (page) => pages.push(page));
  return { schema_version: 2, pages, discovery };
}

module.exports = { buildQuestWebProjection, projectQuestWeb, publicPageText, introModel, formatQuestDuration };
