/**
 * Toast notifications для страницы карты
 * Обеспечивает обратную связь пользователю при действиях на карте
 */

import { showToast } from './toast';
import { translate as i18nT } from '@/i18n'


/**
 * Показать уведомление об успешном построении маршрута
 */
export function showRouteBuiltToast(distanceKm: number, durationMinutes: number): void {
  showToast({
    type: 'success',
    text1: i18nT('errors:utils.mapToasts.marshrut_postroen_7a2dcd0e'),
    text2: i18nT('errors:utils.mapToasts.value1_km_value2_min_23ca0a65', { value1: distanceKm.toFixed(1), value2: Math.round(durationMinutes) }),
    position: 'bottom',
    visibilityTime: 3000,
  });
}

/**
 * Показать уведомление об ошибке построения маршрута
 */
export function showRouteErrorToast(errorMessage?: string): void {
  showToast({
    type: 'error',
    text1: i18nT('errors:utils.mapToasts.ne_udalos_postroit_marshrut_a8416ccb'),
    text2: errorMessage || i18nT('map:utils.mapToasts.poprobuyte_izmenit_tochki_ili_transport_207bdb8d'),
    position: 'bottom',
    visibilityTime: 4000,
  });
}

/**
 * Показать уведомление об очистке маршрута
 */
export function showRouteClearedToast(): void {
  showToast({
    type: 'info',
    text1: i18nT('errors:utils.mapToasts.marshrut_ochischen_586f3d94'),
    text2: i18nT('errors:utils.mapToasts.tochki_starta_i_finisha_sbrosheny_25ebd532'),
    position: 'bottom',
    visibilityTime: 2000,
  });
}

/**
 * Показать уведомление об отказе/недоступности геолокации
 */
export function showGeolocationErrorToast(): void {
  showToast({
    type: 'error',
    text1: i18nT('errors:utils.mapToasts.ne_udalos_opredelit_mestopolozhenie_fdd81804'),
    text2: i18nT('errors:utils.mapToasts.razreshite_dostup_k_geolokatsii_v_nastroykah_bb21887c'),
    position: 'bottom',
    visibilityTime: 4000,
  });
}

/**
 * Показать уведомление о сбросе фильтров
 */
export function showFiltersResetToast(): void {
  showToast({
    type: 'info',
    text1: i18nT('errors:utils.mapToasts.filtry_sbrosheny_f4c70142'),
    text2: i18nT('errors:utils.mapToasts.pokazyvaem_vse_mesta_8b070c80'),
    position: 'bottom',
    visibilityTime: 2000,
  });
}

/**
 * Показать уведомление о центрировании на пользователе
 */
export function showCenterOnUserToast(): void {
  showToast({
    type: 'info',
    text1: i18nT('errors:utils.mapToasts.pokazyvaem_vashe_mestopolozhenie_cfb96c02'),
    position: 'bottom',
    visibilityTime: 2000,
  });
}

/**
 * Показать уведомление о добавлении точки маршрута
 */
export function showRoutePointAddedToast(pointNumber: number, isFirst: boolean): void {
  const message = isFirst
    ? i18nT('errors:utils.mapToasts.tochka_a_dobavlena_dobavte_tochku_b_dlya_pos_2c0abe39')
    : i18nT('errors:utils.mapToasts.tochka_value1_dobavlena_133064a2', { value1: String.fromCharCode(64 + pointNumber) });

  showToast({
    type: 'success',
    text1: message,
    position: 'bottom',
    visibilityTime: 2500,
  });
}

/**
 * Показать инструкцию при переключении в режим маршрута
 */
export function showRouteModeTip(): void {
  showToast({
    type: 'info',
    text1: i18nT('errors:utils.mapToasts.nazhmite_na_karte_dlya_dobavleniya_tochek_59a2a685'),
    text2: i18nT('errors:utils.mapToasts.minimum_2_tochki_dlya_postroeniya_marshruta_501ab977'),
    position: 'bottom',
    visibilityTime: 4000,
  });
}

/**
 * Показать уведомление о скопированной ссылке
 */
export function showLinkCopiedToast(): void {
  showToast({
    type: 'success',
    text1: i18nT('errors:utils.mapToasts.ssylka_skopirovana_56361b47'),
    text2: i18nT('errors:utils.mapToasts.podelites_marshrutom_s_druzyami_400d3733'),
    position: 'bottom',
    visibilityTime: 2500,
  });
}

/**
 * Показать уведомление об ошибке сети
 */
export function showNetworkErrorToast(): void {
  showToast({
    type: 'error',
    text1: i18nT('errors:utils.mapToasts.net_soedineniya_96b1d539'),
    text2: i18nT('errors:utils.mapToasts.proverte_internet_i_poprobuyte_snova_2ae0c3f9'),
    position: 'bottom',
    visibilityTime: 4000,
  });
}

/**
 * Показать уведомление о применении фильтров
 */
export function showFiltersAppliedToast(placesCount: number): void {
  const text = placesCount === 0
    ? i18nT('errors:utils.mapToasts.mest_ne_naydeno_2419bda8')
    : i18nT('errors:utils.mapToasts.naydeno_mest_value1_e03e2a28', { value1: placesCount });

  showToast({
    type: placesCount > 0 ? 'success' : 'info',
    text1: text,
    text2: placesCount === 0 ? i18nT('errors:utils.mapToasts.poprobuyte_izmenit_filtry_1801f962') : undefined,
    position: 'bottom',
    visibilityTime: 2000,
  });
}
