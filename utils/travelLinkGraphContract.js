/* global module, require */

// Client/loader side of the selected travel link graph (#2766): validation only.
// The builder in travelLinkGraph.js needs questStoryText, which stays in its
// own async chunk (#2084), so the route bundle imports this module instead.
const { projectQuestDiscoveryRow } = require('./questDiscovery');
const { safePublicPath } = require('./questPublicPage');

/** Validate and whitelist the small selected graph; never serialize private snapshot fields. */
function validateTravelLinkGraph(raw, travelId) {
  const hash = /^[a-f0-9]{64}$/;
  if (!raw || typeof raw !== 'object' || raw.schema_version !== 2 || raw.state !== 'available'
      || raw.locale !== 'ru' || raw.view !== 'travel' || raw.travel_id !== travelId
      || ![raw.publication_id, raw.corpus_revision, raw.source_revision, raw.content_revision].every((value) => typeof value === 'string' && hash.test(value))
      || !Array.isArray(raw.quests) || raw.quests.length > 6 || !Array.isArray(raw.related) || raw.related.length > 6) return null;
  const quests = raw.quests.map((match) => {
    const quest = projectQuestDiscoveryRow(match?.quest);
    if (!quest || !Number.isFinite(match.score) || match.score < 0
        || (match.distance_km !== null && (!Number.isFinite(match.distance_km) || match.distance_km < 0))) return null;
    return { quest, score: match.score, distance_km: match.distance_km };
  });
  const related = raw.related.map((link) => {
    if (!safePublicPath(link?.path) || !/^\/travels\/[^/]+$/.test(link.path)
        || typeof link.name !== 'string' || !link.name.trim() || link.name.length > 500) return null;
    try {
      const slug = decodeURIComponent(link.path.slice('/travels/'.length));
      if (!slug || slug === '.' || slug === '..' || /[/\\\s]/.test(slug)
          || [...slug].some((character) => character.charCodeAt(0) < 32)) return null;
    } catch { return null; }
    return { path: link.path, name: link.name };
  });
  if (quests.some((match) => !match) || related.some((link) => !link)
      || new Set(quests.map((match) => match.quest.quest_id)).size !== quests.length
      || new Set(related.map((link) => link.path)).size !== related.length) return null;
  return { schema_version: 2, state: 'available', locale: 'ru', view: 'travel', travel_id: travelId,
    publication_id: raw.publication_id, corpus_revision: raw.corpus_revision,
    source_revision: raw.source_revision, content_revision: raw.content_revision, quests, related };
}

module.exports = { validateTravelLinkGraph };
