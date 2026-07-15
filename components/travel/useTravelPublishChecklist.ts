import { useMemo } from 'react';
import type { TravelFormData } from '@/types/types';
import { getModerationIssues, type ModerationIssue } from '@/utils/formValidation';
import { getQualityScore } from '@/utils/travelWizardValidation';
import { translate as i18nT } from '@/i18n'


type UnknownRecord = Record<string, unknown>;

type ChecklistItem = {
  key: string;
  label: string;
  detail?: string;
  benefit?: string;
  ok: boolean;
  required?: boolean;
};

const getLegacyArray = (data: UnknownRecord, key: string): unknown[] => {
  const value = data[key];
  return Array.isArray(value) ? value : [];
};

export const useTravelPublishChecklist = (formData: TravelFormData) => {
  const routePoints = useMemo(() => {
    const data = formData as unknown as UnknownRecord;
    const coords = getLegacyArray(data, 'coordsMeTravel');
    if (coords.length > 0) return coords;
    return getLegacyArray(data, 'markers');
  }, [formData]);

  const galleryItems = useMemo(() => {
    const gallery = (formData.gallery ?? []) as unknown[];
    return Array.isArray(gallery) ? gallery : [];
  }, [formData.gallery]);

  const requiredChecklist = useMemo<ChecklistItem[]>(() => {
    const hasName = !!formData.name && formData.name.trim().length >= 3;
    const hasDescription = !!formData.description && formData.description.trim().length >= 50;
    const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
    const hasCategories = Array.isArray(formData.categories) && formData.categories.length > 0;
    const hasRoute = routePoints.length > 0;
    const hasCover = !!formData.travel_image_thumb_small_url;
    const hasPhotos = hasCover || galleryItems.length > 0;

    return [
      { key: 'name', label: i18nT('travel:components.travel.useTravelPublishChecklist.nazvanie_marshruta_3f5fd620'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.minimum_3_simvola_6627ac3c'), ok: hasName, required: true },
      { key: 'description', label: i18nT('travel:components.travel.useTravelPublishChecklist.opisanie_marshruta_e77b9baa'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.minimum_50_simvolov_0da73d52'), ok: hasDescription, required: true },
      { key: 'route', label: i18nT('travel:components.travel.useTravelPublishChecklist.marshrut_na_karte_4463d1b9'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.minimum_1_tochka_shag_2_ee6b3e68'), ok: hasRoute, required: true },
      { key: 'countries', label: i18nT('travel:components.travel.useTravelPublishChecklist.strany_marshruta_91145fda'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.minimum_1_strana_shag_2_ccfa6f24'), ok: hasCountries, required: true },
      { key: 'categories', label: i18nT('travel:components.travel.useTravelPublishChecklist.kategorii_marshruta_81500fea'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.minimum_1_kategoriya_shag_5_79d7518c'), ok: hasCategories, required: true },
      { key: 'photos', label: i18nT('travel:components.travel.useTravelPublishChecklist.foto_ili_oblozhka_5874111e'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.oblozhka_ili_1_foto_shag_3_7dd535ea'), ok: hasPhotos, required: true },
    ];
  }, [
    formData.categories,
    formData.countries,
    formData.description,
    formData.name,
    formData.travel_image_thumb_small_url,
    galleryItems.length,
    routePoints.length,
  ]);

  const recommendedChecklist = useMemo<ChecklistItem[]>(() => {
    const hasPlus = !!formData.plus && formData.plus.trim().length >= 10;
    const hasMinus = !!formData.minus && formData.minus.trim().length >= 10;
    const hasRecommendation = !!formData.recommendation && formData.recommendation.trim().length >= 10;
    const hasVideo = !!formData.youtube_link && formData.youtube_link.trim().length > 0;
    const hasGallery3 = galleryItems.length >= 3;

    return [
      { key: 'plus', label: i18nT('travel:components.travel.useTravelPublishChecklist.plyusy_marshruta_b9d8d4b4'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.opishite_preimuschestva_shag_4_1567b1f1'), benefit: i18nT('travel:components.travel.useTravelPublishChecklist.povyshaet_doverie_chitateley_a07f4e63'), ok: hasPlus },
      { key: 'minus', label: i18nT('travel:components.travel.useTravelPublishChecklist.minusy_marshruta_f083b6fd'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.ukazhite_nedostatki_shag_4_dfc31708'), benefit: i18nT('travel:components.travel.useTravelPublishChecklist.pomogaet_prinyat_reshenie_171de921'), ok: hasMinus },
      { key: 'recommendation', label: i18nT('travel:components.travel.useTravelPublishChecklist.rekomendatsii_i_layfhaki_8f5cef9b'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.podelites_sovetami_shag_4_76eecab2'), benefit: i18nT('travel:components.travel.useTravelPublishChecklist.uvelichivaet_tsennost_marshruta_ee350669'), ok: hasRecommendation },
      { key: 'gallery3', label: i18nT('travel:components.travel.useTravelPublishChecklist.minimum_3_foto_v_galeree_7ea4c6df'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.seychas_value1_foto_shag_3_9d2ca97a', { value1: galleryItems.length }), benefit: i18nT('travel:components.travel.useTravelPublishChecklist.marshruty_s_foto_poluchayut_bolshe_prosmotro_d11e6185'), ok: hasGallery3 },
      { key: 'video', label: i18nT('travel:components.travel.useTravelPublishChecklist.video_o_puteshestvii_7045907e'), detail: i18nT('travel:components.travel.useTravelPublishChecklist.youtube_ssylka_shag_3_01055795'), benefit: i18nT('travel:components.travel.useTravelPublishChecklist.video_povyshaet_vovlechennost_7ca45a3f'), ok: hasVideo },
    ];
  }, [formData.plus, formData.minus, formData.recommendation, formData.youtube_link, galleryItems.length]);

  const checklist = useMemo<ChecklistItem[]>(() => {
    const hasName = !!formData.name && formData.name.trim().length > 0;
    const hasDescription = !!formData.description && formData.description.trim().length > 0;
    const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
    const hasCategories = Array.isArray(formData.categories) && formData.categories.length > 0;
    const hasRoute = routePoints.length > 0;
    const hasCover = !!formData.travel_image_thumb_small_url;
    const hasPhotos = hasCover || galleryItems.length > 0;

    return [
      { key: 'name', label: i18nT('travel:components.travel.useTravelPublishChecklist.nazvanie_marshruta_ne_menee_3_simvolov_10548c4e'), ok: hasName },
      { key: 'description', label: i18nT('travel:components.travel.useTravelPublishChecklist.opisanie_dlya_kogo_marshrut_i_chego_ozhidat__db49628e'), ok: hasDescription },
      { key: 'countries', label: i18nT('travel:components.travel.useTravelPublishChecklist.strany_marshruta_minimum_odna_vybirayutsya_n_b5e6a718'), ok: hasCountries },
      { key: 'categories', label: i18nT('travel:components.travel.useTravelPublishChecklist.kategorii_marshruta_minimum_odna_vybirayutsy_7333f07f'), ok: hasCategories },
      { key: 'route', label: i18nT('travel:components.travel.useTravelPublishChecklist.marshrut_na_karte_minimum_odna_tochka_na_sha_ce6389ab'), ok: hasRoute },
      { key: 'photos', label: i18nT('travel:components.travel.useTravelPublishChecklist.foto_ili_oblozhka_marshruta_rekomenduem_gori_cdfe3c6c'), ok: hasPhotos },
    ];
  }, [
    formData.categories,
    formData.countries,
    formData.description,
    formData.name,
    formData.travel_image_thumb_small_url,
    galleryItems.length,
    routePoints.length,
  ]);

  const moderationIssues = useMemo(() => {
    return getModerationIssues({
      name: formData.name ?? '',
      description: formData.description ?? '',
      countries: formData.countries ?? [],
      categories: formData.categories ?? [],
      coordsMeTravel: routePoints,
      gallery: galleryItems,
      travel_image_thumb_small_url: formData.travel_image_thumb_small_url ?? null,
    });
  }, [
    formData.categories,
    formData.countries,
    formData.description,
    formData.name,
    formData.travel_image_thumb_small_url,
    galleryItems,
    routePoints,
  ]);

  const moderationIssuesByKey = useMemo(() => {
    const map = new Map<string, ModerationIssue>();
    moderationIssues.forEach((issue) => map.set(issue.key, issue));
    return map;
  }, [moderationIssues]);

  const qualityScore = useMemo(() => getQualityScore(formData), [formData]);

  return {
    routePoints,
    galleryItems,
    requiredChecklist,
    recommendedChecklist,
    checklist,
    moderationIssues,
    moderationIssuesByKey,
    qualityScore,
  };
};
