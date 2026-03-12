import React, { useMemo } from 'react';
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

export { initFilters, normalizeCategoryTravelAddress, normalizeTravelCategories };

export default function UpsertTravel() {
  const controller = useUpsertTravelController();
  const pathname = usePathname();

  const seo = useMemo(() => {
    const normalizedPath = pathname || (controller.isNew ? '/travel/new' : `/travel/${controller.formData?.id ?? ''}`);
    const titleBase = controller.isNew
      ? 'Создать путешествие'
      : controller.formData?.name?.trim()
        ? `Редактировать путешествие: ${controller.formData.name.trim()}`
        : 'Редактировать путешествие';

    return {
      title: `${titleBase} | Metravel`,
      description: controller.isNew
        ? 'Создайте новое путешествие в личном кабинете Metravel.'
        : 'Редактирование путешествия в личном кабинете Metravel.',
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
