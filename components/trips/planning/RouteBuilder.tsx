// components/trips/planning/RouteBuilder.tsx
// Конструктор маршрута поездки (Sprint 13 / блок D): список точек с reorder/delete
// (web-safe, без нативных drag-либ), inline-добавление точки, применение шаблонов
// и живая сводка через estimateRouteSummary. Только владелец может редактировать.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
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
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'
import { createStyles } from './RouteBuilder.styles';


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
    return { coordinates: null, error: i18nT('trips:components.trips.planning.RouteBuilder.ukazhite_shirotu_i_dolgotu_chislami_06a43fa9') };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { coordinates: null, error: i18nT('trips:components.trips.planning.RouteBuilder.shirota_dolzhna_byt_ot_90_do_90_dolgota_ot_1_964ccc95') };
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

const routeSignature = (route: RoutePoint[]): string =>
  route
    .map((point) => {
      const coords = point.coordinates
        ? `${formatCoordinateInput(point.coordinates[0])},${formatCoordinateInput(point.coordinates[1])}`
        : '';
      return [
        point.id,
        point.type,
        point.placeId ?? '',
        point.name,
        point.description ?? '',
        coords,
      ].join('|');
    })
    .join('>');

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

  const routeMatchesSaved = useMemo(
    () => routeSignature(route) === routeSignature(trip.route),
    [route, trip.route],
  );
  const routeGeometry = routeMatchesSaved ? trip.routeGeometry : null;
  const routingState = routeMatchesSaved ? trip.routingState : null;
  const summary = useMemo(
    () => (routeMatchesSaved && trip.routeSummary
      ? trip.routeSummary
      : estimateRouteSummary(route, trip.transport)),
    [route, routeMatchesSaved, trip.routeSummary, trip.transport],
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
      setEditError(i18nT('trips:components.trips.planning.RouteBuilder.vvedite_nazvanie_tochki_65a2f141'));
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
      const name = i18nT('trips:components.trips.planning.RouteBuilder.tochka_value1_58a44f4e', { value1: nextIndex + 1 });
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
    updateTripRoute.mutate(
      { tripId: trip.id, route },
      {
        onSuccess: (updatedTrip) => {
          setRoute(updatedTrip.route);
        },
      },
    );
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
            accessibilityLabel={i18nT('trips:components.trips.planning.RouteBuilder.redaktirovat_tochku_8815b389')}
            onPress={() => handleStartEdit(point, index)}
            style={styles.ctrl}
            testID={`route-builder-edit-${index}`}
          >
            <Feather name="edit-2" size={15} color={colors.primaryDark} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nT('trips:components.trips.planning.RouteBuilder.podnyat_tochku_vyshe_23208202')}
            disabled={index === 0}
            onPress={() => handleMove(index, -1)}
            style={[styles.ctrl, index === 0 && styles.ctrlDisabled]}
          >
            <Feather name="chevron-up" size={16} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nT('trips:components.trips.planning.RouteBuilder.opustit_tochku_nizhe_c1c13a3e')}
            disabled={index === route.length - 1}
            onPress={() => handleMove(index, 1)}
            style={[styles.ctrl, index === route.length - 1 && styles.ctrlDisabled]}
          >
            <Feather name="chevron-down" size={16} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18nT('trips:components.trips.planning.RouteBuilder.udalit_tochku_37161453')}
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
        <Text style={styles.heading}>{i18nT('trips:components.trips.planning.RouteBuilder.marshrut_49482da4')}</Text>
        <TripPlanRouteMap
          route={route}
          routeGeometry={routeGeometry}
          routingState={routingState}
          summary={summary}
          transport={trip.transport}
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
          <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.marshrut_poka_ne_postroen_fbdcf5ed')}</Text>
        )}
        <RouteSummaryBar summary={summary} routingState={routingState} transport={trip.transport} />
      </View>
    );
  }

  const templates = templatesQuery.data ?? [];

  return (
    <View style={styles.wrap} testID="route-builder">
      <Text style={styles.heading}>{i18nT('trips:components.trips.planning.RouteBuilder.konstruktor_marshruta_187e063e')}</Text>

      <TripPlanRouteMap
        route={route}
        routeGeometry={routeGeometry}
        routingState={routingState}
        summary={summary}
        transport={trip.transport}
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
        <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.dobavte_pervuyu_tochku_marshruta_nizhe_d7cb9f9e')}</Text>
      )}

      <View style={styles.addForm}>
        <Text style={styles.label}>{i18nT('trips:components.trips.planning.RouteBuilder.dobavit_tochku_60ab5746')}</Text>
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
              placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nayti_mesto_ili_puteshestvie_na_metravel_8780d31c')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              testID="route-builder-site-search"
            />
            {siteSearchStatus === 'loading' ? (
              <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.ischem_sovpadeniya_b077a7ac')}</Text>
            ) : null}
            {siteSearchStatus === 'error' ? (
              <Text style={styles.errorText}>{i18nT('trips:components.trips.planning.RouteBuilder.ne_udalos_zagruzit_varianty_a38206ee')}</Text>
            ) : null}
            {siteSearchStatus === 'ready' && !siteOptions.length ? (
              <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.nichego_ne_naydeno_b39815ed')}</Text>
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
                        {option.kind === 'travel' ? i18nT('trips:components.trips.planning.RouteBuilder.puteshestvie_7cbf3a43') : i18nT('trips:components.trips.planning.RouteBuilder.mesto_3991f739')}
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
              placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nazvanie_tochki_0cdacb0f')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              testID="route-builder-name"
            />
            <View style={styles.coordRow}>
              <TextInput
                value={newLat}
                onChangeText={setNewLat}
                placeholder={i18nT('trips:components.trips.planning.RouteBuilder.shirota_lat_6d696d4a')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, styles.coordInput]}
                testID="route-builder-lat"
              />
              <TextInput
                value={newLng}
                onChangeText={setNewLng}
                placeholder={i18nT('trips:components.trips.planning.RouteBuilder.dolgota_lng_f08c3647')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, styles.coordInput]}
                testID="route-builder-lng"
              />
            </View>
            <TextInput
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder={i18nT('trips:components.trips.planning.RouteBuilder.opisanie_po_zhelaniyu_3bb69cb4')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              testID="route-builder-description"
            />
            <Button
              label={i18nT('trips:components.trips.planning.RouteBuilder.dobavit_tochku_60ab5746')}
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
          <Text style={styles.label}>{i18nT('trips:components.trips.planning.RouteBuilder.redaktirovat_tochku_8815b389')}</Text>
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
            placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nazvanie_tochki_0cdacb0f')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="route-builder-edit-name"
          />
          <View style={styles.coordRow}>
            <TextInput
              value={editLat}
              onChangeText={setEditLat}
              placeholder={i18nT('trips:components.trips.planning.RouteBuilder.shirota_lat_6d696d4a')}
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.coordInput]}
              testID="route-builder-edit-lat"
            />
            <TextInput
              value={editLng}
              onChangeText={setEditLng}
              placeholder={i18nT('trips:components.trips.planning.RouteBuilder.dolgota_lng_f08c3647')}
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, styles.coordInput]}
              testID="route-builder-edit-lng"
            />
          </View>
          <TextInput
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder={i18nT('trips:components.trips.planning.RouteBuilder.opisanie_ili_ssylka_po_zhelaniyu_2a1ab272')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="route-builder-edit-description"
          />
          {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
          <View style={styles.editActions}>
            <Button
              label={i18nT('trips:components.trips.planning.RouteBuilder.sohranit_tochku_467b8cde')}
              onPress={handleSaveEdit}
              variant="secondary"
              disabled={!editName.trim()}
              testID="route-builder-edit-save"
            />
            <Button
              label={i18nT('trips:components.trips.planning.RouteBuilder.otmena_cb0c29f2')}
              onPress={handleCancelEdit}
              variant="ghost"
              testID="route-builder-edit-cancel"
            />
          </View>
        </View>
      ) : null}

      {templates.length ? (
        <View style={styles.templates}>
          <Text style={styles.label}>{i18nT('trips:components.trips.planning.RouteBuilder.shablony_marshruta_083d49d2')}</Text>
          {templates.map((tpl) => (
            <View key={tpl.id} style={styles.templateRow}>
              <View style={styles.templateBody}>
                <Text style={styles.templateTitle}>{tpl.title}</Text>
                <Text style={styles.templateDescription}>{tpl.description}</Text>
              </View>
              <Button
                label={i18nT('trips:components.trips.planning.RouteBuilder.primenit_12ea5d97')}
                onPress={() => handleApplyTemplate(tpl.points)}
                variant="ghost"
                testID={`route-builder-template-${tpl.id}`}
              />
            </View>
          ))}
        </View>
      ) : null}

      <RouteSummaryBar summary={summary} routingState={routingState} transport={trip.transport} />

      <Button
        label={i18nT('trips:components.trips.planning.RouteBuilder.sohranit_marshrut_31633565')}
        onPress={handleSave}
        loading={updateTripRoute.isPending}
        disabled={updateTripRoute.isPending}
        fullWidth
        testID="route-builder-save"
      />
    </View>
  );
}

export default React.memo(RouteBuilder);
