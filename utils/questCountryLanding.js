/* global module, require */

const {
  buildQuestCityAliasMap,
  buildQuestCityLandingGroups,
  questRouteKey,
  stableTextCompare,
} = require('./questCityAlias');

// ISO 3166-1 alpha-2 validation source. This is deliberately the complete
// standard set, not an allowlist of countries currently present in the quest
// catalog. A newly published valid code therefore gets a landing automatically.
const ISO_ALPHA2_CODES = new Set((
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS ' +
  'BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG ' +
  'EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR ' +
  'HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR ' +
  'LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG ' +
  'NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG ' +
  'SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM ' +
  'US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' '));

const SUPPORTED_DISPLAY_LOCALES = new Set(['ru', 'be', 'uk', 'pl', 'en']);
const COUNTRY_ALIAS_OVERRIDES = Object.freeze({
  // Contract fixtures shared with Django task #1606. The general path still
  // comes from the ISO English display name; these keep the product examples
  // stable even in a runtime without Intl.DisplayNames.
  BY: 'belarus',
  PL: 'poland',
});

function normalizeIsoCountryCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return ISO_ALPHA2_CODES.has(code) ? code : null;
}

function questIsoCountryCode(quest) {
  return normalizeIsoCountryCode(
    quest?.country_code ?? quest?.countryCode ?? quest?.city?.country_code,
  );
}

function normalizeDisplayLocale(locale) {
  const normalized = String(locale ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_DISPLAY_LOCALES.has(normalized) ? normalized : 'ru';
}

function getIsoCountryDisplayName(countryCode, locale = 'ru', fallback = '') {
  const code = normalizeIsoCountryCode(countryCode);
  if (!code) return '';

  const DisplayNames = Intl?.DisplayNames;
  if (typeof DisplayNames === 'function') {
    try {
      const label = new DisplayNames(normalizeDisplayLocale(locale), { type: 'region' }).of(code);
      if (label && label !== code) return label;
    } catch {
      // The caller-provided catalog name is the safe no-Intl fallback below.
    }
  }

  return String(fallback || code).trim();
}

function slugifyIsoCountryName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function getQuestCountryAlias(countryCode) {
  const code = normalizeIsoCountryCode(countryCode);
  if (!code) return null;
  if (COUNTRY_ALIAS_OVERRIDES[code]) return COUNTRY_ALIAS_OVERRIDES[code];

  const englishName = getIsoCountryDisplayName(code, 'en', code);
  return slugifyIsoCountryName(englishName) || code.toLowerCase();
}

/**
 * Catalog-derived country landings.
 *
 * Country bucketing happens before city alias merging. Otherwise two cities
 * in different countries that happen to share the same city alias could be
 * collapsed into one logical city and leak quests into the wrong country.
 */
function buildQuestCountryLandingGroups(quests, options = {}) {
  const list = Array.isArray(quests) ? quests : [];
  const locale = normalizeDisplayLocale(options?.locale);
  const questsByCode = new Map();

  for (const quest of list) {
    const code = questIsoCountryCode(quest);
    if (!code || !questRouteKey(quest)) continue;
    const countryQuests = questsByCode.get(code) || [];
    countryQuests.push(quest);
    questsByCode.set(code, countryQuests);
  }

  const groups = [];
  for (const [countryCode, countryQuests] of questsByCode) {
    const countryAlias = getQuestCountryAlias(countryCode);
    if (!countryAlias) continue;

    const cityAliasMap = buildQuestCityAliasMap(countryQuests);
    const cityGroups = buildQuestCityLandingGroups(countryQuests, cityAliasMap);
    const questPaths = new Set();
    const uniqueQuests = [];

    for (const city of cityGroups) {
      for (const quest of city.quests) {
        const route = questRouteKey(quest);
        if (!route || questPaths.has(route.path)) continue;
        questPaths.add(route.path);
        uniqueQuests.push(quest);
      }
    }
    if (uniqueQuests.length === 0 || cityGroups.length === 0) continue;

    const catalogCountryName = cityGroups.find((city) => city.countryName)?.countryName || '';
    groups.push({
      countryCode,
      countryAlias,
      countryName: getIsoCountryDisplayName(countryCode, locale, catalogCountryName),
      quests: uniqueQuests,
      cities: cityGroups.map((city) => ({
        cityAlias: city.segment,
        cityName: city.cityName || city.segment,
        questCount: city.quests.length,
        cityIds: city.cityIds.slice(),
        quests: city.quests,
      })),
    });
  }

  return groups.sort((a, b) =>
    stableTextCompare(a.countryName, b.countryName) || stableTextCompare(a.countryCode, b.countryCode),
  );
}

function resolveQuestCountryAlias(countryParam, quests, options = {}) {
  const alias = String(countryParam ?? '').trim().toLowerCase();
  if (!alias) return null;
  return buildQuestCountryLandingGroups(quests, options)
    .find((country) => country.countryAlias === alias) || null;
}

module.exports = {
  ISO_ALPHA2_CODES,
  buildQuestCountryLandingGroups,
  getIsoCountryDisplayName,
  getQuestCountryAlias,
  normalizeIsoCountryCode,
  resolveQuestCountryAlias,
  stableTextCompare,
};
