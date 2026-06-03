import { useMemo } from 'react'
import { useLocalSearchParams } from 'expo-router'
import {
  buildListTravelInitialFilter,
  normalizeListTravelParam,
} from '../listTravelBaseModel'

export function useListTravelInitialFilter() {
  const params = useLocalSearchParams<{
    user_id?: string;
    categories?: string | string[];
    over_nights_stay?: string | string[];
    // NOTE: expo-router sometimes escapes "_" in query keys to "__" on web.
    // We accept both variants to keep deep links stable.
    over__nights__stay?: string | string[];
    categoryTravelAddress?: string | string[];
    category_travel_address?: string | string[];
    category__travel__address?: string | string[];
    companions?: string | string[];
    complexity?: string | string[];
    month?: string | string[];
    sort?: string | string[];
    search?: string | string[];
  }>();

  // Extract individual param values for stable useMemo dependencies
  // (params object is a new reference every render from useLocalSearchParams)
  const user_id = params.user_id;
  const pSearch = params.search;
  const pCategories = params.categories;
  const pOverNightsStay = params.over_nights_stay;
  const pOverNightsStayAlt = params.over__nights__stay;
  const pCategoryTravelAddress = params.categoryTravelAddress;
  const pCategoryTravelAddressSnake = params.category_travel_address;
  const pCategoryTravelAddressAlt = params.category__travel__address;
  const pCompanions = params.companions;
  const pComplexity = params.complexity;
  const pMonth = params.month;
  const pSort = params.sort;

  const normalizedSearchParam = useMemo(
    () => normalizeListTravelParam(pSearch) ?? '',
    [pSearch]
  );

  const initialFilter = useMemo(() => {
    return buildListTravelInitialFilter({
      categories: pCategories,
      over_nights_stay: pOverNightsStay,
      over__nights__stay: pOverNightsStayAlt,
      categoryTravelAddress: pCategoryTravelAddress,
      category_travel_address: pCategoryTravelAddressSnake,
      category__travel__address: pCategoryTravelAddressAlt,
      companions: pCompanions,
      complexity: pComplexity,
      month: pMonth,
      sort: pSort,
    });
  }, [
    pCategories,
    pOverNightsStay,
    pOverNightsStayAlt,
    pCategoryTravelAddress,
    pCategoryTravelAddressSnake,
    pCategoryTravelAddressAlt,
    pCompanions,
    pComplexity,
    pMonth,
    pSort,
  ]);

  return { user_id, normalizedSearchParam, initialFilter };
}
