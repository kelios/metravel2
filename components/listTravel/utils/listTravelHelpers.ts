/**
 * Вспомогательные функции для компонента ListTravel
 * Централизация логики для переиспользования и тестирования
 */

import type { Travel } from "@/types/types";
export { calculateColumns } from "./listTravelConstants";

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

    // DRF default: { count, next, previous, results: [...] }
    if (Array.isArray((data as any).results)) {
      items = (data as any).results;
      total =
        typeof (data as any).count === 'number'
          ? (data as any).count
          : (typeof (data as any).total === 'number' ? (data as any).total : items.length);
    }
    // Если data.items - массив (некоторые эндпоинты/обертки)
    else if (Array.isArray((data as any).items)) {
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
    // Use nullish coalescing so numeric 0 is a valid id (not treated as absent)
    const id = travel?.id != null ? travel.id : (travel?.slug ?? (travel as any)?._id);
    if (id == null || seenIds.has(id)) {
      return false;
    }
    seenIds.add(id);
    return true;
  });
}
