/* global module */

// #2740: единая таблица SEO статических web-маршрутов.
//
// Один источник строк для двух потребителей: `generateMetadata` в файлах
// маршрутов `app/**` (экспорт Expo SDK 58 пишет head без helmet) и
// `scripts/generate-seo-pages.js` (SSG дописывает breadcrumb/h1/skeleton поверх
// того же head). Значения — исторические литералы STATIC_PAGES генератора и
// RU-ключи `seoStatic:*`, поэтому прод-HTML остаётся байт-в-байт прежним.
// Расхождения с рантайм-строками экранов (`/about`, `/search`, `/articles`)
// сохранены намеренно: правка SEO-текста требует отдельного «да» владельца.
//
// Plain CommonJS без импортов из приложения: модуль читают и Metro (через
// `@/utils/seoRoutes/staticRoutes`), и Node-скрипты (`require`).

const DEFAULT_OG_IMAGE_PATH = '/assets/icons/logo_yellow_512x512.png';
const HOME_OG_IMAGE_PATH = '/og-home.jpg';
const MAP_OG_IMAGE_PATH = '/og-map.png';
const SOCIAL_IMAGE_WIDTH = 1200;
const SOCIAL_IMAGE_HEIGHT = 630;

const STATIC_ROUTE_SEO = Object.freeze([
  {
    route: '/',
    titleKey: 'seoStatic:root.home.title',
    descriptionKey: 'seoStatic:root.home.description',
    imagePath: HOME_OG_IMAGE_PATH,
    imageWidth: SOCIAL_IMAGE_WIDTH,
    imageHeight: SOCIAL_IMAGE_HEIGHT,
    // `#root` is empty in the static export, so the runtime H1 from index.tsx
    // never reaches the raw HTML — Googlebot saw a page with zero H1 (audit
    // 2026-08-08). The shell title is a <div> on purpose (LCP candidate), so the
    // semantic H1 is injected out of flow, exactly as travel pages do it.
    h1: 'Идеи поездок на выходные и книга путешествий',
  },
  {
    route: '/about',
    title: 'О проекте MeTravel — сообщество путешественников | Metravel',
    description:
      'MeTravel объединяет путешественников: публикуйте маршруты, сохраняйте полезные места, читайте истории и собирайте собственную книгу поездок.',
    breadcrumb: 'О проекте',
  },
  {
    route: '/become-author',
    titleKey: 'seoStatic:root.becomeAuthor.title',
    descriptionKey: 'seoStatic:root.becomeAuthor.description',
    breadcrumbKey: 'homeStatic:becomeAuthor.title',
  },
  {
    route: '/contact',
    title: 'Контакты и обратная связь | Metravel',
    description:
      'Свяжитесь с командой Metravel: вопросы, предложения, идеи партнерства и обратная связь по маршрутам, статьям и сервису.',
    breadcrumb: 'Контакты',
  },
  {
    route: '/search',
    title: 'Поиск маршрутов и идей путешествий по Беларуси | Metravel',
    description:
      'Ищите путешествия по странам, городам, категориям и датам, применяйте фильтры и быстро находите маршруты, вдохновение и советы для следующей поездки.',
    breadcrumb: 'Поиск маршрутов',
  },
  {
    route: '/map',
    title: 'Карта маршрутов и достопримечательностей | MeTravel',
    description:
      'Изучайте интерактивную карту путешествий: находите маршруты, достопримечательности и точки интереса, включайте фильтры и стройте путь под свои планы.',
    imagePath: MAP_OG_IMAGE_PATH,
    imageWidth: SOCIAL_IMAGE_WIDTH,
    imageHeight: SOCIAL_IMAGE_HEIGHT,
    breadcrumb: 'Карта маршрутов',
    h1: 'Карта маршрутов и достопримечательностей',
  },
  {
    route: '/articles',
    title: 'Статьи о путешествиях, маршрутах и советах | Metravel',
    description: 'Читай статьи и заметки путешественников. Полезные советы, маршруты и лайфхаки.',
    robots: 'noindex, nofollow',
  },
  {
    // Filterable catalog with no per-place URLs: the static HTML carries ~600
    // chars of text and not a single link to a place, yet the page was open to
    // indexing and outside the sitemap — an indexable empty page Google did not
    // know (audit 2026-08-08). Closed until it has crawlable content; turning it
    // into a real hub (intro + place links + categories) is a separate feature.
    route: '/places',
    title: 'Места на карте: замки, музеи, парки и природа | Metravel',
    description:
      'Каталог мест MeTravel: замки, усадьбы, музеи, парки, водопады и другие точки из путешествий — с фильтрами по стране, категории и рейтингу.',
    robots: 'noindex, follow',
  },
  {
    // There is no `/article` screen — only `/article/[id]`. Without a file here
    // nginx fell back to index.html, so the address answered 200 with the home
    // title, description and `canonical: https://metravel.by/` — declaring itself
    // a duplicate of the home page (audit 2026-08-08).
    route: '/article',
    title: 'Статьи о путешествиях, маршрутах и советах | Metravel',
    description: 'Читай статьи и заметки путешественников. Полезные советы, маршруты и лайфхаки.',
    robots: 'noindex, nofollow',
  },
  {
    // #2375: один источник правды с клиентом (`+html.tsx` и `seo_static.ts`) —
    // иначе статический HTML и гидратированная страница спорили о title/description.
    route: '/roulette',
    titleKey: 'seoStatic:root.roulette.title',
    descriptionKey: 'seoStatic:root.roulette.description',
    breadcrumb: 'Рулетка маршрутов',
  },
  {
    route: '/favorites',
    title: 'Избранные маршруты и места | Metravel',
    description: 'Твои сохранённые путешествия и маршруты.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/privacy',
    title: 'Политика конфиденциальности и данных | Metravel',
    description: 'Политика конфиденциальности и обработки персональных данных MeTravel.',
    breadcrumb: 'Политика конфиденциальности',
  },
  {
    route: '/cookies',
    title: 'Настройки cookies и аналитики | Metravel',
    description: 'Управление настройками cookies и аналитики на MeTravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/login',
    title: 'Вход в Metravel: аккаунт, маршруты и избранное | Metravel',
    description:
      'Войдите в аккаунт Metravel, чтобы сохранять маршруты, управлять избранным, публиковать поездки и собирать личную книгу путешествий.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/registration',
    title: 'Регистрация в Metravel: аккаунт и маршруты | Metravel',
    description:
      'Создайте аккаунт Metravel, чтобы публиковать маршруты, сохранять идеи поездок, подписываться на авторов и вести личную книгу путешествий.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/register',
    canonicalRoute: '/registration',
    title: 'Регистрация в Metravel: аккаунт и маршруты | Metravel',
    description:
      'Создайте аккаунт Metravel, чтобы публиковать маршруты, сохранять идеи поездок, подписываться на авторов и вести личную книгу путешествий.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/accountconfirmation',
    title: 'Подтверждение аккаунта | Metravel',
    description: 'Подтверждение учётной записи Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/set-password',
    title: 'Смена пароля | Metravel',
    description: 'Смена пароля в аккаунте Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/subscribe/confirm',
    title: 'Подтверждение подписки | Metravel',
    description: 'Подтверждение подписки на рассылку Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/subscribe/unsubscribe',
    title: 'Отписка от рассылки | Metravel',
    description: 'Отписка от рассылки Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/travelsby',
    title: 'Что посмотреть в Беларуси: места и маршруты | Metravel',
    description:
      'Что посмотреть в Беларуси: замки, усадьбы, озёра, города и готовые маршруты на выходные. Фото, карта, координаты и советы путешественников.',
    breadcrumb: 'Путешествия',
  },
  {
    route: '/quests',
    title: 'Городские квесты и маршруты с заданиями | Metravel',
    description:
      'Проходите городские квесты Metravel: маршруты с заданиями, точками на карте и идеями для прогулок и поездок.',
    breadcrumb: 'Квесты',
  },
  {
    route: '/quests/scenario',
    // 68 chars did not fit the SERP budget (≤60); "по городу" survives in the H1
    // and the description, so the keyword phrase is not lost. Description was 165.
    title: 'Готовый сценарий квеста — распечатать бесплатно | Metravel',
    description:
      'Готовый сценарий квеста по городу: распечатайте бесплатный квест-бук с картой, заданиями, дипломом и страницей ведущего. Для дня рождения, семьи и класса.',
    breadcrumb: 'Сценарий квеста',
  },
  {
    route: '/history',
    title: 'История просмотров маршрутов | Metravel',
    description: 'Хронология твоих путешествий и поездок.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/messages',
    title: 'Сообщения | Metravel',
    description: 'Личные сообщения Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/export',
    title: 'Экспорт | Metravel',
    description: 'Экспорт данных и материалов Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/metravel',
    title: 'Мои путешествия | Metravel',
    description: 'Раздел управления вашими путешествиями.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/profile',
    title: 'Профиль | Metravel',
    description: 'Профиль пользователя Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/settings',
    title: 'Настройки | Metravel',
    description: 'Настройки аккаунта Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/subscriptions',
    title: 'Подписки | Metravel',
    description: 'Ваши подписки и подписчики в Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/quests/map',
    title: 'Карта квестов | Metravel',
    description: 'Карта всех квестов Metravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/userpoints',
    title: 'Мои точки и сохраненные места | Metravel',
    description: 'Управляй своими точками на карте.',
    robots: 'noindex, nofollow',
  },
]);

function requireText(value, what) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Static route SEO: missing ${what}`);
  }
  return value;
}

/**
 * Разворачивает запись таблицы в плоские строки.
 * @param {string} route
 * @param {(key: string) => string} t переводчик RU-ключей: генератор передаёт
 *   `readRequiredRuTranslation`, маршрут — `translate` из `@/i18n`.
 */
function resolveStaticRouteSeo(route, t) {
  const entry = STATIC_ROUTE_SEO.find((item) => item.route === route);
  if (!entry) return null;
  const read = (literal, key, what) => (key ? requireText(t(key), `${what} (${key})`) : requireText(literal, what));
  return {
    route: entry.route,
    canonicalRoute: entry.canonicalRoute || entry.route,
    title: read(entry.title, entry.titleKey, `${route} title`),
    description: read(entry.description, entry.descriptionKey, `${route} description`),
    robots: entry.robots,
    imagePath: entry.imagePath || DEFAULT_OG_IMAGE_PATH,
    imageWidth: entry.imageWidth,
    imageHeight: entry.imageHeight,
    breadcrumb: entry.breadcrumbKey ? requireText(t(entry.breadcrumbKey), `${route} breadcrumb`) : entry.breadcrumb,
    h1: entry.h1,
  };
}

function listStaticRouteSeo(t) {
  return STATIC_ROUTE_SEO.map((entry) => resolveStaticRouteSeo(entry.route, t));
}

function listStaticRoutes() {
  return STATIC_ROUTE_SEO.map((entry) => entry.route);
}

module.exports = {
  DEFAULT_OG_IMAGE_PATH,
  HOME_OG_IMAGE_PATH,
  MAP_OG_IMAGE_PATH,
  SOCIAL_IMAGE_WIDTH,
  SOCIAL_IMAGE_HEIGHT,
  STATIC_ROUTE_SEO,
  resolveStaticRouteSeo,
  listStaticRouteSeo,
  listStaticRoutes,
};
