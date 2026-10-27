/* global module, require */

const { QUEST_LOCALES, buildQuestLocalePath, parseQuestLocaleRoute } = require('./questLocaleRouting');

const HASH = /^[a-f0-9]{64}$/;
const SEGMENT = /^[a-z0-9][a-z0-9_-]{0,159}$/;
const validHash = (value) => typeof value === 'string' && HASH.test(value);

/** Public routes retain the existing five-locale detail and RU landing contract. */
function parseQuestPublicRoute(pathname) {
  const path = String(pathname || '').split(/[?#]/, 1)[0].replace(/\/$/, '');
  const translated = parseQuestLocaleRoute(path);
  if (translated) return { kind: 'detail', locale: translated.locale, city: String(translated.cityId), slug: translated.questSlug, path: translated.path };
  let match = /^\/quests\/country\/([a-z0-9][a-z0-9_-]{0,159})$/.exec(path);
  if (match) return { kind: 'country', locale: 'ru', country: match[1], path };
  match = /^\/quests\/([a-z0-9][a-z0-9_-]{0,159})\/([a-z0-9][a-z0-9_-]{0,159})$/.exec(path);
  if (match) return { kind: 'detail', locale: 'ru', city: match[1], slug: match[2], path };
  match = /^\/quests\/([a-z0-9][a-z0-9_-]{0,159})$/.exec(path);
  if (match && !['scenario', 'country', 'offline', 'progress', 'create'].includes(match[1])) return { kind: 'city', locale: 'ru', city: match[1], path };
  return null;
}

function safePublicPath(value) {
  return typeof value === 'string' && value.length <= 512 && /^\/(?!\/)[^\s?#\\]*$/.test(value)
    && !hasControlCharacters(value);
}

function safePublicText(value, limit = 20000) {
  return typeof value === 'string' && value.length <= limit && !hasControlCharacters(value, true);
}

function hasControlCharacters(value, allowWhitespace = false) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 32 && !(allowWhitespace && [9, 10, 13].includes(code))) return true;
  }
  return false;
}

function safePublicImageUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

/** Reject schema drift and private gameplay fields before serializing loader data. */
function validateQuestPublicProjection(raw, route) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !route
      || raw.schema_version !== 2 || raw.state !== 'available' || raw.locale !== route.locale
      || raw.kind !== route.kind || !validHash(raw.publication_id)
      || !validHash(raw.corpus_revision) || !validHash(raw.content_revision)
      || !validHash(raw.source_revision) || !safePublicPath(raw.canonical_path)) return null;
  if (raw.canonical_path !== route.path && raw.requested_path !== route.path) return null;
  if ((raw.city_id != null && (!Number.isSafeInteger(raw.city_id) || raw.city_id <= 0))
      || (raw.quest_slug != null && (typeof raw.quest_slug !== 'string' || !SEGMENT.test(raw.quest_slug)))
      || (raw.country_code != null && raw.country_code !== '' && (typeof raw.country_code !== 'string' || !/^[a-z]{2}$/i.test(raw.country_code)))
      || (raw.ru_source_path != null && !safePublicPath(raw.ru_source_path))) return null;
  if (route.kind === 'detail') {
    if (!Number.isSafeInteger(raw.city_id) || raw.city_id <= 0 || raw.quest_slug !== route.slug
        || !SEGMENT.test(raw.quest_slug || '')
        || raw.canonical_path !== buildQuestLocalePath(raw.city_id, raw.quest_slug, route.locale)
        || raw.ru_source_path !== buildQuestLocalePath(raw.city_id, raw.quest_slug, 'ru')) return null;
  } else if (!parseQuestPublicRoute(raw.canonical_path) || parseQuestPublicRoute(raw.canonical_path).kind !== route.kind || raw.locale !== 'ru'
      || raw.quest_slug != null || (route.kind === 'country' && raw.city_id != null)
      || (raw.ru_source_path != null && raw.ru_source_path !== raw.canonical_path)) return null;
  if (!Array.isArray(raw.versions) || raw.versions.length > QUEST_LOCALES.length) return null;
  const versions = [];
  for (const version of raw.versions) {
    if (route.kind !== 'detail' || !QUEST_LOCALES.includes(version?.locale)
        || version.path !== buildQuestLocalePath(raw.city_id, raw.quest_slug, version.locale)
        || !validHash(version.content_revision)
        || versions.some((entry) => entry.locale === version.locale)) return null;
    versions.push({ locale: version.locale, path: version.path, content_revision: version.content_revision });
  }
  if (route.locale !== 'ru' && !versions.some((entry) => entry.locale === route.locale)) return null;
  if (versions.length && (versions.length < 2 || versions[0].locale !== 'ru'
      || versions.some((entry, index) => index > 0 && QUEST_LOCALES.indexOf(versions[index - 1].locale) >= QUEST_LOCALES.indexOf(entry.locale)))) return null;
  const quality = raw.quality;
  if (!quality || typeof quality.indexable !== 'boolean'
      || !Number.isSafeInteger(quality.word_count) || quality.word_count < 0
      || !(quality.own_fivegram_ratio === null || (typeof quality.own_fivegram_ratio === 'number'
        && Number.isFinite(quality.own_fivegram_ratio) && quality.own_fivegram_ratio >= 0 && quality.own_fivegram_ratio <= 1))) return null;
  const page = raw.page;
  if (!page || typeof page !== 'object' || !page.meta || !safePublicText(page.meta.title, 300)
      || !safePublicText(page.meta.description, 1000) || page.meta.canonical !== 'https://metravel.by' + raw.canonical_path
      || (page.meta.image != null && !safePublicImageUrl(page.meta.image))
      || !safePublicText(page.heading, 500) || !safePublicText(page.lead)
      || !safePublicText(page.kicker, 500) || !Array.isArray(page.sections) || page.sections.length > 40
      || !Array.isArray(page.facts) || page.facts.length > 20 || !page.facts.every((value) => safePublicText(value, 2000))
      || !Array.isArray(page.paragraphs) || page.paragraphs.length > 100 || !page.paragraphs.every((value) => safePublicText(value))
      || (route.kind === 'detail' && (!safePublicText(page.meta.tourist_type, 500) || !safePublicText(page.meta.city_name, 500)))) return null;
  const sections = [];
  for (const section of page.sections) {
    if (!section || !safePublicText(section.heading, 500) || !Array.isArray(section.paragraphs)
        || section.paragraphs.length > 100 || !section.paragraphs.every((value) => safePublicText(value))
        || !Array.isArray(section.items) || section.items.length > 500) return null;
    const items = [];
    for (const item of section.items) {
      if (!item || !safePublicText(item.title, 2000) || !safePublicText(item.text)
          || !safePublicText(item.facts, 5000) || (item.path !== null && !safePublicPath(item.path))
          || (item.lang !== null && !QUEST_LOCALES.includes(item.lang))) return null;
      items.push({ title: item.title, text: item.text, facts: item.facts, path: item.path, lang: item.lang });
    }
    sections.push({ heading: section.heading, paragraphs: section.paragraphs.slice(), items });
  }
  // JSON-LD is rebuilt from known page fields by the loader, not arbitrary API scripts.
  return { schema_version: 2, state: 'available', kind: route.kind, locale: route.locale,
    city_id: raw.city_id ?? null, quest_slug: raw.quest_slug ?? null, country_code: raw.country_code || null,
    publication_id: raw.publication_id, corpus_revision: raw.corpus_revision,
    source_revision: raw.source_revision, content_revision: raw.content_revision,
    canonical_path: raw.canonical_path, ru_source_path: raw.ru_source_path ?? null,
    versions, quality: { indexable: quality.indexable, word_count: quality.word_count, own_fivegram_ratio: quality.own_fivegram_ratio },
    page: { meta: { title: page.meta.title, description: page.meta.description, canonical: page.meta.canonical,
      image: page.meta.image ?? null,
      tourist_type: route.kind === 'detail' ? page.meta.tourist_type : null, city_name: route.kind === 'detail' ? page.meta.city_name : null },
      heading: page.heading, kicker: page.kicker, lead: page.lead, paragraphs: page.paragraphs.slice(),
      facts: page.facts.slice(), sections },
  };
}

module.exports = { parseQuestPublicRoute, safePublicPath, safePublicImageUrl, validateQuestPublicProjection };
