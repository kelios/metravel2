// components/trips/planning/RouteBuilder.tsx
// Конструктор маршрута поездки (Sprint 13 / блок D): список точек с reorder/delete
// (web-safe, без нативных drag-либ), inline-добавление точки, применение шаблонов
// и живая сводка через estimateRouteSummary. Только владелец может редактировать.
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { fetchPlacesCatalog } from '@/api/places';
import { fetchTravels } from '@/api/travelsApi';
import type { Travel, TravelAddressItem } from '@/types/types';
import Button from '@/components/ui/Button';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import RouteSummaryBar from '@/components/trips/planning/RouteSummaryBar';
import TripPlanLinkedText from '@/components/trips/planning/TripPlanLinkedText';
import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap';
import {
  estimateRouteSummary,
  type PlannedTrip,
  type RoutePoint,
  type RoutePointType,
} from '@/api/plannedTrips';
import {
  ROUTE_POINT_ICON_NAME,
  ROUTE_POINT_LABEL,
} from '@/components/trips/planning/tripPlanFormatting';
import {
  useRouteTemplates,
  useUpdateTripRoute,
} from '@/hooks/usePlannedTripsApi';
import { trackRoutePointAdded } from '@/utils/tripAnalytics';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

interface Props {
  trip: PlannedTrip;
}

const POINT_TYPES: RoutePointType[] = ['place', 'custom', 'rest', 'overnight'];
const SITE_SEARCH_MIN_LENGTH = 2;

type SiteSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

type SiteRouteOption = {
  key: string;
  kind: 'place' | 'travel';
  id: number | null;
  title: string;
  subtitle: string;
  description: string | null;
  coordinates: [number, number] | null;
  imageUrl: string | null;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseLatLngPair = (value: unknown): { lat: number; lng: number } | null => {
  if (typeof value !== 'string') return null;
  const [latRaw, lngRaw] = value.split(',').map((part) => part.trim());
  const lat = parseNumber(latRaw);
  const lng = parseNumber(lngRaw);
  if (lat == null || lng == null) return null;
  return { lat, lng };
};

const travelAddressCoordinates = (point: TravelAddressItem): { lat: number; lng: number } | null => {
  if (typeof point === 'string') return null;
  const directLat = parseNumber(point.lat);
  const directLng = parseNumber(point.lng);
  if (directLat != null && directLng != null) return { lat: directLat, lng: directLng };
  return parseLatLngPair(point.coords);
};

const travelCoordinates = (travel: Travel): [number, number] | null => {
  const routePoint = travel.coordsMeTravel?.find((point) => {
    const lat = parseNumber(point.lat);
    const lng = parseNumber(point.lng);
    return lat != null && lng != null;
  });
  if (routePoint) return [Number(routePoint.lng), Number(routePoint.lat)];

  const addressPoint = travel.travelAddress
    ?.map(travelAddressCoordinates)
    .find((point): point is { lat: number; lng: number } => point != null);
  return addressPoint ? [addressPoint.lng, addressPoint.lat] : null;
};

const compactText = (parts: Array<string | number | null | undefined>): string =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ');

const formatCoordinateInput = (value: number): string => {
  const rounded = value.toFixed(6);
  return rounded.replace(/\.?0+$/, '');
};

const coordinatesFromFields = (
  latValue: string,
  lngValue: string,
): { coordinates: [number, number] | null; error: string | null } => {
  const latText = latValue.trim();
  const lngText = lngValue.trim();
  if (!latText && !lngText) return { coordinates: null, error: null };

  const lat = parseNumber(latText);
  const lng = parseNumber(lngText);
  if (lat == null || lng == null) {
    return { coordinates: null, error: 'Укажите широту и долготу числами.' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { coordinates: null, error: 'Широта должна быть от -90 до 90, долгота от -180 до 180.' };
  }

  return { coordinates: [lng, lat], error: null };
};

const move = <T,>(arr: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function RouteBuilder({ trip }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const updateTripRoute = useUpdateTripRoute();
  const templatesQuery = useRouteTemplates();

  const [route, setRoute] = useState<RoutePoint[]>(trip.route);

  const [newType, setNewType] = useState<RoutePointType>('place');
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPointError, setNewPointError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editType, setEditType] = useState<RoutePointType>('custom');
  const [editName, setEditName] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [siteQuery, setSiteQuery] = useState('');
  const [siteOptions, setSiteOptions] = useState<SiteRouteOption[]>([]);
  const [siteSearchStatus, setSiteSearchStatus] = useState<SiteSearchStatus>('idle');

  const summary = useMemo(
    () => estimateRouteSummary(route, trip.transport),
    [route, trip.transport],
  );

  const handleMove = (index: number, delta: number) => {
    setRoute((prev) => move(prev, index, index + delta));
  };

  const handleDelete = (index: number) => {
    setRoute((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex != null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const { coordinates, error } = coordinatesFromFields(newLat, newLng);
    if (error) {
      setNewPointError(error);
      return;
    }
    const description = newDescription.trim();

    setNewPointError(null);
    setRoute((prev) => [
      ...prev,
      {
        id: `local-${prev.length}-${name}`,
        type: newType,
        name,
        description: description || null,
        coordinates,
        placeId: null,
      },
    ]);
    trackRoutePointAdded(trip.id, newType);
    setNewName('');
    setNewLat('');
    setNewLng('');
    setNewDescription('');
  };

  const handleStartEdit = (point: RoutePoint, index: number) => {
    setEditingIndex(index);
    setEditType(point.type);
    setEditName(point.name);
    setEditDescription(point.description ?? '');
    setEditLat(point.coordinates ? formatCoordinateInput(point.coordinates[1]) : '');
    setEditLng(point.coordinates ? formatCoordinateInput(point.coordinates[0]) : '');
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditError(null);
  };

  const handleSaveEdit = () => {
    if (editingIndex == null) return;
    const name = editName.trim();
    if (!name) {
      setEditError('Введите название точки.');
      return;
    }

    const { coordinates, error } = coordinatesFromFields(editLat, editLng);
    if (error) {
      setEditError(error);
      return;
    }

    setRoute((prev) => {
      const current = prev[editingIndex];
      if (!current) return prev;
      const next = prev.slice();
      next[editingIndex] = {
        ...current,
        type: editType,
        name,
        description: editDescription.trim() || null,
        coordinates,
        placeId: editType === 'place' ? current.placeId : null,
      };
      return next;
    });
    setEditingIndex(null);
    setEditError(null);
  };

  const handleAddPointFromMap = ({ lat, lng }: { lat: number; lng: number }) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setRoute((prev) => {
      const nextIndex = prev.length;
      const name = `Точка ${nextIndex + 1}`;
      const point: RoutePoint = {
        id: `map-${Date.now()}-${nextIndex}`,
        type: 'custom',
        name,
        description: null,
        coordinates: [lng, lat],
        placeId: null,
      };
      setEditingIndex(nextIndex);
      setEditType(point.type);
      setEditName(point.name);
      setEditDescription('');
      setEditLat(formatCoordinateInput(lat));
      setEditLng(formatCoordinateInput(lng));
      setEditError(null);
      return [...prev, point];
    });
    trackRoutePointAdded(trip.id, 'custom');
  };

  useEffect(() => {
    const query = siteQuery.trim();
    if (newType !== 'place' || query.length < SITE_SEARCH_MIN_LENGTH) {
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
          subtitle: compactText(['Путешествие', travel.countryName]),
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
  }, [newType, siteQuery]);

  const handleAddSitePoint = (option: SiteRouteOption) => {
    const title = option.title.trim();
    if (!title) return;

    setRoute((prev) => [
      ...prev,
      {
        id: `${option.key}-${prev.length}`,
        type: 'place',
        name: title,
        description: option.description || option.subtitle || null,
        coordinates: option.coordinates,
        placeId: option.id,
      },
    ]);
    trackRoutePointAdded(trip.id, 'place');
    setSiteQuery('');
    setSiteOptions([]);
    setSiteSearchStatus('idle');
  };

  const handleApplyTemplate = (points: Array<Omit<RoutePoint, 'id'>>) => {
    setRoute(
      points.map((p, index) => ({
        ...p,
        id: `tpl-${index}-${p.name}`,
      })),
    );
  };

  const handleSave = () => {
    updateTripRoute.mutate({ tripId: trip.id, route });
  };

  const renderPoint = (point: RoutePoint, index: number) => (
    <View key={point.id} style={styles.pointRow}>
      <View style={styles.pointIcon}>
        <Feather name={ROUTE_POINT_ICON_NAME[point.type] as never} size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.pointBody}>
        <Text style={styles.pointType}>{ROUTE_POINT_LABEL[point.type]}</Text>
        <Text style={styles.pointName}>{point.name}</Text>
        {point.description ? (
          <TripPlanLinkedText
            text={point.description}
            style={styles.pointDescription}
            linkStyle={styles.descriptionLink}
          />
        ) : null}
        {point.coordinates ? (
          <Text style={styles.pointCoordinates}>
            {formatCoordinateInput(point.coordinates[1])}, {formatCoordinateInput(point.coordinates[0])}
          </Text>
        ) : null}
      </View>
      {trip.isOwner ? (
        <View style={styles.pointControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Редактировать точку"
            onPress={() => handleStartEdit(point, index)}
            style={styles.ctrl}
            testID={`route-builder-edit-${index}`}
          >
            <Feather name="edit-2" size={15} color={colors.primaryDark} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Поднять точку выше"
            disabled={index === 0}
            onPress={() => handleMove(index, -1)}
            style={[styles.ctrl, index === 0 && styles.ctrlDisabled]}
          >
            <Feather name="chevron-up" size={16} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Опустить точку ниже"
            disabled={index === route.length - 1}
            onPress={() => handleMove(index, 1)}
            style={[styles.ctrl, index === route.length - 1 && styles.ctrlDisabled]}
          >
            <Feather name="chevron-down" size={16} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Удалить точку"
            onPress={() => handleDelete(index)}
            style={styles.ctrl}
          >
            <Feather name="trash-2" size={15} color={colors.danger} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  if (!trip.isOwner) {
    return (
      <View style={styles.wrap} testID="route-builder">
        <Text style={styles.heading}>Маршрут</Text>
        <TripPlanRouteMap
          route={route}
          readonly
          activeIndex={editingIndex}
          onEditPoint={(index) => {
            const point = route[index];
            if (point) handleStartEdit(point, index);
          }}
        />
        {route.length ? (
          <View style={styles.pointList}>{route.map(renderPoint)}</View>
        ) : (
          <Text style={styles.hint}>Маршрут пока не построен.</Text>
        )}
        <RouteSummaryBar summary={summary} />
      </View>
    );
  }

  const templates = templatesQuery.data ?? [];

  return (
    <View style={styles.wrap} testID="route-builder">
      <Text style={styles.heading}>Конструктор маршрута</Text>

      <TripPlanRouteMap
        route={route}
        activeIndex={editingIndex}
        onEditPoint={(index) => {
          const point = route[index];
          if (point) handleStartEdit(point, index);
        }}
        onAddPointFromMap={handleAddPointFromMap}
      />

      {route.length ? (
        <View style={styles.pointList}>{route.map(renderPoint)}</View>
      ) : (
        <Text style={styles.hint}>Добавьте первую точку маршрута ниже.</Text>
      )}

      <View style={styles.addForm}>
        <Text style={styles.label}>Добавить точку</Text>
        <View style={styles.chipRow}>
          {POINT_TYPES.map((type) => {
            const active = type === newType;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                onPress={() => setNewType(type)}
                style={[styles.typeChip, active && styles.typeChipActive]}
                testID={`route-builder-type-${type}`}
              >
                <Feather
                  name={ROUTE_POINT_ICON_NAME[type] as never}
                  size={13}
                  color={active ? colors.textOnPrimary : colors.textSecondary}
                />
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                  {ROUTE_POINT_LABEL[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {newType === 'place' ? (
          <View style={styles.siteSearch}>
            <TextInput
              value={siteQuery}
              onChangeText={setSiteQuery}
              placeholder="Найти место или путешествие на MeTravel"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              testID="route-builder-site-search"
            />
            {siteSearchStatus === 'loading' ? (
              <Text style={styles.hint}>Ищем совпадения...</Text>
            ) : null}
            {siteSearchStatus === 'error' ? (
              <Text style={styles.errorText}>Не удалось загрузить варианты.</Text>
            ) : null}
            {siteSearchStatus === 'ready' && !siteOptions.length ? (
              <Text style={styles.hint}>Ничего не найдено.</Text>
            ) : null}
            {siteOptions.length ? (
              <View style={styles.siteResults}>
                {siteOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    onPress={() => handleAddSitePoint(option)}
                    style={styles.siteOption}
                    testID={`route-builder-site-option-${option.key}`}
                  >
                    <View style={styles.siteOptionImage}>
                      <ImageCardMedia
                        src={option.imageUrl}
                        alt={option.title}
                        height={54}
                        fit="cover"
                        borderRadius={8}
                        showLoadingIndicator={false}
                      />
                    </View>
                    <View style={styles.siteOptionBody}>
                      <Text style={styles.siteOptionKind}>
                        {option.kind === 'travel' ? 'Путешествие' : 'Место'}
                      </Text>
                      <Text style={styles.siteOptionTitle} numberOfLines={1}>
                        {option.title}
                      </Text>
                      {option.subtitle ? (
                        <Text style={styles.siteOptionSubtitle} numberOfLines={1}>
                          {option.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Feather name="plus" size={18} color={colors.primaryDark} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Название точки"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              testID="route-builder-name"
            />
            <View style={styles.coordRow}>
              <TextInput
                value={newLat}
                onChangeText={setNewLat}
                placeholder="Широта (lat)"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, styles.coordInput]}
                testID="route-builder-lat"
              />
              <TextInput
                value={newLng}
                onChangeText={setNewLng}
                placeholder="Долгота (lng)"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, styles.coordInput]}
                testID="route-builder-lng"
              />
            </View>
            <TextInput
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Описание (по желанию)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              testID="route-builder-description"
            />
            <Button
              label="Добавить точку"
              onPress={handleAdd}
              variant="secondary"
              disabled={!newName.trim()}
              testID="route-builder-add"
            />
          </>
        )}
        {newPointError ? <Text style={styles.errorText}>{newPointError}</Text> : null}
      </View>

      {editingIndex != null ? (
        <View style={styles.editForm} testID="route-builder-edit-form">
          <Text style={styles.label}>Редактировать точку</Text>
          <View style={styles.chipRow}>
            {POINT_TYPES.map((type) => {
              const active = type === editType;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  onPress={() => setEditType(type)}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  testID={`route-builder-edit-type-${type}`}
                >
                  <Feather
                    name={ROUTE_POINT_ICON_NAME[type] as never}
                    size={13}
                    color={active ? colors.textOnPrimary : colors.textSecondary}
                  />
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                    {ROUTE_POINT_LABEL[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={editName}
            onChangeText={setEditName}
            placeholder="Название точки"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="route-builder-edit-name"
          />
          <View style={styles.coordRow}>
            <TextInput
              value={editLat}
              onChangeText={setEditLat}
              placeholder="Широта (lat)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.coordInput]}
              testID="route-builder-edit-lat"
            />
            <TextInput
              value={editLng}
              onChangeText={setEditLng}
              placeholder="Долгота (lng)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.coordInput]}
              testID="route-builder-edit-lng"
            />
          </View>
          <TextInput
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="Описание или ссылка (по желанию)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="route-builder-edit-description"
          />
          {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
          <View style={styles.editActions}>
            <Button
              label="Сохранить точку"
              onPress={handleSaveEdit}
              variant="secondary"
              disabled={!editName.trim()}
              testID="route-builder-edit-save"
            />
            <Button
              label="Отмена"
              onPress={handleCancelEdit}
              variant="ghost"
              testID="route-builder-edit-cancel"
            />
          </View>
        </View>
      ) : null}

      {templates.length ? (
        <View style={styles.templates}>
          <Text style={styles.label}>Шаблоны маршрута</Text>
          {templates.map((tpl) => (
            <View key={tpl.id} style={styles.templateRow}>
              <View style={styles.templateBody}>
                <Text style={styles.templateTitle}>{tpl.title}</Text>
                <Text style={styles.templateDescription}>{tpl.description}</Text>
              </View>
              <Button
                label="Применить"
                onPress={() => handleApplyTemplate(tpl.points)}
                variant="ghost"
                testID={`route-builder-template-${tpl.id}`}
              />
            </View>
          ))}
        </View>
      ) : null}

      <RouteSummaryBar summary={summary} />

      <Button
        label="Сохранить маршрут"
        onPress={handleSave}
        loading={updateTripRoute.isPending}
        disabled={updateTripRoute.isPending}
        fullWidth
        testID="route-builder-save"
      />
    </View>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.text },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
    hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    errorText: { fontSize: 13, color: colors.danger, lineHeight: 18 },
    pointList: { gap: 8 },
    pointRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    pointIcon: { width: 22, alignItems: 'center', paddingTop: 1 },
    pointBody: { flex: 1, gap: 2 },
    pointType: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    pointName: { fontSize: 15, fontWeight: '600', color: colors.text },
    pointDescription: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    descriptionLink: { color: colors.primaryDark, fontWeight: '700' },
    pointCoordinates: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    pointControls: { flexDirection: 'row', gap: 4 },
    ctrl: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    ctrlDisabled: { opacity: 0.4 },
    addForm: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
    },
    editForm: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    editActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    typeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    typeChipText: { fontSize: 13, color: colors.text },
    typeChipTextActive: { color: colors.textOnPrimary, fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      ...Platform.select({ web: { outlineWidth: 0 as any } }),
    },
    coordRow: { flexDirection: 'row', gap: 8 },
    coordInput: { flex: 1 },
    siteSearch: { gap: 8 },
    siteResults: { gap: 6 },
    siteOption: {
      minHeight: 68,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    siteOptionImage: {
      width: 72,
      height: 54,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      flexShrink: 0,
    },
    siteOptionBody: { flex: 1, minWidth: 0, gap: 1 },
    siteOptionKind: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },
    siteOptionTitle: { fontSize: 14, color: colors.text, fontWeight: '700' },
    siteOptionSubtitle: { fontSize: 12, color: colors.textSecondary },
    templates: { gap: 8 },
    templateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
    },
    templateBody: { flex: 1, gap: 2 },
    templateTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    templateDescription: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  });

export default React.memo(RouteBuilder);
