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

function findQuestCityTravelLinks(city, travels, limit = 4) {
  const cityName = normalizeLocationText(city?.name);
  const countryName = normalizeLocationText(city?.countryName);
  const countryCode = String(city?.countryCode || '').trim().toLowerCase();
  const cityCoords = Number.isFinite(city?.lat) && Number.isFinite(city?.lng)
    ? [{ lat: city.lat, lng: city.lng }]
    : [];
  const matches = [];

  for (const travel of Array.isArray(travels) ? travels : []) {
    const slug = String(travel?.slug || '').trim();
    const title = String(travel?.name || '').trim();
    if (!slug || !title) continue;

    const travelCity = normalizeLocationText(travel?.cityName || travel?.city_name || travel?.city?.name);
    const travelCountry = normalizeLocationText(travel?.countryName || travel?.country_name);
    const travelCode = String(travel?.countryCode || travel?.country_code || '').trim().toLowerCase();
    const distanceKm = cityCoords.length
      ? minDistanceKm(extractTravelCoordsForQuestPromo(travel), city.lat, city.lng)
      : Infinity;

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
