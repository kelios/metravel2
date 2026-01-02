import type { RouteExportInput, RouteExportResult } from './types';
import { escapeXml, isoNow, normalizeTrack, normalizeWaypoints, safeFileBaseName } from './normalize';

// KML 2.2
export const buildKml = (input: RouteExportInput): RouteExportResult => {
  const name = input.name?.trim() || 'Metravel route';
  const time = input.time || isoNow();

  const track = normalizeTrack(input.track);
  const waypoints = normalizeWaypoints(input.waypoints);

  const base = safeFileBaseName(input.name || 'metravel-route');
  const filename = `${base}.kml`;

  const wpPlacemarks = waypoints
    .map((w) => {
      const [lng, lat] = w.coordinates;
      const wName = w.name?.trim() || 'Waypoint';
      return `      <Placemark>
        <name>${escapeXml(wName)}</name>
        <Point>
          <coordinates>${lng},${lat},0</coordinates>
        </Point>
      </Placemark>`;
    })
    .join('\n');

  const lineCoords = track.map(([lng, lat]) => `${lng},${lat},0`).join(' ');

  const desc = input.description ? escapeXml(input.description) : '';

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <description>${desc}</description>
    <ExtendedData>
      <Data name="time"><value>${escapeXml(time)}</value></Data>
    </ExtendedData>

    <Style id="routeLine">
      <LineStyle>
        <color>ff2b7cff</color>
        <width>4</width>
      </LineStyle>
    </Style>

${wpPlacemarks ? wpPlacemarks + '\n\n' : ''}    <Placemark>
      <name>${escapeXml(name)}</name>
      <styleUrl>#routeLine</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${lineCoords}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
`;

  return {
    filename,
    mimeType: 'application/vnd.google-earth.kml+xml',
    content,
  };
};

