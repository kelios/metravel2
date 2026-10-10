/* global module */

// Quest-only URL contract #2208. Keep parity with the production registry in tests.
const QUEST_LOCALES = ['ru', 'be', 'uk', 'pl', 'en'];
const QUEST_SLUG = /^[a-z0-9][a-z0-9_-]{0,159}$/;
const QUEST_ORIGIN = 'https://metravel.by';

function buildQuestLocalePath(cityId, questSlug, locale) {
  if (!Number.isSafeInteger(cityId) || cityId <= 0 || !QUEST_SLUG.test(questSlug || '')
    || !QUEST_LOCALES.includes(locale)) return null;
  return `${locale === 'ru' ? '' : `/${locale}`}/quests/${cityId}/${questSlug}`;
}

function parseQuestLocaleRoute(path) {
  if (typeof path !== 'string') return null;
  const pathname = path.split(/[?#]/, 1)[0];
  const match = /^\/(be|uk|pl|en)\/quests\/([1-9]\d*)\/([a-z0-9][a-z0-9_-]{0,159})\/?$/.exec(pathname);
  if (!match) return null;
  const cityId = Number(match[2]);
  if (!Number.isSafeInteger(cityId) || cityId <= 0) return null;
  return { locale: match[1], cityId, questSlug: match[3], path: `/${match[1]}/quests/${cityId}/${match[3]}` };
}

// The pre-bundle head bootstrap uses the same self-contained parser.
function getQuestLocaleRouteParserScript() {
  return `(${parseQuestLocaleRoute.toString()})`;
}

/** Validate identity and every navigable path; never infer membership from gameplay. */
function validateQuestServingProjection(raw, expected) {
  if (!raw || typeof raw !== 'object' || raw.schema_version !== 1) return null;
  const { cityId, questSlug, locale } = expected;
  const canonical = buildQuestLocalePath(cityId, questSlug, locale);
  if (!canonical || raw.city_id !== cityId || raw.quest_slug !== questSlug || raw.locale !== locale) return null;
  if (!['available', 'unavailable', 'temporary_failure'].includes(raw.state)) return null;
  const release = raw.release_id;
  if (release !== null && (typeof release !== 'string' || !release || release.length > 256)) return null;
  const ruPath = buildQuestLocalePath(cityId, questSlug, 'ru');
  if (raw.ru_source_path !== null && raw.ru_source_path !== ruPath) return null;
  if (!Array.isArray(raw.versions) || raw.versions.length > QUEST_LOCALES.length) return null;
  const versions = [];
  for (const version of raw.versions) {
    if (!version || !QUEST_LOCALES.includes(version.locale)
      || version.path !== buildQuestLocalePath(cityId, questSlug, version.locale)
      || versions.some((item) => item.locale === version.locale)) return null;
    versions.push({ locale: version.locale, path: version.path });
  }
  if (versions.some((version, index) => index > 0
    && QUEST_LOCALES.indexOf(versions[index - 1].locale) > QUEST_LOCALES.indexOf(version.locale))) return null;
  if (raw.state === 'available') {
    if (!release || raw.canonical_path !== canonical || raw.ru_source_path !== ruPath) return null;
    if (locale !== 'ru' && !versions.some((version) => version.locale === locale)) return null;
    if (versions.length && (versions.length < 2 || versions[0].locale !== 'ru')) return null;
  } else if (raw.canonical_path !== null || versions.length) return null;
  return {
    schema_version: 1, release_id: release, city_id: cityId, quest_slug: questSlug, locale,
    state: raw.state, canonical_path: raw.canonical_path, ru_source_path: raw.ru_source_path, versions,
  };
}

function questServingAlternates(projection) {
  if (projection?.state !== 'available' || projection.versions.length < 2) return [];
  return [
    ...projection.versions.map((version) => ({ locale: version.locale, href: QUEST_ORIGIN + version.path })),
    { locale: 'x-default', href: QUEST_ORIGIN + projection.ru_source_path },
  ];
}

module.exports = { QUEST_LOCALES, buildQuestLocalePath, parseQuestLocaleRoute, getQuestLocaleRouteParserScript,
  validateQuestServingProjection, questServingAlternates };
