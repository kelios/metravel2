/* global module */

// Shared matching policy extracted from the SEO generator; no content rewriting.
function normalizeLocationText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'„""–—-]/g, '')
    .replace(/ё/g, 'е')
    .trim();
}

function parseCoordPair(value) {
  if (!value || typeof value !== 'string') return null;
  const [latS, lngS] = value.split(',').map((part) => part.trim());
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function extractTravelCoordsForQuestPromo(travel) {
  const coords = [];
  const pushCoord = (latValue, lngValue) => {
    const lat = Number(latValue);
    const lng = Number(lngValue);
    if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push({ lat, lng });
  };

  if (Array.isArray(travel?.travelAddress)) {
    for (const item of travel.travelAddress) {
      const parsed = parseCoordPair(typeof item === 'string' ? item : item?.coord || item?.coords);
      if (parsed) coords.push(parsed);
      else if (item && typeof item === 'object') pushCoord(item.lat ?? item.latitude, item.lng ?? item.lon ?? item.longitude);
    }
  }

  if (Array.isArray(travel?.coordsMeTravelArr)) {
    for (const raw of travel.coordsMeTravelArr) {
      const parsed = parseCoordPair(raw);
      if (parsed) coords.push(parsed);
    }
  }

  if (Array.isArray(travel?.coordsMeTravel)) {
    for (const item of travel.coordsMeTravel) {
      if (item && typeof item === 'object') pushCoord(item.lat ?? item.latitude, item.lng ?? item.lon ?? item.longitude);
    }
  }

  pushCoord(travel?.lat ?? travel?.latitude, travel?.lng ?? travel?.lon ?? travel?.longitude);

  const seen = new Set();
  return coords.filter((coord) => {
    const key = `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
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

function minDistanceKm(coords, lat, lng) {
  if (!Array.isArray(coords) || !coords.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  return coords.reduce((min, coord) => {
    if (!Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) return min;
    return Math.min(min, haversineKm(coord.lat, coord.lng, lat, lng));
  }, Infinity);
}

// Every quest page scans all published travels; the per-travel part is pure,
// so it is derived once per travel object instead of once per page.
const travelProfiles = new WeakMap();

function travelProfile(travel) {
  const cached = travel && typeof travel === 'object' ? travelProfiles.get(travel) : undefined;
  if (cached) return cached;
  const profile = {
    slug: String(travel?.slug || '').trim(),
    title: String(travel?.name || '').trim(),
    travelCity: normalizeLocationText(travel?.cityName || travel?.city_name || travel?.city?.name),
    travelCountry: normalizeLocationText(travel?.countryName || travel?.country_name),
    travelCode: String(travel?.countryCode || travel?.country_code || '').trim().toLowerCase(),
    // A city's travels are the ones anchored there: the first point, as the
    // catalog card's lat/lng. A multi-point road trip passing by is not one
    // (#2817: every point let roundups displace the city's own articles).
    coords: extractTravelCoordsForQuestPromo(travel).slice(0, 1),
  };
  if (travel && typeof travel === 'object') travelProfiles.set(travel, profile);
  return profile;
}

function findQuestCityTravelLinks(city, travels, limit = 4) {
  const cityName = normalizeLocationText(city?.name);
  const countryName = normalizeLocationText(city?.countryName);
  const countryCode = String(city?.countryCode || '').trim().toLowerCase();
  const cityCoords = Number.isFinite(city?.lat) && Number.isFinite(city?.lng)
    ? [{ lat: city.lat, lng: city.lng }]
    : [];
  const matches = [];

  for (const travel of Array.isArray(travels) ? travels : []) {
    const { slug, title, travelCity, travelCountry, travelCode, coords } = travelProfile(travel);
    if (!slug || !title) continue;

    const distanceKm = cityCoords.length ? minDistanceKm(coords, city.lat, city.lng) : Infinity;

    if (countryCode && travelCode && countryCode !== travelCode && distanceKm >= 15) continue;
    if (!countryCode && countryName && travelCountry && countryName !== travelCountry && distanceKm >= 15) continue;

    let score = 0;
    if (cityName && travelCity) {
      if (cityName === travelCity) score += 100;
      else if (cityName.includes(travelCity) || travelCity.includes(cityName)) score += 55;
    }
    if (distanceKm < 8) score += 60;
    else if (distanceKm < 20) score += 40;
    else if (distanceKm < 50) score += 20;
    if ((countryCode && countryCode === travelCode) || (countryName && countryName === travelCountry)) score += 15;
    if (score < 55) continue;

    matches.push({ path: `/travels/${encodeURIComponent(slug)}`, title, score, distanceKm });
  }

  return matches
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.path.localeCompare(b.path))
    .slice(0, Math.max(0, limit));
}

module.exports = { findQuestCityTravelLinks, normalizeLocationText, parseCoordPair,
  extractTravelCoordsForQuestPromo, haversineKm, minDistanceKm };
