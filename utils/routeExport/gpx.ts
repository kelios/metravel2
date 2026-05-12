import type { RouteExportInput, RouteExportResult } from './types';
import { escapeXml, isoNow, normalizeTrack, normalizeWaypoints, safeFileBaseName } from './normalize';

// GPX 1.1
export const buildGpx = (input: RouteExportInput): RouteExportResult => {
  const name = input.name?.trim() || 'Metravel route';
  const time = input.time || isoNow();

  const track = normalizeTrack(input.track);
  const waypoints = normalizeWaypoints(input.waypoints);

  const base = safeFileBaseName(input.name || 'metravel-route');
  const filename = `${base}.gpx`;

  const wptXml = waypoints
    .map((w) => {
      const [lng, lat] = w.coordinates;
      const wName = w.name ? `<name>${escapeXml(w.name)}</name>` : '';
      const wDesc = w.description ? `<desc>${escapeXml(w.description)}</desc>` : '';
      const body = [wName, wDesc].filter(Boolean).map((line) => `    ${line}`).join('\n');
      return `  <wpt lat="${lat}" lon="${lng}">${body ? `\n${body}\n  ` : ''}</wpt>`;
    })
    .join('\n');

  const trkptsXml = track
    .map(([lng, lat]) => `        <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join('\n');

  const descXml = input.description ? `  <desc>${escapeXml(input.description)}</desc>\n` : '';
  const trackXml = track.length >= 2
    ? `  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkptsXml}
    </trkseg>
  </trk>`
    : '';

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="metravel" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
${descXml}    <time>${escapeXml(time)}</time>
  </metadata>
${wptXml ? wptXml + '\n' : ''}${trackXml ? trackXml + '\n' : ''}
</gpx>
`;

  return {
    filename,
    mimeType: 'application/gpx+xml',
    content,
  };
};
