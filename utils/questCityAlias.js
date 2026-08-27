/* global module */

// Shared quest city-alias logic used by both the SSG scripts (generate-seo-pages,
// generate-sitemap) and the app city-landing route, so the alias contract stays
// identical on the server and the client. The alias of a city is the most
// frequent leading token of its quests' quest_id (e.g. "minsk" for city_id 4).

function stableTextCompare(a, b) {
  const left = String(a ?? '').trim().toLowerCase();
  const right = String(b ?? '').trim().toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
}

function questRouteKey(quest) {
  const questId = String(quest?.quest_id ?? quest?.id ?? '').trim();
  const cityId = String(quest?.city_id ?? quest?.cityId ?? '').trim();
  if (!questId || !cityId) return null;
  return { cityId, questId, path: `/quests/${cityId}/${questId}` };
}

function buildQuestCityAliasMap(quests) {
  const countsByCity = new Map();

  for (const quest of Array.isArray(quests) ? quests : []) {
    const route = questRouteKey(quest);
    if (!route) continue;

    const alias = route.questId.match(/^([a-z0-9]+)(?:-|$)/i)?.[1]?.toLowerCase();
    if (!alias || alias === route.cityId.toLowerCase()) continue;

    const counts = countsByCity.get(route.cityId) || new Map();
    counts.set(alias, (counts.get(alias) || 0) + 1);
    countsByCity.set(route.cityId, counts);
  }

  const aliases = new Map();
  for (const [cityId, counts] of countsByCity) {
    const winner = [...counts.entries()].sort(([aliasA, countA], [aliasB, countB]) => {
      if (countA !== countB) return countB - countA;
      return stableTextCompare(aliasA, aliasB);
    })[0]?.[0];
    if (winner) aliases.set(cityId, winner);
  }

  return aliases;
}

function questRouteVariants(quest, cityAliasMap) {
  const primary = questRouteKey(quest);
  if (!primary) return [];

  const citySegments = [primary.cityId];
  const alias = cityAliasMap?.get(primary.cityId);
  if (alias && alias !== primary.cityId) citySegments.push(alias);

  return citySegments.map((cityId) => ({
    cityId,
    questId: primary.questId,
    path: `/quests/${cityId}/${primary.questId}`,
  }));
}

function questCityName(quest) {
  return String(quest?.city_name ?? quest?.cityName ?? quest?.city?.name ?? '').trim();
}

function questCountryName(quest) {
  return String(quest?.country_name ?? quest?.countryName ?? quest?.city?.country_name ?? '').trim();
}

function questCountryCode(quest) {
  return String(quest?.country_code ?? quest?.countryCode ?? quest?.city?.country_code ?? '')
    .trim()
    .toLowerCase();
}

function questCoordinate(quest, key) {
  const value = Number(
    key === 'lat'
      ? quest?.lat ?? quest?.latitude ?? quest?.city?.lat
      : quest?.lng ?? quest?.lon ?? quest?.longitude ?? quest?.city?.lng ?? quest?.city?.lon,
  );
  return Number.isFinite(value) ? value : null;
}

/**
 * Logical city landings implied by the live quest catalog.
 *
 * Several backend city_id values can describe one city. The public alias is
 * the canonical city identity, so such records must hydrate and prerender as
 * one landing. No city allowlist lives here: a newly published one-quest city
 * automatically becomes a group on the next catalog fetch/build.
 */
function buildQuestCityLandingGroups(quests, cityAliasMap) {
  const list = Array.isArray(quests) ? quests : [];
  const aliasMap = cityAliasMap || buildQuestCityAliasMap(list);
  const bySegment = new Map();
  const questPathsBySegment = new Map();

  for (const quest of list) {
    const route = questRouteKey(quest);
    if (!route) continue;

    const alias = aliasMap.get(route.cityId) || null;
    const segment = alias || route.cityId;
    const group = bySegment.get(segment) || {
      segment,
      alias,
      cityId: route.cityId,
      cityIds: [],
      cityName: '',
      countryName: '',
      countryCode: '',
      lat: null,
      lng: null,
      quests: [],
    };

    if (!group.cityIds.includes(route.cityId)) group.cityIds.push(route.cityId);
    if (!group.cityName) group.cityName = questCityName(quest);
    if (!group.countryName) group.countryName = questCountryName(quest);
    if (!group.countryCode) group.countryCode = questCountryCode(quest);

    const lat = questCoordinate(quest, 'lat');
    const lng = questCoordinate(quest, 'lng');
    // A city centre must come from one real coordinate pair. Combining a lat
    // from one incomplete record with a lng from another invents a location
    // and corrupts the nearby-city section.
    if (group.lat === null && group.lng === null && lat !== null && lng !== null) {
      group.lat = lat;
      group.lng = lng;
    }
    const questPaths = questPathsBySegment.get(segment) || new Set();
    if (!questPaths.has(route.path)) {
      group.quests.push(quest);
      questPaths.add(route.path);
      questPathsBySegment.set(segment, questPaths);
    }
    bySegment.set(segment, group);
  }

  return [...bySegment.values()].sort((a, b) => {
    return stableTextCompare(a.cityName, b.cityName) || stableTextCompare(a.segment, b.segment);
  });
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nearby quest cities for the independent city-landing cross-link section. */
function findNearbyQuestCityGroups(current, groups, options) {
  if (!current || !Number.isFinite(current.lat) || !Number.isFinite(current.lng)) return [];
  const requestedLimit = Number(options?.limit);
  const requestedMaxDistanceKm = Number(options?.maxDistanceKm);
  const limit = Number.isFinite(requestedLimit) ? Math.max(0, requestedLimit) : 4;
  const maxDistanceKm = Number.isFinite(requestedMaxDistanceKm)
    ? Math.max(0, requestedMaxDistanceKm)
    : 400;

  return (Array.isArray(groups) ? groups : [])
    .filter(
      (candidate) =>
        candidate &&
        candidate.segment !== current.segment &&
        Number.isFinite(candidate.lat) &&
        Number.isFinite(candidate.lng),
    )
    .map((candidate) => ({
      ...candidate,
      distanceKm: haversineKm(current.lat, current.lng, candidate.lat, candidate.lng),
    }))
    .filter((candidate) => candidate.distanceKm <= maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || stableTextCompare(a.segment, b.segment))
    .slice(0, limit);
}

/**
 * Resolve a `/quests/<segment>` URL segment (numeric city_id OR alias like
 * "minsk") to the canonical numeric city id and its alias. Returns null when the
 * segment matches no city with quests.
 */
function resolveQuestCitySegment(cityParam, quests) {
  const raw = String(cityParam ?? '').trim().toLowerCase();
  if (!raw) return null;

  const aliasMap = buildQuestCityAliasMap(quests);
  const groups = buildQuestCityLandingGroups(quests, aliasMap);
  const group = groups.find(
    (candidate) =>
      candidate.segment.toLowerCase() === raw ||
      candidate.cityIds.some((cityId) => cityId.toLowerCase() === raw),
  );
  if (!group) return null;
  return {
    cityId: group.cityId,
    cityIds: group.cityIds.slice(),
    alias: group.alias,
    segment: group.segment,
  };
}

module.exports = {
  stableTextCompare,
  questRouteKey,
  buildQuestCityAliasMap,
  buildQuestCityLandingGroups,
  findNearbyQuestCityGroups,
  questRouteVariants,
  resolveQuestCitySegment,
};
