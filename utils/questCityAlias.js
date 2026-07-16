/* global module */

// Shared quest city-alias logic used by both the SSG scripts (generate-seo-pages,
// generate-sitemap) and the app city-landing route, so the alias contract stays
// identical on the server and the client. The alias of a city is the most
// frequent leading token of its quests' quest_id (e.g. "minsk" for city_id 4).

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
      return aliasA < aliasB ? -1 : aliasA > aliasB ? 1 : 0;
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

/**
 * Resolve a `/quests/<segment>` URL segment (numeric city_id OR alias like
 * "minsk") to the canonical numeric city id and its alias. Returns null when the
 * segment matches no city with quests.
 */
function resolveQuestCitySegment(cityParam, quests) {
  const raw = String(cityParam ?? '').trim().toLowerCase();
  if (!raw) return null;

  const aliasMap = buildQuestCityAliasMap(quests);

  for (const quest of Array.isArray(quests) ? quests : []) {
    const route = questRouteKey(quest);
    if (route && route.cityId.toLowerCase() === raw) {
      return { cityId: route.cityId, alias: aliasMap.get(route.cityId) || null };
    }
  }

  for (const [cityId, alias] of aliasMap) {
    if (alias === raw) return { cityId, alias };
  }

  return null;
}

module.exports = {
  questRouteKey,
  buildQuestCityAliasMap,
  questRouteVariants,
  resolveQuestCitySegment,
};
