import { useState, type ReactNode } from 'react'
import { useLoaderData, useLocalSearchParams } from 'expo-router'
import { translate as i18nT } from '@/i18n'
import { parseSearchCatalogQuery, searchParamsEntries } from './searchCatalogPage'
import type { SearchCatalogLinks, SearchCatalogLinksPayload } from './searchCatalogLinksLoader'

const IS_SERVER = typeof window === 'undefined'

// Блок визуально скрыт: каталог на web листается внутри FlashList, а его на
// сервере нет (до замера ширины рисуется скелетон), так что видимому списку под
// карточками в серверном HTML некуда встать. Ссылки остаются в доступности, и
// при фокусе с клавиатуры блок показывается, как skip-link.
const NAV_CSS = `
[data-search-catalog-links]:not(:focus-within){position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0}
[data-search-catalog-links]:focus-within{padding:12px 16px;background:var(--color-background);color:var(--color-text);font-size:15px;line-height:1.8}
[data-search-catalog-links] ul{list-style:none;margin:0;padding:0}
[data-search-catalog-links] a{color:var(--color-primary)}
[data-search-catalog-links] a[rel]{margin-right:16px}
`

/** Разметка блока: одна и та же на сервере и при гидрации. */
export function SearchCatalogLinksNav({ data }: { data: SearchCatalogLinks }) {
  return (
    <nav
      aria-label={i18nT('shared:app.tabs.search.catalogPagesNav')}
      data-search-catalog-links={String(data.page)}
      data-testid="search-catalog-links"
    >
      <style>{NAV_CSS}</style>
      <ul>
        {data.links.map((link) => (
          <li key={link.path}>
            <a href={link.path}>{link.title}</a>
          </li>
        ))}
      </ul>
      {data.prevPath ? (
        <a href={data.prevPath} rel="prev">{i18nT('shared:components.ui.PaginationComponent.predyduschaya_stranitsa_b461eb43')}</a>
      ) : null}
      {data.nextPath ? (
        <a href={data.nextPath} rel="next">{i18nT('shared:components.ui.PaginationComponent.sleduyuschaya_stranitsa_b4472dd4')}</a>
      ) : null}
    </nav>
  )
}

/** Сервер: данные loader'а уже лежат в контексте запроса, сети нет. */
function ServerCatalogLinks() {
  const payload = useLoaderData() as SearchCatalogLinksPayload | undefined
  return payload ? <SearchCatalogLinksNav data={payload} /> : null
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
 * бы экран ошибки loader'а. При гидрации блок повторяется из серверного DOM; при
 * переходе внутри приложения его нет, а со сменой query (фильтры) он снимается.
 */
function HydratedCatalogLinks() {
  const query = parseSearchCatalogQuery(searchParamsEntries(useLocalSearchParams<Record<string, string | string[]>>()))
  const [server] = useState(readServerCatalogLinks)
  if (!server || query.kind !== 'catalog' || query.page !== server.page) return null
  return <SearchCatalogLinksNav data={server} />
}

/** #3323: ссылки на статьи страницы каталога и соседние страницы в серверном HTML /search. */
export default function SearchCatalogLinksBoundary({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {IS_SERVER ? <ServerCatalogLinks /> : <HydratedCatalogLinks />}
    </>
  )
}
