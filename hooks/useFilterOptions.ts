import { useTranslation } from '@/i18n/LocaleProvider';
import { resolveSupportedLocale } from '@/i18n/config';
// hooks/useFilterOptions.ts
// Единый источник серверных фильтров (категории/транспорт/страны и т.д.).
// Все потребители читают один кэш React Query (queryKeys.filterOptions(lang)),
// данные тянутся одним дедуплицированным запросом через fetchAllFiltersOptimized.

import { useQuery } from '@tanstack/react-query';
import { fetchAllFiltersOptimized } from '@/api/miscOptimized';
import { queryKeys } from '@/api/queryKeys';
import { queryConfigs } from '@/utils/reactQueryConfig';
import type { Filters } from '@/types/types';

interface UseFilterOptionsParams<T> {
    select?: (data: Filters) => T;
    enabled?: boolean;
}

export function useFilterOptions<T = Filters>(params: UseFilterOptionsParams<T> = {}) {
    const { select, enabled } = params;
    const { i18n } = useTranslation();
    const lang = resolveSupportedLocale([i18n.resolvedLanguage, i18n.language]);
    return useQuery({
        queryKey: queryKeys.filterOptions(lang),
        queryFn: ({ signal }) => fetchAllFiltersOptimized({ signal, lang }),
        ...queryConfigs.static,
        ...(enabled === undefined ? {} : { enabled }),
        ...(select ? { select } : {}),
    });
}
