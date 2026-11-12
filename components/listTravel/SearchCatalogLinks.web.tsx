import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLoaderData, useLocalSearchParams } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { translate as i18nT } from '@/i18n'
import { useThemedColors } from '@/hooks/useTheme'
import { parseSearchCatalogQuery, searchParamsEntries } from './searchCatalogPage'
import { SearchCatalogPageContext, type SearchCatalogVisiblePage } from './searchCatalogPageContext'
import type { SearchCatalogLinks, SearchCatalogLinksPayload } from './searchCatalogLinksLoader'

const IS_SERVER = typeof window === 'undefined'

// Видимый подвал каталога (#3335): горизонтальные отступы даёт контейнер списка
// или скелетона, тач-цели не ниже 44px.
const NAV_CSS = `
[data-search-catalog-links]{margin:24px 0 8px;padding-top:16px;border-top:1px solid var(--color-borderStrong);color:var(--color-text);font-size:15px;line-height:1.45}
[data-search-catalog-links] h2{margin:0 0 4px;font-size:17px;font-weight:600;line-height:1.3}
[data-search-catalog-links] ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);column-gap:24px}
[data-search-catalog-links] li a{display:flex;align-items:center;min-height:44px;color:var(--color-primaryText);overflow-wrap:anywhere;text-underline-offset:3px}
[data-search-catalog-links] [data-pager]{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-top:12px}
[data-search-catalog-links] [data-pager] a{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border:1px solid var(--color-borderStrong);border-radius:999px;color:var(--color-primaryText);text-decoration:none}
[data-search-catalog-links] a[rel="next"]{margin-left:auto}
@media(min-width:768px){[data-search-catalog-links] ul{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:1280px){[data-search-catalog-links] ul{grid-template-columns:repeat(3,minmax(0,1fr))}}
`

/** Разметка указателя: одна и та же на сервере и при гидрации. */
export function SearchCatalogLinksNav({ data }: { data: SearchCatalogLinks }) {
  const colors = useThemedColors()
  return (
    <nav
      aria-label={i18nT('shared:app.tabs.search.catalogPagesNav')}
      data-search-catalog-links={String(data.page)}
      data-testid="search-catalog-links"
    >
      <style>{NAV_CSS}</style>
      <h2>{i18nT('shared:app.tabs.search.catalogPageHeading', { page: data.page })}</h2>
      <ul>
        {data.links.map((link) => (
          <li key={link.path}>
            <a href={link.path}>{link.title}</a>
          </li>
        ))}
      </ul>
      {data.prevPath || data.nextPath ? (
        <div data-pager="">
          {data.prevPath ? (
            <a href={data.prevPath} rel="prev">
              <Feather name="chevron-left" size={18} color={colors.primaryText} aria-hidden />
              {i18nT('shared:components.ui.PaginationComponent.predyduschaya_stranitsa_b461eb43')}
            </a>
          ) : null}
          {data.nextPath ? (
            <a href={data.nextPath} rel="next">
              {i18nT('shared:components.ui.PaginationComponent.sleduyuschaya_stranitsa_b4472dd4')}
              <Feather name="chevron-right" size={18} color={colors.primaryText} aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}
    </nav>
  )
}

/** Сервер: данные loader'а уже лежат в контексте запроса, сети нет. */
function useServerCatalogLinks(): SearchCatalogLinks | null {
  return (useLoaderData() as SearchCatalogLinksPayload | undefined) ?? null
}

/** Блок серверного HTML в данных: ссылки, номер страницы и соседние страницы. */
function readServerCatalogLinks(): SearchCatalogLinks | null {
  const nav = document.querySelector('nav[data-search-catalog-links]')
  const page = Number(nav?.getAttribute('data-search-catalog-links'))
  if (!nav || !Number.isInteger(page) || page < 1) return null
  const hrefOf = (selector: string) => nav.querySelector(selector)?.getAttribute('href') ?? null
  return {
    page,
    prevPath: hrefOf('a[rel="prev"]'),
    nextPath: hrefOf('a[rel="next"]'),
    links: Array.from(nav.querySelectorAll('li > a'), (anchor) => ({
      path: anchor.getAttribute('href') ?? '',
      title: anchor.textContent ?? '',
    })),
  }
}

/**
 * Клиент loader НЕ читает: `/_expo/loaders/(tabs)/search` nginx не проксирует,
 * `useLoaderData` без данных в HTML ушёл бы туда за 404, и вместо каталога встал
 * бы экран ошибки loader'а. При гидрации указатель повторяется из серверного DOM;
 * при переходе внутри приложения его нет, со сменой параметров маршрута он
 * снимается, а смену поиска и фильтров внутри списка сообщает сам список (`dismiss`).
 */
function useHydratedCatalogLinks(): SearchCatalogLinks | null {
  const query = parseSearchCatalogQuery(searchParamsEntries(useLocalSearchParams<Record<string, string | string[]>>()))
  const [server] = useState(readServerCatalogLinks)
  return server && query.kind === 'catalog' && query.page === server.page ? server : null
}

const useCatalogLinks = IS_SERVER ? useServerCatalogLinks : useHydratedCatalogLinks

/**
 * #3323/#3335: ссылки на статьи страницы каталога и соседние страницы. Указатель
 * рисует подвал списка (`RightColumn`) и скелетон до него — в серверном HTML и
 * после гидрации он стоит на одном месте, ниже карточек первого экрана.
 */
export default function SearchCatalogLinksBoundary({ children }: { children: ReactNode }) {
  const data = useCatalogLinks()
  const [dismissed, setDismissed] = useState(false)
  const dismiss = useCallback(() => setDismissed(true), [])
  const value = useMemo<SearchCatalogVisiblePage | null>(
    () => (data && !dismissed ? { page: data.page, footer: <SearchCatalogLinksNav data={data} />, dismiss } : null),
    [data, dismiss, dismissed],
  )
  return <SearchCatalogPageContext.Provider value={value}>{children}</SearchCatalogPageContext.Provider>
}
