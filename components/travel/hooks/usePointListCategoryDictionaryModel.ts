import { useEffect, useMemo, useState } from 'react';
import * as ReactQuery from '@tanstack/react-query';

import { fetchFilters } from '@/api/misc';
import { queryKeys } from '@/queryKeys';
import { queryConfigs } from '@/utils/reactQueryConfig';
import {
  CategoryDictionaryItem,
  createCategoryNameToIdsMap,
  normalizeCategoryDictionary,
} from '@/utils/userPointsCategories';

export function usePointListCategoryDictionaryModel() {
  const [siteCategoryDictionaryFallback, setSiteCategoryDictionaryFallback] = useState<CategoryDictionaryItem[]>([]);
  const queryRunner = (ReactQuery as { useQuery?: typeof ReactQuery.useQuery }).useQuery as
    | typeof ReactQuery.useQuery
    | undefined;
  let siteCategoryDictionaryQuery: CategoryDictionaryItem[] | undefined;

  if (typeof queryRunner === 'function') {
    try {
      const queryResult = queryRunner<CategoryDictionaryItem[]>({
        queryKey: queryKeys.filters(),
        queryFn: async () => {
          const data = await fetchFilters();
          const raw = (data as any)?.categoryTravelAddress ?? (data as any)?.category_travel_address;
          return normalizeCategoryDictionary(raw);
        },
        ...queryConfigs.static,
        select: (data) => (Array.isArray(data) ? data : []),
      });
      siteCategoryDictionaryQuery = queryResult.data;
    } catch {
      siteCategoryDictionaryQuery = undefined;
    }
  }

  useEffect(() => {
    if (siteCategoryDictionaryQuery) return;
    let active = true;
    const loadDictionary = async () => {
      try {
        const data = await fetchFilters();
        const raw = (data as any)?.categoryTravelAddress ?? (data as any)?.category_travel_address;
        if (active) setSiteCategoryDictionaryFallback(normalizeCategoryDictionary(raw));
      } catch {
        if (active) setSiteCategoryDictionaryFallback([]);
      }
    };
    void loadDictionary();
    return () => {
      active = false;
    };
  }, [siteCategoryDictionaryQuery]);

  const siteCategoryDictionary = siteCategoryDictionaryQuery ?? siteCategoryDictionaryFallback;

  const categoryNameToIds = useMemo(
    () => createCategoryNameToIdsMap(siteCategoryDictionary),
    [siteCategoryDictionary]
  );

  const categoryIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of siteCategoryDictionary) {
      const id = String(entry.id ?? '').trim();
      const name = String(entry.name ?? '').trim();
      if (!id || !name) continue;
      map.set(id, name);
    }
    return map;
  }, [siteCategoryDictionary]);

  return {
    categoryIdToName,
    categoryNameToIds,
    siteCategoryDictionary,
  };
}
