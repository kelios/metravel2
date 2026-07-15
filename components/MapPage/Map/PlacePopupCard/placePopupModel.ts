export function getPlacePopupSubtitle(
  subtitle: string | null | undefined,
  isBottomCardLayout: boolean,
): string | null | undefined {
  if (!subtitle || !isBottomCardLayout) return subtitle;

  const segments = subtitle
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length <= 3 ? subtitle : segments.slice(-3).join(', ');
}

export function getPlacePopupCoordinate(
  coordinate: string | null | undefined,
  isBottomCardLayout: boolean,
): string | null | undefined {
  if (!coordinate || !isBottomCardLayout) return coordinate;

  const parts = coordinate
    .replace(/;/g, ',')
    .split(',')
    .map((value) => value.trim());

  if (parts.length < 2) return coordinate;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return coordinate;

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
