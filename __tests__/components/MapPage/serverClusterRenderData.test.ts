import { buildServerClusterRenderData } from '@/components/MapPage/Map/serverClusterRenderData';

describe('buildServerClusterRenderData', () => {
  it('adapts backend clusters to ClusterLayer data', () => {
    const result = buildServerClusterRenderData({
      clusters: [
        {
          id: 'c1',
          center: { lat: 53.9, lng: 27.56 },
          count: 12,
          bounds: { south: 53.8, west: 27.4, north: 54, east: 27.7 },
          previewItems: [
            {
              id: 1,
              coord: '53.9,27.56',
              lat: '53.9',
              lng: '27.56',
              address: 'Минск',
              categoryName: 'Город',
              travelImageThumbUrl: 'thumb.jpg',
              imageUrl: 'image.jpg',
              urlTravel: '/travels/minsk',
            },
          ],
        },
      ],
      markers: [],
      totalCount: 12,
      source: 'server',
      generatedAt: '2026-07-04T00:00:00Z',
    });

    expect(result.hasServerData).toBe(true);
    expect(result.clusters[0]).toEqual(
      expect.objectContaining({
        key: 'c1',
        count: 12,
        center: [53.9, 27.56],
        bounds: [
          [53.8, 27.4],
          [54, 27.7],
        ],
      }),
    );
    expect(result.clusters[0].items[0]).toEqual(
      expect.objectContaining({
        id: 1,
        coord: '53.9,27.56',
        address: 'Минск',
        travelImageThumbUrl: 'thumb.jpg',
        urlTravel: '/travels/minsk',
      }),
    );
  });

  it('adapts backend markers to existing map points', () => {
    const result = buildServerClusterRenderData({
      clusters: [],
      markers: [
        {
          id: 2,
          coord: '',
          lat: '54',
          lng: '28',
          address: 'Marker',
          categoryName: 'Place',
          travelImageThumbUrl: '',
          imageUrl: 'image.jpg',
          urlTravel: '/travels/marker',
        },
      ],
      totalCount: 1,
      source: 'server',
      generatedAt: '',
    });

    expect(result.markers).toEqual([
      expect.objectContaining({
        id: 2,
        coord: '54,28',
        imageUrl: 'image.jpg',
      }),
    ]);
  });
});
