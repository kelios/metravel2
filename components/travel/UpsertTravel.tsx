import { useMemo } from 'react';
import { usePathname } from 'expo-router';

import {
  initFilters,
  normalizeCategoryTravelAddress,
  normalizeTravelCategories,
} from '@/hooks/useTravelFilters';

import InstantSEO from '@/components/seo/LazyInstantSEO';
import UpsertTravelView from '@/components/travel/upsert/UpsertTravelView';
import { PendingPointPhotoSession } from '@/components/travel/upsert/PendingPointPhotoSession';
import { useUpsertTravelController, type PlaceRequestEditorContext } from '@/components/travel/upsert/useUpsertTravelController';
import { buildCanonicalUrl } from '@/utils/seo';
import { UPSERT_TRAVEL_NEW_PATH, buildUpsertTravelSeoText } from '@/components/travel/upsert/upsertTravelSeo';


export { initFilters, normalizeCategoryTravelAddress, normalizeTravelCategories };

type EditorProps = { placeRequestContext?: PlaceRequestEditorContext };

export default function UpsertTravel({ placeRequestContext }: EditorProps) {
  return <PendingPointPhotoSession><TravelEditor placeRequestContext={placeRequestContext} /></PendingPointPhotoSession>;
}

function TravelEditor({ placeRequestContext }: EditorProps) {
  const controller = useUpsertTravelController(placeRequestContext);
  const pathname = usePathname();

  const seo = useMemo(() => {
    const normalizedPath = pathname || (controller.isNew ? UPSERT_TRAVEL_NEW_PATH : `/travel/${controller.formData?.id ?? ''}`);

    return {
      ...buildUpsertTravelSeoText(controller.isNew, controller.formData?.name),
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
