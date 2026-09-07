// components/trips/planning/RoutePointsSection.tsx
// Шаг 2 панели маршрута: список точек (в двух раскладках) и форма добавления
// точки под ним. Вынесено из RouteBuilder.tsx (#1825) дословно — разметка,
// testID, порядок веток и тексты те же.
import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Platform, ScrollView, Text, View } from 'react-native';

import { type RoutePoint, type RoutePointType } from '@/api/plannedTrips';
import AddressSearch from '@/components/MapPage/AddressSearch';
import RouteStepBlock, { type RouteStepBlockStyles } from '@/components/MapPage/RouteStepBlock';
import RoutePointAddForm, {
  type SiteRouteOption,
  type SiteSearchStatus,
} from '@/components/trips/planning/RoutePointAddForm';
import { MIN_ROUTE_POINTS, POINT_TYPES } from '@/components/trips/planning/routeBuilderPoint';
import Button from '@/components/ui/Button';
import type { ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import type { createStyles } from './RouteBuilder.styles';
import type { createRoutePanelStyles } from './routePanelStyles';

type RouteBuilderStyles = ReturnType<typeof createStyles>;
type RoutePanelStyles = ReturnType<typeof createRoutePanelStyles>;

interface Props {
  styles: RouteBuilderStyles;
  panelStyles: RoutePanelStyles;
  stepStyles: RouteStepBlockStyles;
  colors: ThemedColors;
  isMapFirst: boolean;
  route: RoutePoint[];
  editingIndex: number | null;
  /**
   * Форма правки точки. В мобильной раскладке она уезжает в карточку своей
   * точки, в десктопной остаётся у контейнера и сюда приходит как `null`.
   */
  editorSlot: React.ReactNode;
  renderPoint: (
    point: RoutePoint,
    index: number,
    editorSlot?: React.ReactNode,
  ) => React.ReactNode;
  isAddPointOpen: boolean;
  newType: RoutePointType;
  newName: string;
  newLat: string;
  newLng: string;
  newDescription: string;
  newPointError: string | null;
  siteQuery: string;
  siteOptions: SiteRouteOption[];
  siteSearchStatus: SiteSearchStatus;
  onTypeChange: (type: RoutePointType) => void;
  onNameChange: (value: string) => void;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAddressSelect: (address: string, coords: { lat: number; lng: number }) => void;
  onSiteQueryChange: (value: string) => void;
  onAddSitePoint: (option: SiteRouteOption) => void;
  onAdd: () => void;
  onOpenAddPoint: () => void;
  onCancelAddPoint: () => void;
}

export default function RoutePointsSection({
  styles,
  panelStyles,
  stepStyles,
  colors,
  isMapFirst,
  route,
  editingIndex,
  editorSlot,
  renderPoint,
  isAddPointOpen,
  newType,
  newName,
  newLat,
  newLng,
  newDescription,
  newPointError,
  siteQuery,
  siteOptions,
  siteSearchStatus,
  onTypeChange,
  onNameChange,
  onLatChange,
  onLngChange,
  onDescriptionChange,
  onAddressSelect,
  onSiteQueryChange,
  onAddSitePoint,
  onAdd,
  onOpenAddPoint,
  onCancelAddPoint,
}: Props) {
  const addPointSection = editingIndex != null ? null : !isAddPointOpen ? (
    <Button
      label={i18nT('trips:components.trips.planning.RouteBuilder.dobavit_tochku_60ab5746')}
      onPress={onOpenAddPoint}
      variant="secondary"
      size="sm"
      icon={<Feather name="plus" size={16} color={colors.text} />}
      testID="route-builder-add-action"
    />
  ) : (
    <RoutePointAddForm
      styles={styles}
      addressSlot={
        <AddressSearch
          onAddressSelect={onAddressSelect}
          placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nayti_mesto_po_nazvaniyu_ili_adresu_fa7745e0')}
          enableCoordinateInput
          dense
        />
      }
      colors={colors}
      pointTypes={POINT_TYPES}
      type={newType}
      name={newName}
      lat={newLat}
      lng={newLng}
      description={newDescription}
      error={newPointError}
      siteQuery={siteQuery}
      siteOptions={siteOptions}
      siteSearchStatus={siteSearchStatus}
      onTypeChange={onTypeChange}
      onNameChange={onNameChange}
      onLatChange={onLatChange}
      onLngChange={onLngChange}
      onDescriptionChange={onDescriptionChange}
      onSiteQueryChange={onSiteQueryChange}
      onAddSitePoint={onAddSitePoint}
      onAdd={onAdd}
      onCancel={onCancelAddPoint}
    />
  );

  return (
    <RouteStepBlock
      step={2}
      title={i18nT('map:components.MapPage.FiltersPanelRouteSection.tochki_marshruta_0250dc3a')}
      styles={stepStyles}
      aside={
        route.length >= MIN_ROUTE_POINTS ? (
          <View style={panelStyles.stepCheckBadge}>
            <Feather name="check" size={12} color={colors.success} />
            <Text style={panelStyles.stepCheckText}>
              {i18nT('map:components.MapPage.FiltersPanelRouteSection.gotovo_aab95a18')}
            </Text>
          </View>
        ) : (
          <Text style={panelStyles.stepHint}>
            {i18nT('map:components.MapPage.FiltersPanelRouteSection.vyberite_tochki_fb6530e6')}
          </Text>
        )
      }
      testID="route-builder-step-points"
    >
      {route.length ? (
        isMapFirst ? (
          <View style={styles.pointList}>
            {route.map((point, index) =>
              renderPoint(point, index, editingIndex === index ? editorSlot : null),
            )}
          </View>
        ) : (
          <ScrollView
            style={styles.pointListScroll}
            contentContainerStyle={styles.pointList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelRouteSection.tochki_marshruta_0250dc3a')}
            testID="route-builder-point-list-scroll"
            {...(Platform.OS === 'web' ? { tabIndex: 0 as const } : {})}
          >
            {route.map((point, index) => renderPoint(point, index))}
          </ScrollView>
        )
      ) : (
        <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.dobavte_pervuyu_tochku_marshruta_nizhe_d7cb9f9e')}</Text>
      )}
      {/* Добавление живёт вплотную к списку: раньше кнопка лежала в самом низу
          панели, за импортом и экспортом, и на телефоне до неё надо было
          прокрутить ~2000px. */}
      {addPointSection}
    </RouteStepBlock>
  );
}
