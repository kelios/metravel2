/* global module */

// Shared quest city-alias logic used by both the SSG scripts (generate-seo-pages,
// generate-sitemap) and the app city-landing route, so the alias contract stays
// identical on the server and the client. The alias of a city is the leading
// token run of its quests' quest_id (e.g. "minsk" for city_id 4).

// `quest_id` is `<город>-<тема квеста>`, and both halves may carry hyphens, so
// the boundary is not in the string itself. `city_name` holds it: an alias is a
// latin spelling of the city's own name, so the word count of the name bounds
// how many tokens belong to the alias, and the latin length of the candidate
// has to track the name's letter count (#1931). That length band — read first
// on the lead token against the first word, then on the whole candidate against
// the whole name — is what tells «Кутна-Гора» -> `kutna-hora` apart from
// «Санкт-Петербург» -> `spb` (an abbreviation, not a spelling) and «Голубая
// криница» -> `slavgorod` (quest_id named after the nearest town, not after the
// record).
const CITY_ALIAS_MIN_LENGTH_RATIO = 0.9;
const CITY_ALIAS_MAX_LENGTH_RATIO = 1.5;

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

/** Leading `[a-z0-9]` tokens of a quest_id, stopping at the first odd segment. */
function questIdTokens(questId) {
  const tokens = [];
  for (const part of String(questId ?? '').toLowerCase().split('-')) {
    if (!/^[a-z0-9]+$/.test(part)) break;
    tokens.push(part);
  }
  return tokens;
}

/**
 * Words of the city's own name, or `[]` when the record is not a plain city.
 *
 * A parenthetical region qualifier («Голубая криница (Славгородский район)»)
 * marks a natural landmark, and such records are named in `quest_id` after the
 * nearest town («slavgorod-blue-krinica»), not after themselves — so their name
 * must not decide how many quest_id tokens belong to the alias.
 */
function cityNameWords(cityName) {
  const raw = String(cityName ?? '').trim();
  if (!raw || raw.includes('(')) return [];
  return raw.split(/[\s.\-\u2013\u2014_/,]+/).filter(Boolean);
}

/** How many leading tokens every quest of the city shares, up to `limit`. */
function commonTokenPrefixLength(tokenLists, limit) {
  let length = 0;
  while (
    length < limit &&
    tokenLists.every((tokens) => tokens[length] === tokenLists[0][length])
  ) {
    length += 1;
  }
  return length;
}

/**
 * The full alias of one city: the winning leading token, extended over the
 * remaining words of `city_name` when the quest_id actually spells them out.
 * Falls back to the single token whenever the catalog does not corroborate the
 * longer form, so a one-word city can never regress.
 */
function resolveCityAlias(leadToken, tokenLists, cityName) {
  const nameWords = cityNameWords(cityName);
  if (nameWords.length < 2 || !tokenLists.length) return leadToken;

  // An abbreviation stands in for the name instead of spelling it («spb» for
  // «Санкт-Петербург»), so everything after it is quest theme. Only a lead
  // token that already spells the first word may grow over the rest: without
  // this anchor a single quest `spb-dostoevsky-secrets` fits the whole-name
  // band (13 letters against 14) and would publish the city as
  // /quests/spb-dostoevsky.
  if (leadToken.length < nameWords[0].length * CITY_ALIAS_MIN_LENGTH_RATIO) return leadToken;

  // quest_id is `<city>-<theme>`: the alias never swallows a whole quest_id,
  // otherwise /quests/<alias> would repeat the quest slug itself.
  const limit = Math.min(nameWords.length, ...tokenLists.map((tokens) => tokens.length - 1));
  if (limit < 2) return leadToken;

  const prefixLength = commonTokenPrefixLength(tokenLists, limit);
  if (prefixLength < 2) return leadToken;

  const candidate = tokenLists[0].slice(0, prefixLength);
  const ratio = candidate.join('').length / nameWords.join('').length;
  if (ratio < CITY_ALIAS_MIN_LENGTH_RATIO || ratio > CITY_ALIAS_MAX_LENGTH_RATIO) return leadToken;
  return candidate.join('-');
}

/**
 * Alias the previous single-token rule published for this city (#1931).
 *
 * `/quests/cesky` is already indexed, so it stays a resolvable duplicate of the
 * canonical `/quests/cesky-krumlov` instead of turning into a 404 — exactly how
 * the numeric `city_id` segment behaves.
 */
function questCityLegacyAlias(alias) {
  const value = String(alias ?? '').trim().toLowerCase();
  const separator = value.indexOf('-');
  return separator > 0 ? value.slice(0, separator) : null;
}

function buildQuestCityAliasMap(quests) {
  const cities = new Map();

  for (const quest of Array.isArray(quests) ? quests : []) {
    const route = questRouteKey(quest);
    if (!route) continue;

    const tokens = questIdTokens(route.questId);
    const leadToken = tokens[0];
    if (!leadToken || leadToken === route.cityId.toLowerCase()) continue;

    const city = cities.get(route.cityId) || { counts: new Map(), tokensByLead: new Map(), name: '' };
    city.counts.set(leadToken, (city.counts.get(leadToken) || 0) + 1);
    const byLead = city.tokensByLead.get(leadToken) || [];
    byLead.push(tokens);
    city.tokensByLead.set(leadToken, byLead);
    if (!city.name) city.name = questCityName(quest);
    cities.set(route.cityId, city);
  }

  const aliases = new Map();
  for (const [cityId, city] of cities) {
    const winner = [...city.counts.entries()].sort(([aliasA, countA], [aliasB, countB]) => {
      if (countA !== countB) return countB - countA;
      return stableTextCompare(aliasA, aliasB);
    })[0]?.[0];
    if (!winner) continue;
    aliases.set(cityId, resolveCityAlias(winner, city.tokensByLead.get(winner) || [], city.name));
  }

  return aliases;
}

function questRouteVariants(quest, cityAliasMap) {
  const primary = questRouteKey(quest);
  if (!primary) return [];

  const citySegments = [primary.cityId];
  const alias = cityAliasMap?.get(primary.cityId);
  if (alias && alias !== primary.cityId) citySegments.push(alias);
  const legacyAlias = questCityLegacyAlias(alias);
  if (legacyAlias && !citySegments.includes(legacyAlias)) citySegments.push(legacyAlias);

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
      legacyAliases: [],
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

  const groups = [...bySegment.values()].sort((a, b) => {
    return stableTextCompare(a.cityName, b.cityName) || stableTextCompare(a.segment, b.segment);
  });

  // The short alias a city used to publish stays addressable, but never at the
  // cost of shadowing a segment another city already owns.
  const takenSegments = new Set(groups.flatMap((group) => [group.segment, ...group.cityIds]));
  for (const group of groups) {
    const legacyAlias = questCityLegacyAlias(group.alias);
    if (!legacyAlias || takenSegments.has(legacyAlias)) continue;
    group.legacyAliases.push(legacyAlias);
    takenSegments.add(legacyAlias);
  }

  return groups;
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
      candidate.cityIds.some((cityId) => cityId.toLowerCase() === raw) ||
      candidate.legacyAliases.includes(raw),
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
  questCityLegacyAlias,
  questRouteVariants,
  resolveQuestCitySegment,
};
