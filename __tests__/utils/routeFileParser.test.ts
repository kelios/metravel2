import { calculateRouteDistanceKm, parseRouteFilePreview, parseRouteFilePreviews } from '@/utils/routeFileParser';

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
