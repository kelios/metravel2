// components/trips/planning/TripAffiliateBlock.tsx
// Партнёрский блок на странице поездки (FE-trip-monetization #460): подборка
// предложений (жильё/активности) с трекингом кликов в воронку аналитики.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PlannedTrip } from '@/api/plannedTrips';
import AffiliateOffers from '@/components/affiliate/AffiliateOffers';
import { getAffiliateOffers, isAffiliateEnabled } from '@/components/affiliate/affiliateConfig';
import { useCountryCodeByCoords, type LookupCoordinates } from '@/hooks/useCountryCodeByCoords';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { trackTripAffiliateClick } from '@/utils/tripAnalytics';
import { translate as i18nT } from '@/i18n'


interface Props {
  trip: PlannedTrip;
}

/**
 * Координаты, по которым резолвится страна поездки — тем же путём, что и
 * travel-детали (`AffiliateSection`). Своего поля страны у поездки нет: в
 * `PlannedTripDto` его не отдаёт бэк, поэтому координаты маршрута — единственный
 * гео-сигнал. Без кода `resolveCountrySlug` не резолвится вообще, и обе ссылки
 * уходят на homepage партнёра вместо страновой страницы.
 *
 * Берём первую точку С координатами, а не строго `route[0]`: точка типа `custom`
 * заводится и без них, и тогда поездка теряла бы дип-линк целиком. Дальше первой
 * координатной точки не идём — страна маршрута определяется его началом, как и у
 * travel. `RoutePoint.coordinates` хранится как `[lng, lat]`.
 */
const resolveTripCoordinates = (trip: PlannedTrip): LookupCoordinates | undefined => {
  const points = trip.route?.length ? trip.route : trip.startPoint ? [trip.startPoint] : [];
  for (const point of points) {
    const coords = point?.coordinates;
    if (!coords) continue;
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    return { lat, lng };
  }
  return undefined;
};

function TripAffiliateBlock({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Сам резолвер (и таблица контуров стран за ним, 67 КБ) грузится по import()
  // из общего чокпоинта: синхронный импорт отсюда уводил таблицу в стартовый
  // граф маршрута планировщика тегом <script> (#1393, #1543).
  const coordinates = useMemo(() => resolveTripCoordinates(trip), [trip]);
  const countryCode = useCountryCodeByCoords(coordinates, isAffiliateEnabled());
  const context = useMemo(
    () => ({ city: trip.region || undefined, countryCode }),
    [trip.region, countryCode],
  );

  // У заголовка нет собственного содержимого: без офферов (нет маркера или
  // шаблонов в env) `AffiliateOffers` отдаёт null и шапка осталась бы одна —
  // тот же гейт, что в travel `AffiliateSection`.
  if (getAffiliateOffers(context).length === 0) return null;

  return (
    <View style={styles.wrap} testID="trip-affiliate">
      <Text style={styles.heading}>{i18nT('trips:components.trips.planning.TripAffiliateBlock.gde_ostanovitsya_i_chto_posmotret_d0723aa4')}</Text>
      <AffiliateOffers
        {...context}
        onOfferClick={(key) => trackTripAffiliateClick(trip.id, key)}
      />
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  });

export default React.memo(TripAffiliateBlock);
