import { buildGpx, buildKml } from '@/utils/routeExport';

describe('routeExport', () => {
  it('exports standalone GPX waypoints without an empty track', () => {
    const result = buildGpx({
      name: 'Points',
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
    expect(result.content).toContain('<coordinates>27.56,53.9,0</coordinates>');
    expect(result.content).not.toContain('<LineString>');
  });
});
