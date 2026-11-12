/* global module */

// Quest URL grammar is shared by locale boot, navigation and serving.
const QUEST_LOCALES = ['ru', 'be', 'uk', 'pl', 'en'];

function parseQuestLocaleRoute(path) {
  if (typeof path !== 'string') return null;
  const pathname = path.split(/[?#]/, 1)[0];
  const match = /^\/(be|uk|pl|en)\/quests\/([1-9]\d*)\/([a-z0-9][a-z0-9_-]{0,159})\/?$/.exec(pathname);
  if (!match) return null;
  const cityId = Number(match[2]);
  if (!Number.isSafeInteger(cityId) || cityId <= 0) return null;
  return { locale: match[1], cityId, questSlug: match[3], path: `/${match[1]}/quests/${cityId}/${match[3]}` };
}

function parseQuestLocaleHubRoute(path) {
  if (typeof path !== 'string') return null;
  const match = /^\/(be|uk|pl|en)\/quests\/?$/.exec(path.split(/[?#]/, 1)[0]);
  return match ? { locale: match[1], path: `/${match[1]}/quests` } : null;
}

function parseQuestUrlLocale(path) {
  return (parseQuestLocaleRoute(path) || parseQuestLocaleHubRoute(path))?.locale ?? null;
}

module.exports = { QUEST_LOCALES, parseQuestLocaleRoute, parseQuestLocaleHubRoute, parseQuestUrlLocale };
