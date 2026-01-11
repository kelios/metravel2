type ParsedCoord = {
  lat: number;
  lon: number;
};

const parseCoordString = (coord: string): ParsedCoord | null => {
  const cleaned = String(coord || '').replace(/;/g, ',').replace(/\s+/g, '');
  const [latStr, lonStr] = cleaned.split(',').map((s) => s.trim());
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
};

export const buildGoogleMapsUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  return `https://www.google.com/maps/search/?api=1&query=${parsed.lat},${parsed.lon}`;
};

export const buildOrganicMapsUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  return `https://omaps.app/${parsed.lat},${parsed.lon}`;
};

export const buildTelegramShareUrl = (coord: string) => {
  const mapUrl = buildGoogleMapsUrl(coord);
  if (!mapUrl) return '';
  const text = `Координаты: ${coord}`;
  return `https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`;
};
