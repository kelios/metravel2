/**
 * Toast notifications для страницы карты
 * Обеспечивает обратную связь пользователю при действиях на карте
 */

import { showToast } from './toast';

/**
 * Показать уведомление об успешном построении маршрута
 */
export function showRouteBuiltToast(distanceKm: number, durationMinutes: number): void {
  showToast({
    type: 'success',
    text1: 'Маршрут построен',
    text2: `${distanceKm.toFixed(1)} км • ${Math.round(durationMinutes)} мин`,
    position: 'bottom',
    visibilityTime: 3000,
  });
}

/**
 * Показать уведомление об ошибке построения маршрута
 */
export function showRouteErrorToast(errorMessage?: string): void {
  showToast({
    type: 'error',
    text1: 'Не удалось построить маршрут',
    text2: errorMessage || 'Попробуйте изменить точки или транспорт',
    position: 'bottom',
    visibilityTime: 4000,
  });
}

/**
 * Показать уведомление о сбросе фильтров
 */
export function showFiltersResetToast(): void {
  showToast({
    type: 'info',
    text1: 'Фильтры сброшены',
    text2: 'Показываем все места',
    position: 'bottom',
    visibilityTime: 2000,
  });
}

/**
 * Показать уведомление о центрировании на пользователе
 */
export function showCenterOnUserToast(): void {
  showToast({
    type: 'info',
    text1: 'Показываем ваше местоположение',
    position: 'bottom',
    visibilityTime: 2000,
  });
}

/**
 * Показать уведомление о добавлении точки маршрута
 */
export function showRoutePointAddedToast(pointNumber: number, isFirst: boolean): void {
  const message = isFirst
    ? 'Точка A добавлена. Добавьте точку B для построения маршрута'
    : `Точка ${String.fromCharCode(64 + pointNumber)} добавлена`;

  showToast({
    type: 'success',
    text1: message,
    position: 'bottom',
    visibilityTime: 2500,
  });
}

/**
 * Показать инструкцию при переключении в режим маршрута
 */
export function showRouteModeTip(): void {
  showToast({
    type: 'info',
    text1: 'Нажмите на карте для добавления точек',
    text2: 'Минимум 2 точки для построения маршрута',
    position: 'bottom',
    visibilityTime: 4000,
  });
}

/**
 * Показать уведомление о скопированной ссылке
 */
export function showLinkCopiedToast(): void {
  showToast({
    type: 'success',
    text1: 'Ссылка скопирована',
    text2: 'Поделитесь маршрутом с друзьями',
    position: 'bottom',
    visibilityTime: 2500,
  });
}

/**
 * Показать уведомление об ошибке сети
 */
export function showNetworkErrorToast(): void {
  showToast({
    type: 'error',
    text1: 'Нет соединения',
    text2: 'Проверьте интернет и попробуйте снова',
    position: 'bottom',
    visibilityTime: 4000,
  });
}

/**
 * Показать уведомление о применении фильтров
 */
export function showFiltersAppliedToast(placesCount: number): void {
  const text = placesCount === 0
    ? 'Мест не найдено'
    : `Найдено мест: ${placesCount}`;

  showToast({
    type: placesCount > 0 ? 'success' : 'info',
    text1: text,
    text2: placesCount === 0 ? 'Попробуйте изменить фильтры' : undefined,
    position: 'bottom',
    visibilityTime: 2000,
  });
}

