import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RouteGeometry, RoutePoint } from '@/api/plannedTrips';
import { TravelMap } from '@/components/MapPage/TravelMap';
import Button from '@/components/ui/Button';
import { SelectionGroup } from '@/components/ui/SelectionGroup';
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem';
import { formatInteger } from '@/i18n/format';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { formatDistance } from './tripPlanFormatting';
import TripRouteFilePicker from './TripRouteFilePicker';
import type {
  PickedTripRouteFile,
  TripRouteFilePickerError,
} from './TripRouteFilePicker.types';
import {
  TRIP_ROUTE_IMPORT_MAX_BYTES,
  buildImportedRouteDraft,
  prepareTripRouteImport,
  type PreparedTripRouteImport,
  type TripRouteImportErrorCode,
  type TripRouteImportMode,
} from './tripRouteImport';

type Props = {
  route: RoutePoint[];
  routeGeometry?: RouteGeometry | null;
  disabled?: boolean;
  onApply: (route: RoutePoint[]) => void;
};

const parsedPointToLatLng = (coord: string): [number, number] | null => {
  const [latText, lngText, extra] = String(coord).split(',');
  if (extra != null) return null;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
};

const routeToLatLng = (route: RoutePoint[], geometry?: RouteGeometry | null): [number, number][] => {
  const coordinates = geometry?.length
    ? geometry
    : route.flatMap((point) => (point.coordinates ? [point.coordinates] : []));
  return coordinates
    .filter((pair): pair is [number, number] => (
      Array.isArray(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1])
    ))
    .map(([lng, lat]) => [lat, lng]);
};

function TripRouteImportPanel({ route, routeGeometry, disabled = false, onApply }: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [prepared, setPrepared] = useState<PreparedTripRouteImport | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [errorCode, setErrorCode] = useState<TripRouteImportErrorCode | null>(null);
  const [reading, setReading] = useState(false);

  const errorMessage = useMemo(() => {
    if (!errorCode) return null;
    switch (errorCode) {
      case 'unsupported':
        return t('tripsStatic:plan.routeImport.error.unsupported');
      case 'tooLarge':
        return t('tripsStatic:plan.routeImport.error.tooLarge');
      case 'damaged':
        return t('tripsStatic:plan.routeImport.error.damaged');
      case 'empty':
        return t('tripsStatic:plan.routeImport.error.empty');
      case 'read':
        return t('tripsStatic:plan.routeImport.error.read');
      case 'capacity':
        return t('tripsStatic:plan.routeImport.error.capacity');
    }
  }, [errorCode, t]);

  const handleBusyChange = useCallback((busy: boolean) => {
    setReading(busy);
    if (busy) {
      setPrepared(null);
      setErrorCode(null);
      setSelectedRouteIndex(0);
    }
  }, []);

  const handlePickerError = useCallback((code: TripRouteFilePickerError) => {
    setPrepared(null);
    setSelectedRouteIndex(0);
    setErrorCode(code);
  }, []);

  const handlePicked = useCallback((file: PickedTripRouteFile) => {
    const result = prepareTripRouteImport({
      fileName: file.name,
      text: file.text,
      sizeBytes: file.size,
    });
    if (!result.ok) {
      setPrepared(null);
      setSelectedRouteIndex(0);
      setErrorCode(result.error.code);
      return;
    }
    setPrepared(result.data);
    setSelectedRouteIndex(0);
    setErrorCode(null);
  }, []);

  const handleCancel = useCallback(() => {
    setPrepared(null);
    setSelectedRouteIndex(0);
    setErrorCode(null);
  }, []);

  const handleApply = useCallback((mode: TripRouteImportMode) => {
    const selected = prepared?.routes[selectedRouteIndex] ?? prepared?.routes[0];
    if (!prepared || !selected) return;
    const result = buildImportedRouteDraft({
      existingRoute: route,
      parsedRoute: selected.preview,
      namedWaypoints: prepared.namedWaypoints,
      mode,
    });
    if (!result.ok) {
      setErrorCode(result.error.code);
      return;
    }
    onApply(result.route);
    setPrepared(null);
    setSelectedRouteIndex(0);
    setErrorCode(null);
  }, [onApply, prepared, route, selectedRouteIndex]);

  const selected = prepared?.routes[selectedRouteIndex] ?? prepared?.routes[0] ?? null;
  const routeOptions = useMemo(
    () => prepared?.routes.map((_, index) => ({
      value: index,
      label: t('tripsStatic:plan.routeImport.routeOption', { value: formatInteger(index + 1) }),
    })) ?? [],
    [prepared, t],
  );
  const mapLines = useMemo(() => {
    if (!selected) return [];
    const current = routeToLatLng(route, routeGeometry);
    const imported = selected.displayLinePoints
      .map((point) => parsedPointToLatLng(point.coord))
      .filter((point): point is [number, number] => point != null);
    return [
      ...(current.length >= 2 ? [{ coords: current, color: DESIGN_COLORS.routeLine }] : []),
      ...(imported.length >= 2 ? [{ coords: imported, color: DESIGN_COLORS.travelPoint }] : []),
    ];
  }, [route, routeGeometry, selected]);
  const hasCurrentLine = mapLines.some((line) => line.color === DESIGN_COLORS.routeLine);

  return (
    <View style={styles.wrap} testID="trip-route-import-panel">
      <TripRouteFilePicker
        label={t('tripsStatic:plan.routeImport.action')}
        maxBytes={TRIP_ROUTE_IMPORT_MAX_BYTES}
        disabled={disabled}
        loading={reading}
        onBusyChange={handleBusyChange}
        onPicked={handlePicked}
        onError={handlePickerError}
      />

      {reading ? (
        <Text
          style={styles.hint}
          accessibilityLiveRegion="polite"
          testID="trip-route-import-reading"
        >
          {t('tripsStatic:plan.routeImport.reading')}
        </Text>
      ) : null}

      {errorMessage ? (
        <Text
          style={styles.error}
          accessibilityLiveRegion="assertive"
          testID="trip-route-import-error"
        >
          {errorMessage}
        </Text>
      ) : null}

      {prepared && selected ? (
        <View style={styles.preview} testID="trip-route-import-preview">
          <View style={styles.header}>
            <View style={styles.headerBody}>
              <Text style={styles.title}>{t('tripsStatic:plan.routeImport.title')}</Text>
              <Text style={styles.fileName} numberOfLines={1}>{prepared.fileName}</Text>
            </View>
            <Button
              label={t('tripsStatic:plan.routeImport.cancel')}
              onPress={handleCancel}
              variant="ghost"
              size="sm"
              testID="trip-route-import-cancel"
            />
          </View>

          {routeOptions.length > 1 ? (
            <View style={styles.routeSelection}>
              <Text style={styles.label}>{t('tripsStatic:plan.routeImport.chooseRoute')}</Text>
              <SelectionGroup
                options={routeOptions}
                value={selectedRouteIndex}
                onChange={setSelectedRouteIndex}
              />
            </View>
          ) : null}

          <TravelMap
            travelData={[]}
            compact
            height={280}
            showRouteLine
            routeLines={mapLines}
          />

          <View style={styles.legend}>
            {hasCurrentLine ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: DESIGN_COLORS.routeLine }]} />
                <Text style={styles.legendText}>{t('tripsStatic:plan.routeImport.currentRoute')}</Text>
              </View>
            ) : null}
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: DESIGN_COLORS.travelPoint }]} />
              <Text style={styles.legendText}>{t('tripsStatic:plan.routeImport.importedRoute')}</Text>
            </View>
          </View>

          <View style={styles.stats}>
            <Text style={styles.stat}>
              {t('tripsStatic:plan.routeImport.distance', { value: formatDistance(selected.distanceKm) })}
            </Text>
            <Text style={styles.stat}>
              {t('tripsStatic:plan.routeImport.points', { value: formatInteger(selected.originalPointCount) })}
            </Text>
          </View>

          <View style={styles.waypoints}>
            <Text style={styles.label}>{t('tripsStatic:plan.routeImport.namedWaypoints')}</Text>
            {prepared.namedWaypoints.length ? (
              <View style={styles.waypointList}>
                {prepared.namedWaypoints.map((waypoint, index) => (
                  <Text key={`${waypoint.coord}-${index}`} style={styles.waypoint}>
                    {waypoint.name}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>{t('tripsStatic:plan.routeImport.noNamedWaypoints')}</Text>
            )}
          </View>

          <Text style={styles.hint}>{t('tripsStatic:plan.routeImport.saveHint')}</Text>

          <View style={styles.actions}>
            <Button
              label={t('tripsStatic:plan.routeImport.replace')}
              onPress={() => handleApply('replace')}
              disabled={disabled}
              variant="primary"
              labelNumberOfLines={2}
              testID="trip-route-import-replace"
            />
            <Button
              label={t('tripsStatic:plan.routeImport.append')}
              onPress={() => handleApply('append')}
              disabled={disabled}
              variant="outline"
              labelNumberOfLines={2}
              testID="trip-route-import-append"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemedColors) => StyleSheet.create({
  wrap: { gap: DESIGN_TOKENS.spacing.sm },
  preview: {
    gap: DESIGN_TOKENS.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerBody: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  fileName: { color: colors.textMuted, fontSize: 13 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  routeSelection: { gap: DESIGN_TOKENS.spacing.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
  legendLine: { width: 24, height: 4, borderRadius: DESIGN_TOKENS.radii.full },
  legendText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.md },
  stat: { color: colors.text, fontSize: 14, fontWeight: '700' },
  waypoints: { gap: DESIGN_TOKENS.spacing.xs },
  waypointList: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
  waypoint: {
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.sm },
});

export default React.memo(TripRouteImportPanel);
