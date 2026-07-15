import { TravelFormData } from '@/types/types';
import { translate as i18nT } from '@/i18n'


/**
 * ✅ ФАЗА 2: Умные подсказки (Contextual Tips)
 * Система подсказок, которая анализирует состояние формы и показывает релевантные советы
 */

export interface ContextualTip {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'tip';
  priority: number; // Чем меньше, тем важнее
  condition: (formData: TravelFormData) => boolean;
  action?: {
    label: string;
    step: number;
  };
}

/**
 * Библиотека контекстных подсказок для каждого шага
 */
export const CONTEXTUAL_TIPS: Record<number, ContextualTip[]> = {
  // Шаг 1: Основная информация
  1: [
    {
      id: 'name-too-short',
      get title() { return i18nT('sharedStatic:utils.contextualTips.nazvanie_slishkom_korotkoe_da76ecf4') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.dobavte_bolshe_detaley_v_nazvanie_naprimer_5_ee46f364') },
      type: 'tip',
      priority: 1,
      condition: (data) => {
        const name = data.name || '';
        return name.length > 0 && name.length < 15;
      },
    },
    {
      id: 'no-description',
      get title() { return i18nT('sharedStatic:utils.contextualTips.dobavte_opisanie_c0d8ec19') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.puteshestviya_s_opisaniem_poluchayut_na_60_b_fbfdea75') },
      type: 'info',
      priority: 2,
      condition: (data) => {
        const desc = data.description || '';
        return desc.length === 0;
      },
    },
    {
      id: 'description-too-short',
      get title() { return i18nT('sharedStatic:utils.contextualTips.opisanie_mozhno_rasshirit_238c9642') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.dobavte_bolshe_detaley_chto_uvideli_kakie_by_34fd1402') },
      type: 'tip',
      priority: 3,
      condition: (data) => {
        const desc = data.description || '';
        return desc.length > 0 && desc.length < 100;
      },
    },
  ],

  // Шаг 2: Маршрут
  2: [
    {
      id: 'no-points',
      get title() { return i18nT('sharedStatic:utils.contextualTips.dobavte_tochki_na_kartu_ccb261a3') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.ispolzuyte_poisk_po_nazvaniyu_mesta_eto_byst_258c25e0') },
      type: 'info',
      priority: 1,
      condition: (data) => {
        const points = (data as any).coordsMeTravel || [];
        return points.length === 0;
      },
    },
    {
      id: 'few-points',
      get title() { return i18nT('sharedStatic:utils.contextualTips.marshrut_mozhno_detalizirovat_9d1b0335') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.dobavte_bolshe_tochek_dlya_polnoty_marshruta_834be0d9') },
      type: 'tip',
      priority: 2,
      condition: (data) => {
        const points = (data as any).coordsMeTravel || [];
        return points.length > 0 && points.length < 3;
      },
    },
    {
      id: 'points-without-photos',
      get title() { return i18nT('sharedStatic:utils.contextualTips.dobavte_foto_k_tochkam_e134e627') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.u_vas_est_tochki_bez_fotografiy_foto_pomogay_d5f866b8') },
      type: 'tip',
      priority: 3,
      condition: (data) => {
        const points = (data as any).coordsMeTravel || [];
        const pointsWithoutPhotos = points.filter((p: any) => !p.image || p.image.trim() === '');
        return points.length > 0 && pointsWithoutPhotos.length > 0;
      },
    },
    {
      id: 'no-countries-selected',
      get title() { return i18nT('sharedStatic:utils.contextualTips.vyberite_strany_aa611d97') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.ukazhite_strany_marshruta_eto_pomogaet_drugi_a17bded4') },
      type: 'info',
      priority: 4,
      condition: (data) => {
        const countries = data.countries || [];
        return countries.length === 0;
      },
      action: {
        get label() { return i18nT('sharedStatic:utils.contextualTips.vybrat_strany_7ff922ae') },
        step: 2,
      },
    },
  ],

  // Шаг 3: Медиа
  3: [
    {
      id: 'no-cover',
      get title() { return i18nT('sharedStatic:utils.contextualTips.dobavte_oblozhku_5c6918e8') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.puteshestviya_s_oblozhkoy_poluchayut_v_3_raz_12feeb6d') },
      type: 'warning',
      priority: 1,
      condition: (data) => {
        return !(data as any).travel_image_thumb_small_url && !(data as any).travel_image_thumb_url;
      },
    },
    {
      id: 'cover-added',
      get title() { return i18nT('sharedStatic:utils.contextualTips.otlichno_25546d5e') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.oblozhka_dobavlena_dlya_luchshego_rezultata__a7ea6fc0') },
      type: 'success',
      priority: 5,
      condition: (data) => {
        return !!(data as any).travel_image_thumb_small_url || !!(data as any).travel_image_thumb_url;
      },
    },
  ],

  // Шаг 4: Детали
  4: [
    {
      id: 'add-practical-info',
      get title() { return i18nT('sharedStatic:utils.contextualTips.dobavte_prakticheskuyu_informatsiyu_cbcecd6c') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.ukazhite_byudzhet_dlitelnost_kolichestvo_uch_38da3271') },
      type: 'tip',
      priority: 2,
      condition: (data) => {
        return !(data as any).budget && !(data as any).number_days && !(data as any).number_peoples;
      },
    },
  ],

  // Шаг 5: Дополнительные параметры
  5: [
    {
      id: 'no-categories',
      get title() { return i18nT('sharedStatic:utils.contextualTips.vyberite_kategorii_ca7eadf2') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.kategorii_pomogayut_drugim_nayti_vash_marshr_05e16e21') },
      type: 'info',
      priority: 1,
      condition: (data) => {
        const categories = data.categories || [];
        return categories.length === 0;
      },
    },
    {
      id: 'add-transport',
      get title() { return i18nT('sharedStatic:utils.contextualTips.ukazhite_transport_8b305878') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.dobavte_vidy_transporta_eto_pomozhet_drugim__68c1d080') },
      type: 'tip',
      priority: 2,
      condition: (data) => {
        const transports = (data as any).transports || [];
        return transports.length === 0;
      },
    },
    {
      id: 'add-difficulty',
      get title() { return i18nT('sharedStatic:utils.contextualTips.ukazhite_slozhnost_9fee2580') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.uroven_fizicheskoy_podgotovki_pomogaet_putes_8fc831f0') },
      type: 'tip',
      priority: 3,
      condition: (data) => {
        const complexity = (data as any).complexity || [];
        return complexity.length === 0;
      },
    },
  ],

  // Шаг 6: Публикация
  6: [
    {
      id: 'ready-to-publish',
      get title() { return i18nT('sharedStatic:utils.contextualTips.gotovo_k_publikatsii_65bc0996') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.vse_obyazatelnye_polya_zapolneny_proverte_pr_95e3e715') },
      type: 'success',
      priority: 1,
      condition: (data) => {
        const name = (data.name || '').trim();
        const desc = (data.description || '').trim();
        const points = (data as any).coordsMeTravel || [];
        return name.length >= 3 && desc.length >= 50 && points.length >= 1;
      },
    },
    {
      id: 'missing-required',
      get title() { return i18nT('sharedStatic:utils.contextualTips.zapolnite_obyazatelnye_polya_7bbabeb2') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.dlya_publikatsii_nuzhny_nazvanie_min_3_simvo_c6caa236') },
      type: 'warning',
      priority: 1,
      condition: (data) => {
        const name = (data.name || '').trim();
        const desc = (data.description || '').trim();
        const points = (data as any).coordsMeTravel || [];
        return !(name.length >= 3 && desc.length >= 50 && points.length >= 1);
      },
    },
    {
      id: 'add-recommended',
      get title() { return i18nT('sharedStatic:utils.contextualTips.uluchshite_vidimost_56f842aa') },
      get message() { return i18nT('sharedStatic:utils.contextualTips.dobavte_rekomenduemye_polya_dlya_luchshey_vi_18e5a9be') },
      type: 'tip',
      priority: 2,
      condition: (data) => {
        const hasCountries = (data.countries || []).length > 0;
        const hasCategories = (data.categories || []).length > 0;
        const hasCover = !!(data as any).travel_image_thumb_small_url;
        return !hasCountries || !hasCategories || !hasCover;
      },
    },
  ],
};

/**
 * Получить релевантные подсказки для текущего шага
 */
export function getContextualTips(step: number, formData: TravelFormData): ContextualTip[] {
  const stepTips = CONTEXTUAL_TIPS[step] || [];

  return stepTips
    .filter(tip => tip.condition(formData))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3); // Показываем максимум 3 подсказки одновременно
}

/**
 * Получить самую важную подсказку для шага
 */
export function getTopTip(step: number, formData: TravelFormData): ContextualTip | null {
  const tips = getContextualTips(step, formData);
  return tips[0] || null;
}

/**
 * Проверить, есть ли критичные подсказки
 */
export function hasCriticalTips(step: number, formData: TravelFormData): boolean {
  const tips = getContextualTips(step, formData);
  return tips.some(tip => tip.type === 'warning' && tip.priority === 1);
}

