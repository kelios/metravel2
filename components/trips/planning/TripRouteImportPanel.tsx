import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PlannedTripRouteFile } from '@/api/plannedTripRoutes';
import type { RouteGeometry, RoutePoint } from '@/api/plannedTrips';
import { TravelMap } from '@/components/MapPage/TravelMap';
import Button from '@/components/ui/Button';
import { SelectionGroup } from '@/components/ui/SelectionGroup';
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem';
import { formatFileSize } from '@/utils/fileSize';
import { formatInteger } from '@/i18n/format';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { formatDistance } from './tripPlanFormatting';
import TripRouteFilePicker, { releasePickedTripRouteUpload } from './TripRouteFilePicker';
import type {
  PickedTripRouteFile,
  PickedTripRouteFileUpload,
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
  /**
   * Исходный файл, уже сохранённый у поездки (#1496). `null` — его нет либо
   * хранилище закрыто для этого пользователя.
   */
  storedFile?: PlannedTripRouteFile | null;
  /** Оригинал выбран, но ещё не ушёл на бэкенд — уйдёт вместе с «Сохранить маршрут». */
  pendingUploadName?: string | null;
  uploadError?: string | null;
  removing?: boolean;
  onRemoveStoredFile?: () => void;
  /**
   * Точки уходят в черновик маршрута, а исходный файл — наверх: он загружается
   * на бэкенд тем же действием «Сохранить маршрут», чтобы оригинал и точки
   * никогда не расходились.
   */
  onApply: (route: RoutePoint[], originalUpload: PickedTripRouteFileUpload | null) => void;
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

function TripRouteImportPanel({
  route,
  routeGeometry,
  disabled = false,
  storedFile = null,
  pendingUploadName = null,
  uploadError = null,
  removing = false,
  onRemoveStoredFile,
  onApply,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [prepared, setPrepared] = useState<PreparedTripRouteImport | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [errorCode, setErrorCode] = useState<TripRouteImportErrorCode | null>(null);
  const [reading, setReading] = useState(false);
  // Выбранный, но ещё не применённый оригинал. Каждый новый выбор и каждая отмена
  // освобождают предыдущую кэш-копию, иначе на устройстве копятся файлы до 20 МиБ.
  const pendingUploadRef = useRef<PickedTripRouteFileUpload | null>(null);

  const releasePendingUpload = useCallback(() => {
    const upload = pendingUploadRef.current;
    pendingUploadRef.current = null;
    if (upload) void releasePickedTripRouteUpload(upload);
  }, []);

  useEffect(() => () => releasePendingUpload(), [releasePendingUpload]);

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
      releasePendingUpload();
      setPrepared(null);
      setErrorCode(null);
      setSelectedRouteIndex(0);
    }
  }, [releasePendingUpload]);

  const handlePickerError = useCallback((code: TripRouteFilePickerError) => {
    releasePendingUpload();
    setPrepared(null);
    setSelectedRouteIndex(0);
    setErrorCode(code);
  }, [releasePendingUpload]);

  const handlePicked = useCallback((file: PickedTripRouteFile) => {
    const result = prepareTripRouteImport({
      fileName: file.name,
      text: file.text,
      sizeBytes: file.size,
    });
    if (!result.ok) {
      void releasePickedTripRouteUpload(file.upload);
      setPrepared(null);
      setSelectedRouteIndex(0);
      setErrorCode(result.error.code);
      return;
    }
    releasePendingUpload();
    pendingUploadRef.current = file.upload;
    setPrepared(result.data);
    setSelectedRouteIndex(0);
    setErrorCode(null);
  }, [releasePendingUpload]);

  const handleCancel = useCallback(() => {
    releasePendingUpload();
    setPrepared(null);
    setSelectedRouteIndex(0);
    setErrorCode(null);
  }, [releasePendingUpload]);

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
    // Владелец оригинала переходит наверх: освобождать кэш-копию теперь задача
    // RouteBuilder — файл нужен до успешной загрузки на бэкенд.
    const originalUpload = pendingUploadRef.current;
    pendingUploadRef.current = null;
    onApply(result.route, originalUpload);
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

      {pendingUploadName ? (
        <Text
          style={styles.hint}
          accessibilityLiveRegion="polite"
          testID="trip-route-import-pending-original"
        >
          {t('tripsStatic:plan.routeImport.original.pending', { value: pendingUploadName })}
        </Text>
      ) : null}

      {!pendingUploadName && storedFile ? (
        <View style={styles.storedFile} testID="trip-route-import-stored-original">
          <View style={styles.storedFileBody}>
            <Text style={styles.storedFileName} numberOfLines={1}>
              {storedFile.original_name}
            </Text>
            <Text style={styles.hint}>
              {t('tripsStatic:plan.routeImport.original.stored', {
                value: storedFile.size ? formatFileSize(Number(storedFile.size)) : '—',
              })}
            </Text>
          </View>
          {onRemoveStoredFile ? (
            <Button
              label={t('tripsStatic:plan.routeImport.original.remove')}
              onPress={onRemoveStoredFile}
              variant="ghost"
              size="sm"
              disabled={disabled || removing}
              loading={removing}
              testID="trip-route-import-remove-original"
            />
          ) : null}
        </View>
      ) : null}

      {uploadError ? (
        <Text
          style={styles.error}
          accessibilityLiveRegion="assertive"
          testID="trip-route-import-upload-error"
        >
          {uploadError}
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
          <Text style={styles.hint} testID="trip-route-import-original-hint">
            {t('tripsStatic:plan.routeImport.original.applyHint')}
          </Text>

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
  storedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  storedFileBody: { flex: 1, minWidth: 0, gap: 2 },
  storedFileName: { color: colors.text, fontSize: 13, fontWeight: '700' },
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
