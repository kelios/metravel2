/**
 * Простая кластеризация точек для карты
 * Группирует близкие точки в кластеры для улучшения производительности
 */

export interface ClusterPoint {
  id: number;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

export interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  points: ClusterPoint[];
  count: number;
}

/**
 * Группирует точки в кластеры на основе расстояния
 * @param points - Массив точек для кластеризации
 * @param pixelRadius - Радиус кластера в пикселях (по умолчанию 60)
 * @param zoom - Текущий уровень зума карты (1-20)
 * @returns Массив кластеров и одиночных точек
 */
export function clusterPoints(
  points: ClusterPoint[],
  pixelRadius: number = 60,
  zoom: number = 10
): Array<Cluster | ClusterPoint> {
  if (!points || points.length === 0) return [];
  
  // При высоком зуме не кластеризуем
  if (zoom >= 16) {
    return points;
  }

  const clusters: Cluster[] = [];
  const processed = new Set<number>();

  // Вычисляем расстояние в градусах на основе зума и радиуса в пикселях
  // Примерная формула: на зуме 10 один пиксель ≈ 0.0001 градуса
  const degreesPerPixel = 156543.03392 * Math.cos(0) / Math.pow(2, zoom) / 111320;
  const clusterRadius = pixelRadius * degreesPerPixel;

  for (let i = 0; i < points.length; i++) {
    if (processed.has(i)) continue;

    const point = points[i];
    const nearbyPoints: ClusterPoint[] = [point];
    processed.add(i);

    // Ищем близкие точки
    for (let j = i + 1; j < points.length; j++) {
      if (processed.has(j)) continue;

      const other = points[j];
      const distance = Math.sqrt(
        Math.pow(point.latitude - other.latitude, 2) +
        Math.pow(point.longitude - other.longitude, 2)
      );

      if (distance <= clusterRadius) {
        nearbyPoints.push(other);
        processed.add(j);
      }
    }

    // Если найдено больше одной точки - создаем кластер
    if (nearbyPoints.length > 1) {
      const centerLat = nearbyPoints.reduce((sum, p) => sum + p.latitude, 0) / nearbyPoints.length;
      const centerLng = nearbyPoints.reduce((sum, p) => sum + p.longitude, 0) / nearbyPoints.length;

      clusters.push({
        id: `cluster-${i}`,
        latitude: centerLat,
        longitude: centerLng,
        points: nearbyPoints,
        count: nearbyPoints.length,
      });
    }
  }

  // Возвращаем кластеры + одиночные точки
  const result: Array<Cluster | ClusterPoint> = [...clusters];
  
  points.forEach((point, idx) => {
    if (!processed.has(idx)) {
      result.push(point);
    }
  });

  return result;
}

/**
 * Проверяет, является ли объект кластером
 */
export function isCluster(item: Cluster | ClusterPoint): item is Cluster {
  return 'count' in item && 'points' in item;
}

/**
 * Вычисляет оптимальный радиус кластеризации на основе количества точек
 */
export function getOptimalClusterRadius(pointsCount: number): number {
  if (pointsCount < 50) return 40;
  if (pointsCount < 200) return 60;
  if (pointsCount < 500) return 80;
  return 100;
}
