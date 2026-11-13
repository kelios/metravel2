import React, { useMemo } from 'react'
import { Link, type Href } from 'expo-router'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'
import { buildQuestPath } from '@/utils/routePaths'
import { buildQuestLocalePath } from '@/utils/questLocaleRouting'
import type { SupportedLocale } from '@/i18n/config'
import type { QuestMeta } from './questsShared'

export type QuestDirectoryLink = { title: string; path: string }

/** Квесты первой страницы каталога: столько карточек отдаёт первый экран сетки. */
export const QUEST_DIRECTORY_QUEST_LIMIT = 24

const { spacing, typography, touchTarget } = DESIGN_TOKENS

// Ссылки идут сплошным текстом через разделитель: в каталоге сотни городов, и
// список построчно занял бы на телефоне несколько экранов. Раскладка — чистый CSS:
// блок не меряет ширину и одинаков на сервере и после гидратации (сетка карточек
// каталога ждёт гидратации именно из-за замера). Между `</li><li>` в серверном HTML
// нет пробела, поэтому единственная точка переноса строки — пробел после
// разделителя: без него браузер рвал названия посреди слова («Ген/т»).
const DIRECTORY_CSS = `
[data-quests-directory]{margin:${spacing.xl}px 0 ${spacing.xs}px;color:var(--color-text)}
[data-quests-directory] summary{min-height:${touchTarget.minHeight}px;padding:${spacing.xs}px 0;box-sizing:border-box;cursor:pointer}
[data-quests-directory] summary h2{display:inline;font-size:${typography.sizes.lg}px;line-height:1.3;margin:0}
[data-quests-directory] summary:focus-visible{outline:2px solid var(--color-primary);outline-offset:${spacing.xxs}px}
[data-quests-directory] ul{list-style:none;margin:0;padding:0;font-size:15px;line-height:2.2}
[data-quests-directory] li{display:inline}
[data-quests-directory] li:not(:last-child)::after{content:"· ";margin-left:10px;word-spacing:6px;color:var(--color-textMuted)}
[data-quests-directory] a{color:var(--color-primary);text-decoration:none}
@media (hover:hover) and (pointer:fine){[data-quests-directory] a:hover{text-decoration:underline}}
[data-quests-directory] a:focus-visible{text-decoration:underline}
`

type Props = {
  countries: readonly QuestDirectoryLink[]
  cities: readonly QuestDirectoryLink[]
  quests: readonly Pick<QuestMeta, 'id' | 'cityId' | 'title'>[]
  /** #3360: языковой хаб — ссылки на страницы его языка, все участники. */
  localeHub?: Exclude<SupportedLocale, 'ru'> | null
}

function DirectoryGroup({ title, links }: { title: string; links: QuestDirectoryLink[] }) {
  if (!links.length) return null
  return (
    <details>
      <summary><h2>{title}</h2></summary>
      <ul>
        {links.map((link) => (
          <li key={link.path}>
            <Link href={link.path as Href}>{link.title}</Link>
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * #3218: видимый указатель каталога квестов — страны, города и квесты первой
 * страницы обычными ссылками `<a href>`. Данные уже лежат в ответе загрузчика
 * `/quests` (`QuestDiscovery.countries/cities/quests`), поэтому блок попадает в
 * серверный HTML и не добавляет ни одного запроса.
 */
export default function QuestsCatalogDirectory({ countries, cities, quests, localeHub = null }: Props) {
  const questLinks = useMemo(() => {
    // У хаба нет указателя стран и городов, через который досягаемы остальные
    // квесты, поэтому он ссылается на каждого участника (#3360).
    const limit = localeHub ? Number.POSITIVE_INFINITY : QUEST_DIRECTORY_QUEST_LIMIT
    const links: QuestDirectoryLink[] = []
    for (const quest of quests) {
      if (links.length >= limit) break
      const path = localeHub ? buildQuestLocalePath(Number(quest.cityId), quest.id, localeHub) : buildQuestPath(quest.cityId, quest.id)
      if (path && quest.title) links.push({ title: quest.title, path })
    }
    return links
  }, [quests, localeHub])

  if (!countries.length && !cities.length && !questLinks.length) return null

  return (
    <nav
      aria-label={i18nT('quests:screens.tabs.QuestsCatalogDirectory.navLabel')}
      data-quests-directory
      data-testid="quests-catalog-directory"
    >
      <style>{DIRECTORY_CSS}</style>
      <DirectoryGroup title={i18nT('quests:screens.tabs.QuestsCatalogDirectory.countriesTitle')} links={[...countries]} />
      <DirectoryGroup title={i18nT('quests:screens.tabs.QuestsCatalogDirectory.citiesTitle')} links={[...cities]} />
      <DirectoryGroup title={i18nT('quests:screens.tabs.QuestsCatalogDirectory.questsTitle')} links={questLinks} />
    </nav>
  )
}
