/* global module, require */
const { safePublicPath } = require('./questPublicPage');

const HASH = /^[a-f0-9]{64}$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,159}$/;
const VIEWS = ['home', 'catalog', 'scenario'];
const nullableText = (value, limit = 500) => value == null ? null : typeof value === 'string' && value.length <= limit ? value : undefined;
const count = (value) => Number.isSafeInteger(Number(value ?? 0)) && Number(value ?? 0) >= 0 ? Number(value ?? 0) : null;

/** One whitelist for a private-snapshot build and a public-response loader. */
function projectQuestDiscoveryRow(raw) {
  if (!raw || typeof raw !== 'object' || !Number.isSafeInteger(raw.id) || raw.id <= 0
      || !SLUG.test(raw.quest_id || '') || !/^[1-9]\d*$/.test(String(raw.city_id || ''))
      || !Number.isSafeInteger(Number(raw.city_id)) || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 500
      || typeof raw.city_name !== 'string' || raw.city_name.length > 500) return null;
  const fields = {};
  for (const key of ['city_name_canonical', 'city_name_localized', 'country_id', 'country_name']) {
    const value = nullableText(raw[key]);
    if (value === undefined) return null;
    fields[key] = value;
  }
  const countryCode = nullableText(raw.country_code, 2);
  if (countryCode && !/^[A-Z]{2}$/i.test(countryCode)) return null;
  const alias = raw.city_alias == null ? undefined : raw.city_alias;
  if (alias != null && (typeof alias !== 'string' || alias.length > 160 || (alias && !SLUG.test(alias)))) return null;
  const legacy = raw.city_legacy_ids ?? [];
  if (!Array.isArray(legacy) || legacy.length > 50 || legacy.some((id) => !Number.isSafeInteger(id) || id <= 0)) return null;
  const lat = Number(raw.lat), lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const points = count(raw.points), duration = count(raw.duration_min);
  if (points === null || duration === null) return null;
  const stats = {};
  for (const key of ['rating_count', 'completions_count', 'views_count']) {
    stats[key] = count(raw[key]);
    if (stats[key] === null) return null;
  }
  const rating = raw.rating_avg == null ? null : Number(raw.rating_avg);
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) return null;
  const cover = nullableText(raw.cover_url, 4096);
  if (cover) {
    try {
      const url = new URL(cover, 'https://metravel.by');
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    } catch { return null; }
  } else if (cover === undefined) return null;
  const rawTags = raw.tags ?? {};
  if (!rawTags || typeof rawTags !== 'object' || Array.isArray(rawTags) || Object.keys(rawTags).length > 50) return null;
  const tagNames = Object.keys(rawTags);
  if (tagNames.some((key) => !/^[a-z0-9_-]{1,80}$/.test(key))) return null;
  const locales = raw.available_locales ?? ['ru'];
  if (!Array.isArray(locales) || locales.length > 5 || locales.some((locale) => !['ru', 'be', 'uk', 'pl', 'en'].includes(locale))) return null;
  return { id: raw.id, quest_id: raw.quest_id, title: raw.title, city_id: String(raw.city_id), city_name: raw.city_name,
    ...fields, city_alias: alias, city_legacy_ids: [...legacy], country_code: countryCode,
    lat, lng, points, duration_min: raw.duration_min == null ? null : duration,
    difficulty: ['easy', 'medium', 'hard', ''].includes(raw.difficulty) ? raw.difficulty : null,
    tags: Object.fromEntries(tagNames.map((key) => [key, Boolean(rawTags[key])])), pet_friendly: raw.pet_friendly === true,
    cover_url: cover, content_locale: 'ru', available_locales: [...locales], ...stats, rating_avg: rating,
    personal_status_unavailable: true, user_rating: null, is_completed_by_me: false, first_completer: null };
}

function validateQuestDiscovery(raw, view) {
  if (!raw || typeof raw !== 'object' || raw.schema_version !== 2 || raw.state !== 'available'
      || raw.locale !== 'ru' || raw.view !== view || !VIEWS.includes(view)
      || (view === 'catalog' && (!Array.isArray(raw.cities) || !Array.isArray(raw.countries)))
      || ![raw.publication_id, raw.corpus_revision, raw.source_revision, raw.content_revision].every((value) => typeof value === 'string' && HASH.test(value))
      || !Array.isArray(raw.quests) || raw.quests.length > (view === 'home' ? 8 : 500)) return null;
  const quests = raw.quests.map(projectQuestDiscoveryRow);
  if (quests.some((quest) => !quest) || new Set(quests.map((quest) => quest.quest_id)).size !== quests.length) return null;
  const cities = raw.cities ?? [], countries = raw.countries ?? [];
  const safeLinks = (links) => Array.isArray(links) && links.length <= 500 && links.every((link) =>
    typeof link?.title === 'string' && link.title.length <= 500 && safePublicPath(link.path));
  if (!safeLinks(cities) || !safeLinks(countries)) return null;
  return { schema_version: 2, state: 'available', locale: 'ru', view,
    publication_id: raw.publication_id, corpus_revision: raw.corpus_revision, source_revision: raw.source_revision,
    content_revision: raw.content_revision, quests,
    cities: cities.map(({ title, path }) => ({ title, path })), countries: countries.map(({ title, path }) => ({ title, path })) };
}

module.exports = { projectQuestDiscoveryRow, validateQuestDiscovery };
