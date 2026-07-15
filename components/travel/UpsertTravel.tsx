import { useMemo } from 'react';
import { usePathname } from 'expo-router';

import {
  initFilters,
  normalizeCategoryTravelAddress,
  normalizeTravelCategories,
} from '@/hooks/useTravelFilters';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import UpsertTravelView from '@/components/travel/upsert/UpsertTravelView';
import { useUpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import { buildCanonicalUrl } from '@/utils/seo';
import { translate as i18nT } from '@/i18n'


export { initFilters, normalizeCategoryTravelAddress, normalizeTravelCategories };

export default function UpsertTravel() {
  const controller = useUpsertTravelController();
  const pathname = usePathname();

  const seo = useMemo(() => {
    const normalizedPath = pathname || (controller.isNew ? '/travel/new' : `/travel/${controller.formData?.id ?? ''}`);
    const titleBase = controller.isNew
      ? i18nT('travel:components.travel.UpsertTravel.sozdat_puteshestvie_448e27bb')
      : controller.formData?.name?.trim()
        ? i18nT('travel:components.travel.UpsertTravel.redaktirovat_puteshestvie_value1_b7c802d8', { value1: controller.formData.name.trim() })
        : i18nT('travel:components.travel.UpsertTravel.redaktirovat_puteshestvie_de5a1d0f');

    return {
      title: i18nT('travel:components.travel.UpsertTravel.value1_metravel_a966abc3', { value1: titleBase }),
      description: controller.isNew
        ? i18nT('travel:components.travel.UpsertTravel.sozdayte_novoe_puteshestvie_v_lichnom_kabine_ddbac667')
        : i18nT('travel:components.travel.UpsertTravel.redaktirovanie_puteshestviya_v_lichnom_kabin_bcca604d'),
      canonical: buildCanonicalUrl(normalizedPath),
      headKey: controller.isNew ? 'travel-upsert-new' : `travel-upsert-${controller.formData?.id ?? 'edit'}`,
    };
  }, [controller.formData?.id, controller.formData?.name, controller.isNew, pathname]);

  return (
    <>
      <InstantSEO
        headKey={seo.headKey}
        title={seo.title}
        description={seo.description}
        canonical={seo.canonical}
        robots="noindex, nofollow"
      />
      <UpsertTravelView controller={controller} />
    </>
  );
}
