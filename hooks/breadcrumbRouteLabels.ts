// Подписи сегментов маршрутов для модели крошек `useBreadcrumbModel`.
// Вынесено из хука (#2121), чтобы таблицы подписей росли отдельно от логики.

import { translate as i18nT } from '@/i18n';

export const pageTranslations: Record<string, string> = {
  get travelsby() { return i18nT('navigationStatic:breadcrumb.travelsby') },
  get map() { return i18nT('navigationStatic:breadcrumb.map') },
  get quests() { return i18nT('navigationStatic:breadcrumb.quests') },
  get roulette() { return i18nT('navigationStatic:breadcrumb.roulette') },
  get article() { return i18nT('navigationStatic:breadcrumb.article') },
  get travel() { return i18nT('navigationStatic:breadcrumb.travel') },
  get profile() { return i18nT('navigationStatic:breadcrumb.profile') },
  get login() { return i18nT('navigationStatic:breadcrumb.login') },
  get registration() { return i18nT('navigationStatic:breadcrumb.registration') },
  get metravel() { return i18nT('navigationStatic:breadcrumb.metravel') },
  get about() { return i18nT('navigationStatic:breadcrumb.about') },
  get export() { return i18nT('navigationStatic:breadcrumb.export') },
  get settings() { return i18nT('navigationStatic:breadcrumb.settings') },
  get history() { return i18nT('navigationStatic:breadcrumb.history') },
  get favorites() { return i18nT('navigationStatic:breadcrumb.favorites') },
  get accountconfirmation() { return i18nT('navigationStatic:breadcrumb.accountconfirmation') },
  get 'set-password'() { return i18nT('navigationStatic:breadcrumb.setPassword') },
  get new() { return i18nT('navigationStatic:breadcrumb.newTravel') },
  get userpoints() { return i18nT('navigationStatic:breadcrumb.userpoints') },
  get messages() { return i18nT('navigationStatic:breadcrumb.messages') },
  get subscriptions() { return i18nT('navigationStatic:breadcrumb.subscriptions') },
  get contact() { return i18nT('navigationStatic:breadcrumb.contact') },
  get places() { return i18nT('navigationStatic:breadcrumb.places') },
  get articles() { return i18nT('navigationStatic:breadcrumb.articles') },
  get calendar() { return i18nT('navigationStatic:breadcrumb.calendar') },
  get search() { return i18nT('navigationStatic:breadcrumb.search') },
  get cookies() { return i18nT('navigationStatic:breadcrumb.cookies') },
  get privacy() { return i18nT('navigationStatic:breadcrumb.privacy') },
  get register() { return i18nT('navigationStatic:breadcrumb.register') },
  get terms() { return i18nT('navigationStatic:breadcrumb.terms') },
  get disclaimer() { return i18nT('navigationStatic:breadcrumb.disclaimer') },
  get 'community-rules'() { return i18nT('navigationStatic:breadcrumb.communityRules') },
  get 'trip-rules'() { return i18nT('navigationStatic:breadcrumb.tripRules') },
  get 'security-journal'() { return i18nT('navigationStatic:breadcrumb.securityJournal') },
  get 'privacy-settings'() { return i18nT('navigationStatic:breadcrumb.privacySettings') },
  get trips() { return i18nT('navigationStatic:breadcrumb.trips') },
  get plan() { return i18nT('navigationStatic:breadcrumb.plan') },
  get create() { return i18nT('navigationStatic:breadcrumb.create') },
  get app() { return i18nT('navigationStatic:breadcrumb.app') },
  get offline() { return i18nT('offline:title') },
};

// Страницы, вложенные по файлу роута, но самостоятельные (ссылки из писем
// рассылки, #2121): промежуточного маршрута `/subscribe` нет, поэтому общий
// цикл по сегментам дал бы крошку-тупик и сырой сегмент вместо подписи.
export const STANDALONE_NESTED_ROUTE_LABELS: Record<string, () => string> = {
  '/subscribe/confirm': () => i18nT('navigationStatic:breadcrumb.subscribeConfirm'),
  '/subscribe/unsubscribe': () => i18nT('navigationStatic:breadcrumb.subscribeUnsubscribe'),
};
