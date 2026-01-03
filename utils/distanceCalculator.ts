/**
 * Утилита для расчета расстояния и времени в пути
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Рассчитывает расстояние между двумя точками по формуле гаверсинуса
 * @param from - начальная точка
 * @param to - конечная точка
 * @returns расстояние в километрах
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371; // Радиус Земли в км
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Округляем до 1 знака после запятой
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Форматирует расстояние для отображения
 * @param distance - расстояние в километрах
 * @returns отформатированная строка
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} м`;
  }
  if (distance < 10) {
    return `${distance.toFixed(1)} км`;
  }
  return `${Math.round(distance)} км`;
}

/**
 * Рассчитывает примерное время в пути
 * @param distance - расстояние в километрах
 * @param mode - режим передвижения
 * @returns время в минутах
 */
export function calculateTravelTime(
  distance: number,
  mode: 'car' | 'bike' | 'foot' = 'car'
): number {
  // Средние скорости
  const speeds = {
    car: 50,   // 50 км/ч в городе
    bike: 15,  // 15 км/ч на велосипеде
    foot: 5,   // 5 км/ч пешком
  };

  const hours = distance / speeds[mode];
  return Math.round(hours * 60); // Возвращаем минуты
}

/**
 * Форматирует время в пути для отображения
 * @param minutes - время в минутах
 * @returns отформатированная строка
 */
export function formatTravelTime(minutes: number): string {
  if (minutes < 1) {
    return '< 1 мин';
  }
  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${mins} мин`;
}

/**
 * Получает полную информацию о расстоянии и времени
 */
export function getDistanceInfo(
  from: Coordinates | null,
  to: Coordinates,
  mode: 'car' | 'bike' | 'foot' = 'car'
): { distance: number; distanceText: string; travelTime: number; travelTimeText: string } | null {
  if (!from) return null;

  const distance = calculateDistance(from, to);
  const travelTime = calculateTravelTime(distance, mode);

  return {
    distance,
    distanceText: formatDistance(distance),
    travelTime,
    travelTimeText: formatTravelTime(travelTime),
  };
}

