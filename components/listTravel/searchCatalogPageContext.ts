import { createContext, useContext, useEffect, type ReactElement } from 'react'

/**
 * #3335: видимая страница каталога `/search?page=N` — указатель в подвале списка
 * (и в скелетоне до него) и номер страницы для canonical. `null` — указателя нет:
 * статика без SSR, фильтры, переход внутри приложения, другие списки.
 * `dismiss` снимает указатель до конца жизни экрана.
 */
export type SearchCatalogVisiblePage = { page: number; footer: ReactElement | null; dismiss: () => void }

export const SearchCatalogPageContext = createContext<SearchCatalogVisiblePage | null>(null)

/**
 * Поиск, фильтры и сортировка каталога живут в состоянии списка и пишутся в адрес
 * через `history.replaceState` мимо роутера, поэтому параметры маршрута их не
 * видят. Список сам снимает указатель при первом отходе от чистого каталога.
 */
export function useDismissSearchCatalogPage(isCatalogChanged: boolean): void {
  const catalogPage = useContext(SearchCatalogPageContext)
  useEffect(() => {
    if (isCatalogChanged) catalogPage?.dismiss()
  }, [catalogPage, isCatalogChanged])
}
