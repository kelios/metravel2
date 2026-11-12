import { createContext, type ReactElement } from 'react'

/**
 * #3335: видимая страница каталога `/search?page=N` — указатель в подвале списка
 * (и в скелетоне до него) и номер страницы для canonical. `null` — указателя нет:
 * статика без SSR, фильтры, переход внутри приложения, другие списки.
 */
export type SearchCatalogVisiblePage = { page: number; footer: ReactElement | null }

export const SearchCatalogPageContext = createContext<SearchCatalogVisiblePage | null>(null)
