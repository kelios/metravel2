// components/trips/planning/useRouteSiteSearch.ts
// Поиск места по сайту (каталог мест + путешествия MeTravel) для формы
// добавления точки маршрута. Вынесено из RouteBuilder.tsx (#1825) дословно:
// тот же порог длины запроса, тот же AbortController и те же статусы.
import { useCallback, useEffect, useState } from 'react';

import { fetchPlacesCatalog } from '@/api/places';
import { fetchTravels } from '@/api/travelsApi';
import { type RoutePointType } from '@/api/plannedTrips';
import type {
  SiteRouteOption,
  SiteSearchStatus,
} from '@/components/trips/planning/RoutePointAddForm';
import {
  SITE_SEARCH_MIN_LENGTH,
  compactText,
  parseNumber,
  travelCoordinates,
} from '@/components/trips/planning/routeBuilderPoint';
import { translate as i18nT } from '@/i18n'

export function useRouteSiteSearch({
  isAddPointOpen,
  newType,
}: {
  isAddPointOpen: boolean;
  newType: RoutePointType;
}) {
  const [siteQuery, setSiteQuery] = useState('');
  const [siteOptions, setSiteOptions] = useState<SiteRouteOption[]>([]);
  const [siteSearchStatus, setSiteSearchStatus] = useState<SiteSearchStatus>('idle');

  useEffect(() => {
    const query = siteQuery.trim();
    if (!isAddPointOpen || newType !== 'place' || query.length < SITE_SEARCH_MIN_LENGTH) {
      setSiteOptions([]);
      setSiteSearchStatus('idle');
      return;
    }

    const controller = new AbortController();
    setSiteSearchStatus('loading');

    Promise.all([
      fetchPlacesCatalog({ page: 1, perPage: 6, q: query }, controller.signal),
      fetchTravels(0, 6, query, {}, { signal: controller.signal }),
    ])
      .then(([placesPage, travelsPage]) => {
        const placeOptions: SiteRouteOption[] = placesPage.places.map((place) => {
          const numericId = parseNumber(place.id);
          return {
            key: `place-${place.id}`,
            kind: 'place',
            id: numericId,
            title: place.title,
            subtitle: compactText([place.category, place.country]),
            description: place.address ?? null,
            coordinates: [place.lngNumber, place.latNumber],
            imageUrl: place.travelImageThumbUrl || place.imageUrl || null,
          };
        });

        const travelOptions: SiteRouteOption[] = travelsPage.data.map((travel) => ({
          key: `travel-${travel.id}`,
          kind: 'travel',
          id: travel.id,
          title: travel.name,
          subtitle: compactText([i18nT('trips:components.trips.planning.RouteBuilder.puteshestvie_7cbf3a43'), travel.countryName]),
          description: travel.description || null,
          coordinates: travelCoordinates(travel),
          imageUrl: travel.travel_image_thumb_url || travel.travel_image_thumb_small_url || null,
        }));

        setSiteOptions([...placeOptions, ...travelOptions]);
        setSiteSearchStatus('ready');
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setSiteOptions([]);
        setSiteSearchStatus('error');
      });

    return () => controller.abort();
  }, [isAddPointOpen, newType, siteQuery]);

  // Хвост `handleAddSitePoint`, относящийся к поиску: точку создаёт контейнер,
  // строка запроса и её результаты гасятся здесь — тем же порядком вызовов.
  const resetSiteSearch = useCallback(() => {
    setSiteQuery('');
    setSiteOptions([]);
    setSiteSearchStatus('idle');
  }, []);

  return { siteQuery, setSiteQuery, siteOptions, siteSearchStatus, resetSiteSearch };
}
