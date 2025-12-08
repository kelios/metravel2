/**
 * Вспомогательные функции для компонента ListTravel
 * Централизация логики для переиспользования и тестирования
 */

import type { Travel } from "@/src/types/types";
import type { TravelsApiResponse, FilterState, FilterOptions, CategoryWithCount } from "./listTravelTypes";
import { BREAKPOINTS, GRID_COLUMNS, BADGE_THRESHOLDS } from "./listTravelConstants";
import { buildTravelQueryParams } from '@/src/utils/filterQuery';

// ✅ АРХИТЕКТУРА: Нормализация ответа API
export function normalizeApiResponse(data: any): { items: Travel[]; total: number } {
  if (!data) {
    return { items: [], total: 0 };
  }

  // Если data - массив, возвращаем как есть
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }

  // Если data - объект с полями data и total
  if (data && typeof data === 'object') {
    let items: Travel[] = [];
    let total = 0;

    // ✅ ИСПРАВЛЕНИЕ: Если data.data - массив (основной случай)
    if (Array.isArray(data.data)) {
      items = data.data;
      // ✅ ИСПРАВЛЕНИЕ: Используем total из ответа, если он есть, иначе длину массива
      total = typeof data.total === 'number' ? data.total : items.length;
    }
    // Если data.data - один объект
    else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      items = [data.data as Travel];
      total = typeof data.total === 'number' ? data.total : 1;
    }
    // ✅ ИСПРАВЛЕНИЕ: Если есть total, но нет data (пустой результат)
    else if (typeof data.total === 'number') {
      total = data.total;
      items = [];
    }

    return { items, total };
  }

  return { items: [], total: 0 };
}

// ✅ АРХИТЕКТУРА: Удаление дубликатов путешествий
export function deduplicateTravels(travels: Travel[]): Travel[] {
  const seenIds = new Set<string | number>();
  return travels.filter((travel) => {
    const id = travel?.id ?? travel?.slug ?? travel?._id;
    if (!id || seenIds.has(id)) {
      return false;
    }
    seenIds.add(id);
    return true;
  });
}

// ✅ B1.2: Улучшенный расчет количества колонок на основе минимальной ширины карточки
const MIN_CARD_WIDTH = 280; // Минимальная комфортная ширина карточки
const MAX_CARD_WIDTH = 400; // Максимальная ширина карточки
const GAP = 16; // Отступ между карточками

// Функция для расчета padding контейнера
function getContainerPadding(width: number): number {
  if (width < BREAKPOINTS.XS) return 8;
  if (width < BREAKPOINTS.SM) return 12;
  if (width < BREAKPOINTS.MOBILE) return 16;
  if (width < BREAKPOINTS.TABLET) return 20;
  if (width < BREAKPOINTS.DESKTOP) return 24;
  if (width < BREAKPOINTS.DESKTOP_LARGE) return 32;
  return 40;
}

export function calculateColumns(width: number, orientation: 'portrait' | 'landscape' = 'landscape'): number {
  // Для очень маленьких экранов всегда 1 колонка
  if (width < BREAKPOINTS.MOBILE) {
    return 1;
  }
  
  // Рассчитываем доступную ширину с учетом padding
  const containerPadding = getContainerPadding(width);
  const availableWidth = width - (containerPadding * 2);
  
  // Рассчитываем максимальное количество колонок на основе минимальной ширины карточки
  let columns = Math.floor((availableWidth + GAP) / (MIN_CARD_WIDTH + GAP));
  
  // Ограничения для разных устройств
  if (width < BREAKPOINTS.TABLET) {
    // Планшеты в портретной ориентации - максимум 2 колонки
    columns = Math.min(columns, 2);
  } else if (width < BREAKPOINTS.DESKTOP) {
    // Планшеты в ландшафте - максимум 3 колонки
    columns = Math.min(columns, 3);
  } else if (width < BREAKPOINTS.XXL) {
    // Desktop - максимум 3 колонки для лучшей читаемости
    columns = Math.min(columns, 3);
  } else {
    // Очень большие экраны - максимум 4 колонки
    columns = Math.min(columns, 4);
  }
  
  // Учитываем ориентацию для планшетов
  if (orientation === 'portrait' && width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.DESKTOP) {
    columns = Math.min(columns, 2);
  }
  
  // Минимум 1 колонка
  return Math.max(columns, 1);
}

// ✅ АРХИТЕКТУРА: Определение badges для социального доказательства
export function calculateBadges(travel: Travel): Array<{ label: string; color: string; bgColor: string }> {
  const result: Array<{ label: string; color: string; bgColor: string }> = [];
  const views = Number(travel.countUnicIpView) || 0;
  const updatedAt = (travel as any).updated_at;
  const createdAt = (travel as any).created_at || updatedAt;
  
  // "Популярное" - более 1000 просмотров
  if (views > BADGE_THRESHOLDS.POPULAR_VIEWS) {
    result.push({
      label: 'Популярное',
      color: '#fff',
      bgColor: '#ff9f5a',
    });
  }
  
  // "Новое" - создано за последние 7 дней
  if (createdAt) {
    const createdDate = new Date(createdAt);
    const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated <= BADGE_THRESHOLDS.NEW_DAYS) {
      result.push({
        label: 'Новое',
        color: '#fff',
        bgColor: '#10b981',
      });
    }
  }
  
  // "Тренд" - растущая популярность
  if (updatedAt && views > BADGE_THRESHOLDS.TREND_VIEWS) {
    const updatedDate = new Date(updatedAt);
    const daysSinceUpdated = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdated <= BADGE_THRESHOLDS.TREND_DAYS && !result.find(b => b.label === 'Новое')) {
      result.push({
        label: 'Тренд',
        color: '#fff',
        bgColor: '#3b82f6',
      });
    }
  }
  
  return result;
}

// ✅ АРХИТЕКТУРА: Подсчет категорий с количеством
export function calculateCategoriesWithCount(
  travels: Travel[],
  allCategories: FilterOptions['categories'] = []
): CategoryWithCount[] {
  if (!allCategories || travels.length === 0) {
    return [];
  }
  
  const categoryCounts: Record<string, number> = {};
  travels.forEach((travel) => {
    if (travel.categoryName) {
      const cats = travel.categoryName.split(',').map((c: string) => c.trim());
      cats.forEach((cat: string) => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    }
  });

  return allCategories
    .filter((cat) => cat && cat.name && categoryCounts[cat.name])
    .map((cat) => ({
      id: cat.id || cat.name,
      name: cat.name,
      count: categoryCounts[cat.name] || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ✅ АРХИТЕКТУРА: Определение isEmpty состояния
export function calculateIsEmpty(
  isQueryEnabled: boolean,
  status: string,
  isFetching: boolean,
  isLoading: boolean,
  hasAnyItems: boolean,
  data: any
): boolean {
  // Не показываем пустое состояние во время загрузки
  if (isFetching || isLoading) return false;
  
  // Не показываем пустое состояние если данные есть
  if (hasAnyItems) return false;
  
  // Проверяем данные от бэкенда
  if (data) {
    if (Array.isArray(data)) {
      if (data.length > 0) return false;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.data) && data.data.length > 0) return false;
      if (typeof data.total === 'number' && data.total > 0) return false;
      if (data.data && typeof data.data === 'object') return false;
    }
  }
  
  // Показываем пустое состояние только если запрос завершен и данных нет
  return isQueryEnabled && status === "success";
}

// ✅ АРХИТЕКТУРА: Определение isMobile
export function isMobile(width: number): boolean {
  return width < BREAKPOINTS.MOBILE;
}

// ✅ АРХИТЕКТУРА: Определение isTablet
export function isTablet(width: number): boolean {
  return width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.TABLET;
}

