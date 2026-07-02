// components/trips/planning/RouteBuilder.tsx
// Конструктор маршрута поездки (Sprint 13 / блок D): список точек с reorder/delete
// (web-safe, без нативных drag-либ), inline-добавление точки, применение шаблонов
// и живая сводка через estimateRouteSummary. Только владелец может редактировать.
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import Button from '@/components/ui/Button';
import RouteSummaryBar from '@/components/trips/planning/RouteSummaryBar';
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

  const summary = useMemo(
    () => estimateRouteSummary(route, trip.transport),
    [route, trip.transport],
  );

  const handleMove = (index: number, delta: number) => {
    setRoute((prev) => move(prev, index, index + delta));
  };

  const handleDelete = (index: number) => {
    setRoute((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const lat = parseFloat(newLat.replace(',', '.'));
    const lng = parseFloat(newLng.replace(',', '.'));
    const coordinates: [number, number] | null =
      Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
    const description = newDescription.trim();

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
          <Text style={styles.pointDescription}>{point.description}</Text>
        ) : null}
      </View>
      {trip.isOwner ? (
        <View style={styles.pointControls}>
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
      </View>

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
