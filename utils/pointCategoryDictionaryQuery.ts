import { fetchFiltersOptimized } from '@/api/miscOptimized'
import { queryKeys } from '@/queryKeys'
import { normalizeCategoryDictionary, type CategoryDictionaryItem } from '@/utils/userPointsCategories'

/**
 * Единственное определение словаря категорий точек в React Query.
 *
 * Ключ `queryKeys.filters()` делят стартовый idle-префетч
 * (`utils/queryClientStaticPrefetch.ts`) и его потребитель
 * (`components/travel/hooks/usePointListCategoryDictionaryModel.ts`). Пока у
 * каждого была своя queryFn, под общим ключом оказывались РАЗНЫЕ формы —
 * префетч клал сырой `FilterDictionaries`, потребитель ждал нормализованный
 * список и через `select` отбрасывал всё, что не массив. Выигранная префетчем
 * гонка означала пустой словарь на все 30 минут `staleTime`. Поэтому и ключ, и
 * загрузчик живут здесь в одном экземпляре, а конфиг кэширования каждый
 * потребитель берёт из общего `queryConfigs.static`.
 */
export const pointCategoryDictionaryQueryKey = () => queryKeys.filters()

export const fetchPointCategoryDictionary = async (): Promise<CategoryDictionaryItem[]> => {
  const data = await fetchFiltersOptimized()
  return normalizeCategoryDictionary(data.categoryTravelAddress)
}
