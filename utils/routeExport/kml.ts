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
      const wDesc = w.description ? `        <description>${escapeXml(w.description)}</description>\n` : '';
      return `      <Placemark>
        <name>${escapeXml(wName)}</name>
        <styleUrl>#metravelPoint</styleUrl>
${wDesc}        <Point>
          <coordinates>${lng},${lat},0</coordinates>
        </Point>
      </Placemark>`;
    })
    .join('\n');

  const lineCoords = track.map(([lng, lat]) => `${lng},${lat},0`).join(' ');
  const linePlacemark = track.length >= 2
    ? `    <Placemark>
      <name>${escapeXml(name)}</name>
      <styleUrl>#routeLine</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${lineCoords}</coordinates>
      </LineString>
    </Placemark>`
    : '';

  const desc = input.description ? escapeXml(input.description) : '';

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(name)}</name>
    <description>${desc}</description>
    <ExtendedData>
      <Data name="time"><value>${escapeXml(time)}</value></Data>
${input.sourceName ? `      <Data name="source"><value>${escapeXml(input.sourceName)}</value></Data>\n` : ''}${input.sourceUrl ? `      <Data name="source_url"><value>${escapeXml(input.sourceUrl)}</value></Data>\n` : ''}    </ExtendedData>

    <Style id="routeLine">
      <LineStyle>
        <color>ff2b7cff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Style id="metravelPoint">
      <IconStyle>
        <color>ff2b7cff</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>ff2b7cff</color>
      </LabelStyle>
    </Style>

${wpPlacemarks ? wpPlacemarks + '\n\n' : ''}${linePlacemark ? linePlacemark + '\n' : ''}
  </Document>
</kml>
`;

  return {
    filename,
    mimeType: 'application/vnd.google-earth.kml+xml',
    content,
  };
};
