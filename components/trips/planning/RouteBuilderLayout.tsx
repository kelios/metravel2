// components/trips/planning/RouteBuilderLayout.tsx
// Раскладка панели конструктора маршрута. Вынесено из RouteBuilder.tsx (#1825)
// дословно — обе ветки, их порядок секций и комментарии те же.
import React from 'react';
import { Text, View } from 'react-native';

import { type PlannedTrip, type RouteSummary, type RoutingState } from '@/api/plannedTrips';
import RouteBuilderMobile from '@/components/trips/planning/RouteBuilderMobile';
import { translate as i18nT } from '@/i18n';
import type { createStyles } from './RouteBuilder.styles';
import type { createRoutePanelStyles } from './routePanelStyles';

type RouteBuilderStyles = ReturnType<typeof createStyles>;
type RoutePanelStyles = ReturnType<typeof createRoutePanelStyles>;

interface Props {
  isMapFirst: boolean;
  styles: RouteBuilderStyles;
  panelStyles: RoutePanelStyles;
  /** Длина маршрута: подсказка карты в мобильной раскладке. */
  pointCount: number;
  /** #2058: `[⌖]` дня поднимает мобильную страницу к карте на каждый рост счётчика. */
  mapRevealToken: number;
  summary: RouteSummary | null;
  routingState: RoutingState | null;
  transport: PlannedTrip['transport'];
  mapSection: React.ReactNode;
  previewEngine: React.ReactNode;
  previewStatusSection: React.ReactNode;
  transportSection: React.ReactNode;
  pointsSection: React.ReactNode;
  editPointSection: React.ReactNode;
  templatesSection: React.ReactNode;
  summarySection: React.ReactNode;
  importSection: React.ReactNode;
  routeDownloadSection: React.ReactNode;
  saveSection: React.ReactNode;
  elevationProfileSection: React.ReactNode;
}

export default function RouteBuilderLayout({
  isMapFirst,
  styles,
  panelStyles,
  pointCount,
  mapRevealToken,
  summary,
  routingState,
  transport,
  mapSection,
  previewEngine,
  previewStatusSection,
  transportSection,
  pointsSection,
  editPointSection,
  templatesSection,
  summarySection,
  importSection,
  routeDownloadSection,
  saveSection,
  elevationProfileSection,
}: Props) {
  // #1902: импорт и GPX/KML — одна рамка «Файл маршрута». #2053 (макет
  // `docs/features/trips-plan-route-tab-mock.md` §1, вариант «стопка»): импорт
  // во всю ширину, под ним GPX и KML поровну, ниже карточка оригинала со своими
  // «Скачать»/«Удалить». Кнопки скачивания встают в панель импорта через
  // `fileToolbarExtra`, чтобы оказаться между импортом и карточкой.
  const importWithFileToolbar = React.isValidElement(importSection)
    ? React.cloneElement(
        importSection as React.ReactElement<{ fileToolbarExtra?: React.ReactNode }>,
        { fileToolbarExtra: routeDownloadSection },
      )
    : importSection;
  const routeFileSection = (
    <View style={panelStyles.stepBlock} testID="route-builder-route-file">
      <Text style={styles.label}>{i18nT('tripsStatic:plan.routeFile.title')}</Text>
      <Text style={styles.hint}>{i18nT('tripsStatic:plan.routeFile.hint')}</Text>
      {importWithFileToolbar}
    </View>
  );

  if (isMapFirst) {
    return (
      <RouteBuilderMobile
        mapSlot={mapSection}
        engineSlot={previewEngine}
        mapRevealToken={mapRevealToken}
        summary={summary}
        routingState={routingState}
        transport={transport}
        // Ключ карты, а не свой: строка та же самая, а в fill-режиме её шапку
        // рисует раскладка — дублировать перевод в пятый раз незачем.
        mapHint={
          pointCount
            ? null
            : i18nT('trips:components.trips.planning.TripPlanRouteMap.nazhmite_na_kartu_chtoby_dobavit_tochku_posl_52845bf6')
        }
      >
        {transportSection}
        {previewStatusSection}
        {/* Список точек уже содержит и добавление, и инлайн-редактор точки. */}
        {pointsSection}
        {/* Главное действие стоит сразу под работой с точками, а не за
            шаблонами, импортом и экспортом в самом низу панели. */}
        {saveSection}
        {elevationProfileSection}
        {summarySection}
        {templatesSection}
        {routeFileSection}
      </RouteBuilderMobile>
    );
  }

  // #1491: раскладка как на /map — шаги слева, карта справа и всегда перед
  // глазами. Колонок здесь всегда две: сузиться до одной эта ветка не умеет, а
  // мобильная раскладка `mapFirst` — отдельная (#1495/#1691) и сюда не
  // попадает, из неё возврат выше.
  return (
    <View style={styles.wrap} testID="route-builder">
      <Text style={styles.heading}>{i18nT('trips:components.trips.planning.RouteBuilder.konstruktor_marshruta_187e063e')}</Text>

      <View style={[panelStyles.workspace, panelStyles.workspaceSplit]} testID="route-builder-workspace">
        <View
          style={[panelStyles.panelColumn, panelStyles.panelColumnSplit]}
          testID="route-builder-panel-column"
        >
          {transportSection}

          {/* Добавление точки переехало внутрь секции списка — в обеих
              раскладках это одно место. */}
          {pointsSection}

          {editPointSection}

          {templatesSection}

          {summarySection}

          {routeFileSection}

          {saveSection}
        </View>

        <View
          style={[panelStyles.mapColumn, panelStyles.mapColumnSplit]}
          testID="route-builder-map-column"
        >
          {mapSection}
          {previewEngine}
          {previewStatusSection}
        </View>
      </View>

      {elevationProfileSection}
    </View>
  );
}
