/**
 * Названия страниц сайта для ссылки справочного ответа (#3369, хвост #3293).
 *
 * Запись справки несёт адрес страницы, к которой относится («/quests», «/app»), но не её название:
 * ссылка под ответом была подписана адресом — «metravel.by/quests». Название страницы — то же, что в
 * навигации сайта (`breadcrumb.*` в `i18n/locales/<локаль>/static/navigation_static.ts`); образ службы
 * ресурсов интерфейса не несёт, поэтому таблица лежит здесь, а тест
 * `__tests__/scripts/ai-assist/helpPages.test.ts` сверяет её с ресурсами и с адресами корпуса справки:
 * новое слово здесь не придумывается, новый адрес корпуса без названия красит тест.
 */
import type { Locale } from './search.ts'

/** Ключ навигации страницы по её пути; страницы без своего названия в навигации в таблицу не входят. */
export const HELP_PAGE_KEYS: Readonly<Record<string, string>> = {
  '/quests': 'breadcrumb.quests',
  '/about': 'breadcrumb.about',
  '/registration': 'breadcrumb.registration',
  '/app': 'breadcrumb.app',
  '/favorites': 'breadcrumb.favorites',
  '/calendar': 'breadcrumb.calendar',
  '/trips/my': 'breadcrumb.trips',
  '/travel/new': 'breadcrumb.newTravel',
  '/metravel': 'breadcrumb.metravel',
  '/map': 'breadcrumb.map',
  '/places': 'breadcrumb.places',
  '/search': 'breadcrumb.search',
  '/settings': 'breadcrumb.settings',
  '/contact': 'breadcrumb.contact',
  '/community-rules': 'breadcrumb.communityRules',
}

/** Адреса корпуса, у которых названия в навигации нет: ссылка подписывается адресом, как раньше. */
export const HELP_PAGES_WITHOUT_TITLE: readonly string[] = ['/quests/scenario']

export const HELP_PAGE_TITLES: Readonly<Record<string, Readonly<Record<Locale, string>>>> = {
  'breadcrumb.quests': { ru: 'Квесты', be: 'Квэсты', uk: 'Квести', pl: 'Questy', en: 'Quests' },
  'breadcrumb.about': { ru: 'О сайте', be: 'Аб сайце', uk: 'Про сайт', pl: 'O serwisie', en: 'About the site' },
  'breadcrumb.registration': { ru: 'Регистрация', be: 'Рэгістрацыя', uk: 'Реєстрація', pl: 'Rejestracja', en: 'Registration' },
  'breadcrumb.app': { ru: 'Приложение', be: 'Дадатак', uk: 'Додаток', pl: 'Aplikacja', en: 'Application' },
  'breadcrumb.favorites': { ru: 'Хочу поехать', be: 'Хачу паехаць', uk: 'Хочу поїхати', pl: 'Chcę pojechać', en: 'I want to go' },
  'breadcrumb.calendar': { ru: 'Мой календарь', be: 'Мой каляндар', uk: 'Мій календар', pl: 'Mój kalendarz', en: 'My calendar' },
  'breadcrumb.trips': { ru: 'Поездки', be: 'Паездкі', uk: 'Поїздки', pl: 'Wycieczki', en: 'Trips' },
  'breadcrumb.newTravel': { ru: 'Новое путешествие', be: 'Новае падарожжа', uk: 'Нова подорож', pl: 'Nowa podróż', en: 'New journey' },
  'breadcrumb.metravel': { ru: 'Мои путешествия', be: 'Мае вандроўкі', uk: 'Мої подорожі', pl: 'Moje podróże', en: 'My travels' },
  'breadcrumb.map': { ru: 'Карта', be: 'Карта', uk: 'Карта', pl: 'Mapa', en: 'Map' },
  'breadcrumb.places': { ru: 'Места', be: 'Месцы', uk: 'Місця', pl: 'Miejsca', en: 'Places' },
  'breadcrumb.search': { ru: 'Поиск', be: 'Пошук', uk: 'Пошук', pl: 'Szukaj', en: 'Search' },
  'breadcrumb.settings': { ru: 'Настройки', be: 'Налады', uk: 'Налаштування', pl: 'Ustawienia', en: 'Settings' },
  'breadcrumb.contact': { ru: 'Контакты', be: 'Кантакты', uk: 'Контакти', pl: 'Kontakty', en: 'Contacts' },
  'breadcrumb.communityRules': { ru: 'Правила сообщества', be: 'Правілы супольнасці', uk: 'Правила спільноти', pl: 'Zasady społeczności', en: 'Community Rules' },
}

/** Название страницы по адресу записи справки на языке ответа; `null` — у страницы названия нет. */
export const helpPageTitle = (url: string, locale: Locale): string | null => {
  let path: string
  try {
    path = new URL(url).pathname.replace(/\/+$/, '') || '/'
  } catch {
    return null
  }
  const key = HELP_PAGE_KEYS[path]
  return key ? (HELP_PAGE_TITLES[key]?.[locale] ?? null) : null
}
