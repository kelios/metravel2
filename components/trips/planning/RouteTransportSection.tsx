// components/trips/planning/RouteTransportSection.tsx
// Шаг 1 панели маршрута: способ передвижения, тип велосипеда, признак
// перестроения и ошибка перестроения. Вынесено из RouteBuilder.tsx (#1825)
// дословно — разметка, testID и accessibility те же.
import React from 'react';
import { Text, View } from 'react-native';

import { type PlannedTrip, type TripBikeType } from '@/api/plannedTrips';
import RouteStepBlock, { type RouteStepBlockStyles } from '@/components/MapPage/RouteStepBlock';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import TripBikeTypeControl from '@/components/trips/planning/TripBikeTypeControl';
import { TRANSPORT_LABEL } from '@/components/trips/planning/tripPlanFormatting';
import { ROUTE_TRANSPORTS } from '@/components/trips/planning/tripRoutePreview';
import { translate as i18nT } from '@/i18n';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { createStyles } from './RouteBuilder.styles';
import type { createRoutePanelStyles } from './routePanelStyles';

type RouteBuilderStyles = ReturnType<typeof createStyles>;
type RoutePanelStyles = ReturnType<typeof createRoutePanelStyles>;

interface Props {
  styles: RouteBuilderStyles;
  panelStyles: RoutePanelStyles;
  stepStyles: RouteStepBlockStyles;
  transport: PlannedTrip['transport'];
  bikeType: PlannedTrip['bikeType'];
  /** Перестроение маршрута ещё летит: подпись и `busy` берут этот флаг. */
  pending: boolean;
  disabled: boolean;
  error: string | null;
  onTransportChange: (value: string) => void;
  onBikeTypeChange: (value: TripBikeType) => void;
}

export default function RouteTransportSection({
  styles,
  panelStyles,
  stepStyles,
  transport,
  bikeType,
  pending: transportPending,
  disabled: transportDisabled,
  error: routeRebuildError,
  onTransportChange,
  onBikeTypeChange,
}: Props) {
  const { t } = useTranslation();
  const transportOptions = ROUTE_TRANSPORTS.map((option) => ({
    key: option,
    label: TRANSPORT_LABEL[option],
  }));

  return (
    <RouteStepBlock
      step={1}
      title={i18nT('map:components.MapPage.FiltersPanelRouteSection.transport_aa70a7ea')}
      styles={stepStyles}
      aside={<Text style={panelStyles.stepBadge}>{TRANSPORT_LABEL[transport]}</Text>}
      testID="route-builder-step-transport"
    >
      <View
        style={panelStyles.stepBody}
        accessibilityState={{ busy: transportPending }}
        testID="route-builder-transport-control"
      >
        <SegmentedControl
          options={transportOptions}
          value={transport}
          onChange={onTransportChange}
          accessibilityLabel={t('trips:components.trips.planning.RouteBuilder.sposob_peredvizheniya_f5c52d42')}
          compact
          dense
          minTouchHeight={44}
          noOuterMargins
          disabled={transportDisabled}
        />
        {transport === 'bike' && bikeType ? (
          <TripBikeTypeControl
            value={bikeType}
            disabled={transportDisabled}
            onChange={onBikeTypeChange}
            styles={styles}
          />
        ) : null}
        {transportPending ? (
          <Text
            style={styles.hint}
            accessibilityLiveRegion="polite"
            testID="route-builder-transport-pending"
          >
            {t('trips:components.trips.planning.RouteBuilder.perestraivaem_marshrut_d8d47f21')}
          </Text>
        ) : null}
        {routeRebuildError ? (
          <Text
            style={styles.errorText}
            accessibilityLiveRegion="assertive"
            testID="route-builder-transport-error"
          >
            {routeRebuildError}
          </Text>
        ) : null}
      </View>
    </RouteStepBlock>
  );
}
