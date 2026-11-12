import type { SupportedLocale } from '@/i18n/config'
import QuestsScreen from '@/screens/tabs/QuestsScreenRoute'
import QuestDiscoveryLoaderBoundary from './QuestDiscoveryLoaderBoundary.web'

type Props = { localeHub: Exclude<SupportedLocale, 'ru'> }

/**
 * Каталог языкового хаба `/{locale}/quests` (#3217, #3360) с участниками из
 * загрузчика страницы. Catch-all грузит его лениво: статический импорт границы
 * в `app/[...missing].web.tsx` добавлял catch-all к владельцам границы и её
 * провода, и слияние чанков переносило `QuestsSeoIntroFaq` в чанк каталога —
 * +14 КБ к `__shared:quests-catalog` и весь каталог чужим кодом на
 * `/quests/scenario` (s39-B, ROUTE-BUNDLE-001).
 */
export default function QuestLocaleHubCatalog({ localeHub }: Props) {
  const catalog = <QuestsScreen localeHub={localeHub} />
  return process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR === 'true'
    ? <QuestDiscoveryLoaderBoundary>{catalog}</QuestDiscoveryLoaderBoundary>
    : catalog
}
