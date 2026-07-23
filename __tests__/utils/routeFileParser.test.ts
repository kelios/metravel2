import {
  calculateRouteDistanceKm,
  parseRouteFilePreview,
  parseRouteFilePreviews,
  sanitizeRoutePreview,
  splitRouteLineSegments,
} from '@/utils/routeFileParser';

// A handful of far-apart waypoints (no elevation) stitched ahead of a short dense
// track (with elevation) — the shape the backend preview produces when it merges
// <wpt> POIs into the <trk> line, which paints straight connectors on the map.
const buildContaminatedPreview = () => {
  const waypoints = [
    { coord: '53.0000,10.0000' },
    { coord: '53.2000,10.5000' },
    { coord: '52.5000,11.0000' },
  ];
  const track = Array.from({ length: 12 }, (_, i) => ({
    coord: `52.1000,${(23.7 + i * 0.001).toFixed(4)}`,
    elevation: 100 + i * 5,
  }));
  const linePoints = [...waypoints, ...track];
  return {
    linePoints,
    // Server-style profile whose distances are offset by the phantom waypoint legs.
    elevationProfile: track.map((point, i) => ({ distanceKm: 100 + i * 0.07, elevationM: point.elevation })),
    trackFirstCoord: track[0].coord,
  };
};

describe('routeFileParser', () => {
  it('keeps non-consecutive duplicate coordinates and preserves elevation values', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx>
  <trk>
    <trkseg>
      <trkpt lat="52.1" lon="23.7"><ele>100</ele></trkpt>
      <trkpt lat="52.2" lon="23.8"><ele>110</ele></trkpt>
      <trkpt lat="52.1" lon="23.7"><ele>120</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const parsed = parseRouteFilePreview(gpx, 'gpx');
    expect(parsed.linePoints).toHaveLength(3);
    expect(parsed.linePoints[0].elevation).toBe(100);
    expect(parsed.linePoints[2].elevation).toBe(120);
    expect(parsed.elevationProfile).toHaveLength(3);
  });

  it('compacts only consecutive duplicate points and keeps available elevation', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx>
  <trk>
    <trkseg>
      <trkpt lat="52.1000" lon="23.7000"></trkpt>
      <trkpt lat="52.1000" lon="23.7000"><ele>150</ele></trkpt>
      <trkpt lat="52.2000" lon="23.8000"><ele>160</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const parsed = parseRouteFilePreview(gpx, 'gpx');
    expect(parsed.linePoints).toHaveLength(2);
    expect(parsed.linePoints[0].elevation).toBe(150);
    expect(parsed.elevationProfile).toHaveLength(2);
  });

  it('calculates distance from line points even without elevation', () => {
    const linePoints = [{ coord: '52.1,23.7' }, { coord: '52.2,23.8' }, { coord: '52.3,23.9' }];
    const distanceKm = calculateRouteDistanceKm(linePoints);

    expect(distanceKm).toBeGreaterThan(0);
  });

  it('does not count teleport legs (recording gaps) into total distance', () => {
    const linePoints = [
      { coord: '52.1000,23.7000' },
      { coord: '52.1010,23.7010' },
      { coord: '54.0000,27.0000' },
      { coord: '54.0010,27.0010' },
    ];
    const distanceKm = calculateRouteDistanceKm(linePoints);

    expect(distanceKm).toBeLessThan(1);
  });

  it('marks gapBefore on elevation samples after a teleport so ascent skips it', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx>
  <trk>
    <trkseg>
      <trkpt lat="52.1000" lon="23.7000"><ele>100</ele></trkpt>
      <trkpt lat="52.1010" lon="23.7010"><ele>110</ele></trkpt>
      <trkpt lat="54.0000" lon="27.0000"><ele>900</ele></trkpt>
      <trkpt lat="54.0010" lon="27.0010"><ele>905</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const parsed = parseRouteFilePreview(gpx, 'gpx');
    expect(parsed.elevationProfile).toHaveLength(4);
    expect(parsed.elevationProfile[2].gapBefore).toBe(true);
    expect(parsed.elevationProfile[0].gapBefore).toBeUndefined();
    expect(parsed.elevationProfile[3].gapBefore).toBeUndefined();
  });

  it('isolates teleport-stitched waypoints into single-point segments', () => {
    const { linePoints, trackFirstCoord } = buildContaminatedPreview();
    const segments = splitRouteLineSegments(linePoints);

    // Three lone waypoints + one contiguous track.
    expect(segments).toHaveLength(4);
    expect(segments.slice(0, 3).every((segment) => segment.length === 1)).toBe(true);
    const track = segments[segments.length - 1];
    expect(track).toHaveLength(12);
    expect(track[0].coord).toBe(trackFirstCoord);
  });

  it('sanitizes a contaminated preview down to the real track and rebuilds the profile', () => {
    const { linePoints, trackFirstCoord } = buildContaminatedPreview();
    const preview = {
      linePoints,
      elevationProfile: buildContaminatedPreview().elevationProfile,
    };
    const sanitized = sanitizeRoutePreview(preview as any);

    // Waypoint fragments dropped; only the 12-point track survives.
    expect(sanitized.linePoints).toHaveLength(12);
    expect(sanitized.linePoints[0].coord).toBe(trackFirstCoord);
    // Profile rebuilt from the clean line: distances start at the track, not
    // offset by the phantom waypoint legs.
    expect(sanitized.elevationProfile[0].distanceKm).toBe(0);
    expect(sanitized.elevationProfile).toHaveLength(12);
    // Distance reflects the short track (< 1 km), not the cross-region jumps.
    expect(calculateRouteDistanceKm(sanitized.linePoints)).toBeLessThan(1);
  });

  it('leaves a clean single-track preview untouched (same reference)', () => {
    const preview = parseRouteFilePreview(
      `<?xml version="1.0" encoding="UTF-8"?>
<gpx><trk><trkseg>
  <trkpt lat="52.1000" lon="23.7000"><ele>100</ele></trkpt>
  <trkpt lat="52.1010" lon="23.7010"><ele>110</ele></trkpt>
  <trkpt lat="52.1020" lon="23.7020"><ele>120</ele></trkpt>
</trkseg></trk></gpx>`,
      'gpx',
    );

    expect(sanitizeRoutePreview(preview)).toBe(preview);
  });

  it('splits GPX with multiple tracks into separate previews', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Track 1</name>
    <trkseg>
      <trkpt lat="52.1000" lon="23.7000"><ele>100</ele></trkpt>
      <trkpt lat="52.2000" lon="23.8000"><ele>120</ele></trkpt>
    </trkseg>
  </trk>
  <trk>
    <name>Track 2</name>
    <trkseg>
      <trkpt lat="53.1000" lon="24.7000"><ele>200</ele></trkpt>
      <trkpt lat="53.2000" lon="24.8000"><ele>220</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const previews = parseRouteFilePreviews(gpx, 'gpx');
    expect(previews).toHaveLength(2);
    expect(previews[0].linePoints).toHaveLength(2);
    expect(previews[1].linePoints).toHaveLength(2);
    expect(previews[0].elevationProfile).toHaveLength(2);
    expect(previews[1].elevationProfile).toHaveLength(2);
  });
});
