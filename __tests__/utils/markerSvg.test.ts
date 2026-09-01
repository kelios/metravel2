import { buildDropMarkerHtml } from '@/utils/markerSvg';

describe('buildDropMarkerHtml', () => {
  it('leaves positioning to the Leaflet iconAnchor', () => {
    const html = buildDropMarkerHtml({
      size: 34,
      fill: 'rgb(120, 160, 140)',
    });

    expect(html).toContain('width:34px;height:34px;position:relative;');
    expect(html).not.toContain('transform:translate');
  });
});
