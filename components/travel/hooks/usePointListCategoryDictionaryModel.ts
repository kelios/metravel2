import { useTranslation } from '@/i18n/LocaleProvider';
import { resolveSupportedLocale, type SupportedLocale } from '@/i18n/config';
import { useEffect, useMemo, useState } from 'react';
import * as ReactQuery from '@tanstack/react-query';

import {
  fetchPointCategoryDictionary,
  pointCategoryDictionaryQueryKey,
} from '@/utils/pointCategoryDictionaryQuery';
import { queryConfigs } from '@/utils/reactQueryConfig';
import {
  CategoryDictionaryItem,
  createCategoryNameToIdsMap,
} from '@/utils/userPointsCategories';

export function usePointListCategoryDictionaryModel() {
  const { i18n } = useTranslation();
  const locale = resolveSupportedLocale([i18n.resolvedLanguage, i18n.language]);
  const [fallback, setFallback] = useState<{ locale: SupportedLocale; data: CategoryDictionaryItem[] }>();
  const queryRunner = (ReactQuery as { useQuery?: typeof ReactQuery.useQuery }).useQuery as
    | typeof ReactQuery.useQuery
    | undefined;
  let siteCategoryDictionaryQuery: CategoryDictionaryItem[] | undefined;

  if (typeof queryRunner === 'function') {
    try {
      const queryResult = queryRunner<CategoryDictionaryItem[]>({
        queryKey: pointCategoryDictionaryQueryKey(locale),
        queryFn: () => fetchPointCategoryDictionary(locale),
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
        const dictionary = await fetchPointCategoryDictionary(locale);
        if (active) {
          setFallback({ locale, data: dictionary });
        }
      } catch {
        if (active) setFallback({ locale, data: [] });
      }
    };
    void loadDictionary();
    return () => {
      active = false;
    };
  }, [siteCategoryDictionaryQuery, locale]);

  const siteCategoryDictionary = useMemo(() =>
    siteCategoryDictionaryQuery ?? (fallback?.locale === locale ? fallback.data : []),
  [siteCategoryDictionaryQuery, fallback, locale]);

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
