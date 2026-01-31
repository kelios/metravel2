/**
 * Tests for useDynamicClustering hook
 */

import { renderHook } from '@testing-library/react';
import { useDynamicClustering, useClusteringStats } from '@/components/MapPage/Map/useDynamicClustering';

describe('useDynamicClustering', () => {
  const mockPoints = [
    { id: 1, coord: '53.9006,27.559', address: 'Point 1', travelImageThumbUrl: '', categoryName: 'test' },
    { id: 2, coord: '53.9007,27.560', address: 'Point 2', travelImageThumbUrl: '', categoryName: 'test' },
    { id: 3, coord: '53.9008,27.561', address: 'Point 3', travelImageThumbUrl: '', categoryName: 'test' },
    { id: 4, coord: '53.9100,27.600', address: 'Point 4', travelImageThumbUrl: '', categoryName: 'test' },
    { id: 5, coord: '53.9101,27.601', address: 'Point 5', travelImageThumbUrl: '', categoryName: 'test' },
  ];

  describe('clustering behavior', () => {
    it('should not cluster when points < threshold', () => {
      const { result } = renderHook(() =>
        useDynamicClustering(mockPoints.slice(0, 2), 10, { threshold: 5 })
      );

      expect(result.current.shouldRenderClusters).toBe(false);
      expect(result.current.clusters).toHaveLength(0);
    });

    it('should cluster when points > threshold', () => {
      const { result } = renderHook(() =>
        useDynamicClustering(mockPoints, 10, { threshold: 3 })
      );

      expect(result.current.shouldRenderClusters).toBe(true);
      expect(result.current.clusters.length).toBeGreaterThan(0);
    });

    it('should not cluster at high zoom levels', () => {
      const { result } = renderHook(() =>
        useDynamicClustering(mockPoints, 15, { threshold: 3, expandZoom: 14 })
      );

      expect(result.current.shouldRenderClusters).toBe(false);
    });

    it('should cluster at low zoom levels', () => {
      const { result } = renderHook(() =>
        useDynamicClustering(mockPoints, 10, { threshold: 3, expandZoom: 14 })
      );

      expect(result.current.shouldRenderClusters).toBe(true);
    });
  });

  describe('grid size adaptation', () => {
    it('should have smaller grid size at higher zoom', () => {
      const { result: result1 } = renderHook(() =>
        useDynamicClustering(mockPoints, 16, { threshold: 3 })
      );

      const { result: result2 } = renderHook(() =>
        useDynamicClustering(mockPoints, 10, { threshold: 3 })
      );

      expect(result1.current.gridSize).toBeLessThan(result2.current.gridSize);
    });

    it('should adapt grid size based on zoom level', () => {
      const zooms = [9, 11, 13, 15, 16];
      const gridSizes = zooms.map(zoom => {
        const { result } = renderHook(() =>
          useDynamicClustering(mockPoints, zoom, { threshold: 3 })
        );
        return result.current.gridSize;
      });

      // Grid sizes should decrease with zoom
      for (let i = 1; i < gridSizes.length; i++) {
        expect(gridSizes[i]).toBeLessThanOrEqual(gridSizes[i - 1]);
      }
    });
  });

  describe('cluster properties', () => {
    it('should create clusters with correct structure', () => {
      const { result } = renderHook(() =>
        useDynamicClustering(mockPoints, 10, { threshold: 3 })
      );

      const cluster = result.current.clusters[0];

      expect(cluster).toHaveProperty('key');
      expect(cluster).toHaveProperty('center');
      expect(cluster).toHaveProperty('count');
      expect(cluster).toHaveProperty('items');
      expect(cluster).toHaveProperty('bounds');

      expect(Array.isArray(cluster.center)).toBe(true);
      expect(cluster.center).toHaveLength(2);
      expect(typeof cluster.count).toBe('number');
      expect(Array.isArray(cluster.items)).toBe(true);
    });

    it('should calculate cluster center correctly', () => {
      const { result } = renderHook(() =>
        useDynamicClustering(mockPoints, 10, { threshold: 3 })
      );

      for (const cluster of result.current.clusters) {
        const [centerLat, centerLng] = cluster.center;

        // Center should be within bounds
        const [[minLat, minLng], [maxLat, maxLng]] = cluster.bounds;
        expect(centerLat).toBeGreaterThanOrEqual(minLat);
        expect(centerLat).toBeLessThanOrEqual(maxLat);
        expect(centerLng).toBeGreaterThanOrEqual(minLng);
        expect(centerLng).toBeLessThanOrEqual(maxLng);
      }
    });

    it('should preserve all points in clusters', () => {
      const { result } = renderHook(() =>
        useDynamicClustering(mockPoints, 10, { threshold: 3 })
      );

      const totalPointsInClusters = result.current.clusters.reduce(
        (sum, cluster) => sum + cluster.count,
        0
      );

      expect(totalPointsInClusters).toBe(mockPoints.length);
    });
  });

  describe('performance', () => {
    it('should handle large datasets efficiently', () => {
      // Generate 1000 points
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        coord: `${53.9 + Math.random() * 0.1},${27.5 + Math.random() * 0.1}`,
        address: `Point ${i}`,
        travelImageThumbUrl: '',
        categoryName: 'test',
      }));

      const startTime = performance.now();

      const { result } = renderHook(() =>
        useDynamicClustering(largeDataset, 10, { threshold: 25 })
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);

      // Should reduce point count significantly
      expect(result.current.clusters.length).toBeLessThan(largeDataset.length);
    });
  });
});

describe('useClusteringStats', () => {
  const mockClusters = [
    {
      key: '1',
      center: [53.9, 27.5] as [number, number],
      count: 5,
      items: [],
      bounds: [[53.8, 27.4], [54.0, 27.6]] as [[number, number], [number, number]],
    },
    {
      key: '2',
      center: [53.95, 27.55] as [number, number],
      count: 1,
      items: [],
      bounds: [[53.95, 27.55], [53.95, 27.55]] as [[number, number], [number, number]],
    },
    {
      key: '3',
      center: [54.0, 27.6] as [number, number],
      count: 3,
      items: [],
      bounds: [[53.99, 27.59], [54.01, 27.61]] as [[number, number], [number, number]],
    },
  ];

  it('should calculate total cluster count', () => {
    const { result } = renderHook(() =>
      useClusteringStats(9, mockClusters)
    );

    expect(result.current.clusterCount).toBe(3);
  });

  it('should count singleton clusters', () => {
    const { result } = renderHook(() =>
      useClusteringStats(9, mockClusters)
    );

    expect(result.current.singletonCount).toBe(1);
  });

  it('should calculate average cluster size', () => {
    const { result } = renderHook(() =>
      useClusteringStats(9, mockClusters)
    );

    const expectedAverage = (5 + 1 + 3) / 3;
    expect(result.current.averageClusterSize).toBe(expectedAverage);
  });

  it('should find max cluster size', () => {
    const { result } = renderHook(() =>
      useClusteringStats(9, mockClusters)
    );

    expect(result.current.maxClusterSize).toBe(5);
  });

  it('should calculate reduction ratio', () => {
    const { result } = renderHook(() =>
      useClusteringStats(9, mockClusters)
    );

    const expectedRatio = (1 - 3 / 9) * 100;
    expect(result.current.reductionRatio).toBeCloseTo(expectedRatio, 1);
  });

  it('should handle empty clusters', () => {
    const { result } = renderHook(() =>
      useClusteringStats(10, [])
    );

    expect(result.current.clusterCount).toBe(0);
    expect(result.current.singletonCount).toBe(0);
    expect(result.current.averageClusterSize).toBe(0);
    expect(result.current.maxClusterSize).toBe(0);
    expect(result.current.reductionRatio).toBe(0);
  });
});
