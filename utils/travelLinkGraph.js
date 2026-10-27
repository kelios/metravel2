/* global module, require */

const { questRouteKey } = require('./questCityAlias');
const { getQuestSteps } = require('./questStoryText');
const { projectQuestDiscoveryRow } = require('./questDiscovery');
const { normalizeLocationText, extractTravelCoordsForQuestPromo, minDistanceKm } = require('./questTravelLinks');

function buildQuestPromoMeta(quest, bundle) {
  const route = questRouteKey(quest) || questRouteKey({ quest_id: bundle?.quest_id || bundle?.id, city_id: bundle?.city?.id });
  if (!route) return null;
  const city = bundle?.city || quest?.city || {};
  return {
    ...quest, route,
    title: String(quest?.title || bundle?.title || 'Городской квест').trim(),
    cityName: String(quest?.city_name || quest?.cityName || city.name || '').trim(),
    countryName: String(quest?.country_name || quest?.countryName || city.country_name || city.countryName || '').trim(),
    countryCode: String(city.country_code || city.countryCode || quest?.country_code || quest?.countryCode || '').trim().toLowerCase(),
    lat: Number(city.lat ?? quest?.lat ?? quest?.latitude),
    lng: Number(city.lng ?? city.lon ?? city.longitude ?? quest?.lng ?? quest?.lon ?? quest?.longitude),
    points: Number(quest?.points) || getQuestSteps(bundle).length || 0,
    durationMin: Number(quest?.duration_min ?? quest?.durationMin ?? bundle?.duration_min) || 0,
    cover: String(quest?.cover_url || quest?.coverUrl || bundle?.cover_url || bundle?.coverUrl || '').trim(),
  };
}

function buildQuestPromoCatalog(quests, questBundleMap) {
  return (Array.isArray(quests) ? quests : []).map((quest) => {
    const route = questRouteKey(quest);
    return buildQuestPromoMeta(quest, route ? questBundleMap.get(route.questId) : null);
  }).filter(Boolean);
}

/** Published SSG ordering, shared with the independent data generation. */
function findTravelQuestPromoMatches(travel, questCatalog, limit = 6) {
  if (!Array.isArray(questCatalog) || !questCatalog.length) return [];
  const coords = extractTravelCoordsForQuestPromo(travel);
  const qCity = normalizeLocationText(travel?.cityName || travel?.city_name || travel?.city?.name);
  const qCountry = normalizeLocationText(travel?.countryName || travel?.country_name);
  const qCode = String(travel?.countryCode || travel?.country_code || '').toLowerCase().trim();
  const matches = [];
  for (const quest of questCatalog) {
    const cCity = normalizeLocationText(quest.cityName);
    const cCountry = normalizeLocationText(quest.countryName);
    const cCode = String(quest.countryCode || '').toLowerCase().trim();
    if (qCode && cCode && qCode !== cCode) continue;
    if ((!qCode || !cCode) && qCountry && cCountry && qCountry !== cCountry
        && minDistanceKm(coords, quest.lat, quest.lng) >= 15) continue;
    let score = 0;
    if (qCity && cCity) {
      if (qCity === cCity) score += 100;
      else if (cCity.includes(qCity) || qCity.includes(cCity)) score += 55;
    }
    const distanceKm = minDistanceKm(coords, quest.lat, quest.lng);
    if (distanceKm < 8) score += 60;
    else if (distanceKm < 20) score += 40;
    else if (distanceKm < 50) score += 40;
    if ((qCountry && cCountry && qCountry === cCountry) || (qCode && cCode && qCode === cCode)) score += 15;
    if (score >= 55) matches.push({ quest, score, distanceKm });
  }
  return matches.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm).slice(0, Math.max(1, limit));
}

function travelPublicPath(travel) {
  const key = (travel && (travel.slug || (travel.id != null ? String(travel.id) : ''))) || '';
  return key ? `/travels/${key}` : '';
}

/** A multi-country travel groups by its set of countries: the joined name's order is unspecified upstream (#2820). */
function relatedCountryKey(travel) {
  const names = String(travel?.countryName || '').split(',').map((name) => name.trim()).filter(Boolean);
  return [...new Set(names)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(', ');
}

function buildRelatedIndex(travels) {
  const byCountry = new Map(), all = [];
  for (const travel of travels) {
    const path = travelPublicPath(travel), name = String(travel.name || '').trim();
    if (!path || !name) continue;
    const country = relatedCountryKey(travel), entry = { path, name, country };
    all.push(entry);
    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country).push(entry);
  }
  return { byCountry, all };
}

function pickRelatedTravels(travel, index, limit = 6) {
  const selfPath = travelPublicPath(travel), country = relatedCountryKey(travel);
  const seen = new Set([selfPath]), out = [];
  const add = (entry) => {
    if (out.length >= limit || !entry || seen.has(entry.path)) return;
    seen.add(entry.path);
    out.push({ path: entry.path, name: entry.name });
  };
  const offset = Math.abs(Number(travel?.id) || selfPath.length);
  if (country && index.byCountry.has(country)) {
    const items = index.byCountry.get(country), start = items.length ? offset % items.length : 0;
    for (let i = 0; i < items.length && out.length < limit; i++) add(items[(start + i) % items.length]);
  }
  if (index.all.length) {
    const start = offset % index.all.length;
    for (let i = 0; i < index.all.length && out.length < limit; i++) add(index.all[(start + i) % index.all.length]);
  }
  return out;
}

/** Only selected public metadata is stored in a travel page's loader payload. */
function buildTravelLinkGraphs(travels, quests, ruBundles) {
  const bundles = new Map(Object.values(ruBundles).map((bundle) => [String(bundle.quest_id || bundle.id), bundle]));
  const catalog = buildQuestPromoCatalog(quests, bundles), related = buildRelatedIndex(travels);
  const publicQuests = new Map(quests.map((quest) => [quest.id, projectQuestDiscoveryRow(quest)]));
  const graph = {};
  for (const travel of travels) {
    if (!Number.isSafeInteger(travel.id) || travel.id <= 0) throw new Error('Invalid travel discovery identity');
    graph[String(travel.id)] = {
      quests: findTravelQuestPromoMatches(travel, catalog, 6).map((match) => {
        const quest = publicQuests.get(match.quest.id);
        if (!quest) throw new Error('Invalid public quest discovery metadata');
        return { quest, score: match.score, distance_km: Number.isFinite(match.distanceKm) ? match.distanceKm : null };
      }),
      related: pickRelatedTravels(travel, related, 6),
    };
  }
  return graph;
}

module.exports = { buildQuestPromoMeta, buildQuestPromoCatalog, findTravelQuestPromoMatches, buildRelatedIndex, pickRelatedTravels, buildTravelLinkGraphs };
