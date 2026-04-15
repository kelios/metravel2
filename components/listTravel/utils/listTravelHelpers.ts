/**
 * Вспомогательные функции для компонента ListTravel
 * Централизация логики для переиспользования и тестирования
 */

import type { Travel } from "@/types/types";
import { BREAKPOINTS, GRID_COLUMNS } from "./listTravelConstants";

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

    // Если data.items - массив (некоторые эндпоинты/обертки)
    if (Array.isArray((data as any).items)) {
      items = (data as any).items;
      total =
        typeof (data as any).total === 'number'
          ? (data as any).total
          : (typeof (data as any).count === 'number' ? (data as any).count : items.length);
    }
    else if (Array.isArray(data.data)) {
      items = data.data;
      total = typeof data.total === 'number' ? data.total : items.length;
    }
    // Если data.data - один объект
    else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      items = [data.data as Travel];
      total = typeof data.total === 'number' ? data.total : 1;
    }
    else if (typeof data.total === 'number') {
      total = data.total;
      items = [];
    }

    return { items, total };
  }

  return { items: [], total: 0 };
}

export function deduplicateTravels(travels: Travel[]): Travel[] {
  const seenIds = new Set<string | number>();
  return travels.filter((travel) => {
    const id = travel?.id ?? travel?.slug ?? (travel as any)?._id;
    if (!id || seenIds.has(id)) {
      return false;
    }
    seenIds.add(id);
    return true;
  });
}


const MIN_CARD_WIDTH = 240; // Минимальная комфортная ширина карточки
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
  const containerPadding = width >= BREAKPOINTS.DESKTOP ? 0 : getContainerPadding(width);
  const availableWidth = width - containerPadding * 2;
  
  // Рассчитываем максимальное количество колонок на основе минимальной ширины карточки
  let columns = Math.floor((availableWidth + GAP) / (MIN_CARD_WIDTH + GAP));

  // Ограничиваем максимум колонок по брейкпоинтам, чтобы сетка не расползалась на широких экранах
  // и соответствовала дизайн-решению (desktop/large desktop: до 4 колонок).
  let maxColumns = Number.POSITIVE_INFINITY;
  if (width >= BREAKPOINTS.DESKTOP_LARGE) {
    maxColumns = GRID_COLUMNS.DESKTOP_LARGE;
  } else if (width >= BREAKPOINTS.DESKTOP) {
    maxColumns = GRID_COLUMNS.DESKTOP;
  } else if (width >= BREAKPOINTS.TABLET_LANDSCAPE) {
    maxColumns = GRID_COLUMNS.TABLET_LANDSCAPE;
  } else if (width >= BREAKPOINTS.TABLET) {
    maxColumns = GRID_COLUMNS.TABLET;
  }

  if (Number.isFinite(maxColumns)) {
    columns = Math.min(columns, maxColumns);
  }

  // Учитываем ориентацию для планшетов
  if (orientation === 'portrait' && width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.DESKTOP) {
    columns = Math.min(columns, 2);
  }
  
  // Минимум 1 колонка
  return Math.max(columns, 1);
}

