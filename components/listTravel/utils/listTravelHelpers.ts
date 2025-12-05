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

// ✅ АРХИТЕКТУРА: Расчет количества колонок
// ✅ ОПТИМИЗАЦИЯ: Улучшена адаптивность для всех устройств с учетом читаемости
export function calculateColumns(width: number): number {
  if (width < BREAKPOINTS.MOBILE) {
    return GRID_COLUMNS.MOBILE; // < 768px: 1 колонка
  }
  if (width < BREAKPOINTS.TABLET) {
    return GRID_COLUMNS.TABLET; // 768-1024px: 2 колонки
  }
  if (width < BREAKPOINTS.TABLET_LANDSCAPE) {
    return GRID_COLUMNS.TABLET_LANDSCAPE; // 1024-1280px: 2 колонки
  }
  if (width < BREAKPOINTS.DESKTOP) {
    return GRID_COLUMNS.DESKTOP; // 1280-1440px: 3 колонки
  }
  return GRID_COLUMNS.DESKTOP_LARGE; // > 1440px: 3 колонки (ограничено для лучшего UX)
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

