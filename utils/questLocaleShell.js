/* global module, require */

// Navigation/HTML helpers stay outside the pre-hydration parser leaf.
const { QUEST_LOCALES, parseQuestLocaleRoute, parseQuestLocaleHubRoute } = require('./questLocalePath');

function buildQuestLocaleHubPath(locale) {
  if (!QUEST_LOCALES.includes(locale)) return null;
  return locale === 'ru' ? '/quests' : `/${locale}/quests`;
}

function getQuestLocaleRouteParserScript() {
  return `(function(path){var detail=(${parseQuestLocaleRoute.toString()})(path);if(detail)return detail;`
    + `return (${parseQuestLocaleHubRoute.toString()})(path);})`;
}

module.exports = { buildQuestLocaleHubPath, getQuestLocaleRouteParserScript };
