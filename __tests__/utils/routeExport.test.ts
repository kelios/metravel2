import { buildGpx, buildKml } from '@/utils/routeExport';

describe('routeExport', () => {
  it('exports standalone GPX waypoints without an empty track', () => {
    const result = buildGpx({
      name: 'Points',
      sourceName: 'Article source',
      sourceUrl: 'https://metravel.by/travels/points',
      waypoints: [
        {
          name: 'A & B',
          description: 'Point <one>',
          coordinates: [27.56, 53.9],
        },
      ],
    });

    expect(result.content).toContain('<wpt lat="53.9" lon="27.56">');
    expect(result.content).toContain('<name>A &amp; B</name>');
    expect(result.content).toContain('<desc>Point &lt;one&gt;</desc>');
    expect(result.content).toContain('<link href="https://metravel.by/travels/points"><text>Article source</text></link>');
    expect(result.content).not.toContain('<trk>');
  });

  it('exports standalone KML placemarks without an empty line string', () => {
    const result = buildKml({
      name: 'Points',
      waypoints: [
        {
          name: 'A',
          coordinates: [27.56, 53.9],
        },
      ],
    });

    expect(result.content).toContain('<Placemark>');
    expect(result.content).toContain('<styleUrl>#metravelPoint</styleUrl>');
    expect(result.content).toContain('<Style id="metravelPoint">');
    expect(result.content).toContain('<color>ff2b7cff</color>');
    expect(result.content).toContain('<coordinates>27.56,53.9,0</coordinates>');
    expect(result.content).not.toContain('<LineString>');
  });
});
