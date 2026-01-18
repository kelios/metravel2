import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { userPointsApi } from '@/src/api/userPoints';
import { PointCard } from '@/components/UserPoints/PointCard';
import { PointFilters } from '@/components/UserPoints/PointFilters';
import { PointsMap } from '@/components/UserPoints/PointsMap';
import AddressSearch from '@/components/MapPage/AddressSearch';
import FormFieldWithValidation from '@/components/FormFieldWithValidation';
import SimpleMultiSelect from '@/components/SimpleMultiSelect';
import type { PointFilters as PointFiltersType } from '@/types/userPoints';
import { CATEGORY_LABELS, COLOR_CATEGORIES, PointCategory, PointColor, PointStatus, STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type ViewMode = 'list' | 'map';

type PointsListProps = {
  onImportPress?: () => void;
};

export const PointsList: React.FC<PointsListProps> = ({ onImportPress }) => {
  const [filters, setFilters] = useState<PointFiltersType>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [showActions, setShowActions] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendationsNonce, setRecommendationsNonce] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualCoords, setManualCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [manualColor, setManualColor] = useState<PointColor>(PointColor.BLUE);
  const [manualCategory, setManualCategory] = useState<PointCategory>(PointCategory.OTHER);
  const [manualStatus, setManualStatus] = useState<PointStatus>(PointStatus.PLANNING);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const isNarrow = windowWidth < 420;
  const isMobile = Platform.OS !== 'web';

  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['userPoints', filters],
    queryFn: () => userPointsApi.getPoints(filters),
  });

  // If backend errors (or not ready) — treat as empty list.
  const points = useMemo(() => {
    if (error) return [];
    return data?.data || [];
  }, [data?.data, error]);

  const availableCategoryOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const p of points) {
      if (p?.category) unique.add(String(p.category));
    }

    if (unique.size === 0) {
      unique.add(PointCategory.OTHER);
    }

    return Array.from(unique)
      .map((value) => ({
        value,
        label: CATEGORY_LABELS[value as PointCategory] ?? value,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [points]);

  const resetManualForm = useCallback(() => {
    setManualName('');
    setManualAddress('');
    setManualCoords(null);
    setManualColor(PointColor.BLUE);
    setManualCategory(PointCategory.OTHER);
    setManualStatus(PointStatus.PLANNING);
    setManualError(null);
  }, []);

  const closeManualAdd = useCallback(() => {
    setShowManualAdd(false);
    resetManualForm();
  }, [resetManualForm]);

  const openManualAdd = useCallback(() => {
    setShowActions(false);
    resetManualForm();
    setShowManualAdd(true);
  }, [resetManualForm]);

  const handleMapPress = useCallback(
    (coords: { lat: number; lng: number }) => {
      setViewMode('map');
      setShowActions(false);
      resetManualForm();
      setManualCoords(coords);
      setShowManualAdd(true);
    },
    [resetManualForm]
  );

  useEffect(() => {
    if (!showManualAdd) return;
    const isValid = availableCategoryOptions.some((o) => o.value === manualCategory);
    if (!isValid) {
      const first = availableCategoryOptions[0]?.value as PointCategory | undefined;
      if (first) setManualCategory(first);
    }
  }, [availableCategoryOptions, manualCategory, showManualAdd]);

  const handleSaveManual = useCallback(async () => {
    setManualError(null);
    const name = manualName.trim();
    if (!name) {
      setManualError('Введите название точки');
      return;
    }
    if (!manualCoords) {
      setManualError('Укажите адрес или координаты');
      return;
    }

    setIsSavingManual(true);
    try {
      await userPointsApi.createPoint({
        name,
        address: manualAddress || undefined,
        latitude: manualCoords.lat,
        longitude: manualCoords.lng,
        color: manualColor,
        category: manualCategory,
        status: manualStatus,
      } as any);

      closeManualAdd();
      await refetch();
    } catch (e) {
      setManualError(e instanceof Error ? e.message : 'Не удалось сохранить точку');
    } finally {
      setIsSavingManual(false);
    }
  }, [closeManualAdd, manualAddress, manualCategory, manualColor, manualCoords, manualName, manualStatus, refetch]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setFilters(prev => ({ ...prev, search: text }));
  };

  const handleFilterChange = (newFilters: PointFiltersType) => {
    setFilters(newFilters);
  };

  const handleLocateMe = useCallback(async () => {
    setIsLocating(true);
    setViewMode('map');

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          return;
        }

        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
          });
        });

        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        return;
      }

      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm?.granted) {
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    } catch {
      // noop
    } finally {
      setIsLocating(false);
    }
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={[styles.titleRow, isNarrow && styles.titleRowNarrow]}>
        <View>
          <Text style={styles.title}>Мои точки</Text>
          <Text style={styles.subtitle}>
            Всего: {data?.total || 0} точек
          </Text>
        </View>

        <View style={isNarrow ? styles.headerActionsNarrow : styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, isMobile && styles.headerIconButton]}
            onPress={() => setShowActions(true)}
            accessibilityRole="button"
            accessibilityLabel="Добавить"
          >
            {isMobile ? (
              <Feather name="plus" size={18} color={colors.text} />
            ) : (
              <Text style={styles.headerButtonText}>Добавить</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, isMobile && styles.headerIconButton]}
            onPress={() => setShowFilters((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
          >
            {isMobile ? (
              <Feather name="filter" size={18} color={colors.text} />
            ) : (
              <Text style={styles.headerButtonText}>
                {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.recoOpenButton, isMobile && styles.headerIconButtonPrimary]}
            onPress={() => setShowRecommendations(true)}
            accessibilityRole="button"
            accessibilityLabel="Куда поехать сегодня"
          >
            {isMobile ? (
              <Feather name="compass" size={18} color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.recoOpenButtonText}>Куда поехать сегодня</Text>
            )}
          </TouchableOpacity>

          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewButton, isMobile && styles.viewIconButton, viewMode === 'list' && styles.viewButtonActive]}
              onPress={() => setViewMode('list')}
              accessibilityRole="button"
              accessibilityLabel="Список"
            >
              {isMobile ? (
                <Feather
                  name="list"
                  size={18}
                  color={viewMode === 'list' ? colors.textOnPrimary : colors.textMuted}
                />
              ) : (
                <Text style={[styles.viewButtonText, viewMode === 'list' && styles.viewButtonTextActive]}>
                  Список
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewButton, isMobile && styles.viewIconButton, viewMode === 'map' && styles.viewButtonActive]}
              onPress={() => setViewMode('map')}
              accessibilityRole="button"
              accessibilityLabel="Карта"
            >
              {isMobile ? (
                <Feather
                  name="map"
                  size={18}
                  color={viewMode === 'map' ? colors.textOnPrimary : colors.textMuted}
                />
              ) : (
                <Text style={[styles.viewButtonText, viewMode === 'map' && styles.viewButtonTextActive]}>
                  Карта
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по названию..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {showFilters && (
        <PointFilters filters={filters} onChange={handleFilterChange} />
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Точки не найдены</Text>
      <Text style={styles.emptySubtext}>
        Импортируйте точки из Google Maps или OpenStreetMap
      </Text>
    </View>
  );

  const recommendations = useMemo(() => {
    // include nonce so clicking "Обновить" reshuffles
    void recommendationsNonce;
    if (!points.length) return [];

    const copy = [...points];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy.slice(0, 3);
  }, [points, recommendationsNonce]);

  return (
    <View style={styles.container}>
      {viewMode === 'list' ? (
        <FlatList
          data={points}
          renderItem={({ item }) => <PointCard point={item} />}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={!isLoading ? renderEmpty : null}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={refetch}
        />
      ) : (
        <View style={styles.mapContainer}>
          {renderHeader()}
          <View style={styles.mapInner}>
            <PointsMap
              points={points}
              center={currentLocation ?? undefined}
              onMapPress={handleMapPress}
              pendingMarker={showManualAdd ? manualCoords : null}
            />

            <TouchableOpacity
              style={[styles.locateFab, isLocating && styles.locateFabDisabled]}
              onPress={handleLocateMe}
              disabled={isLocating}
              accessibilityRole="button"
              accessibilityLabel="Моё местоположение"
            >
              <Feather name="crosshair" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <View style={styles.actionsOverlay}>
          <Pressable
            style={styles.actionsBackdrop}
            onPress={() => setShowActions(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть меню"
          />

          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Действия</Text>

            <TouchableOpacity
              style={styles.actionsItem}
              onPress={() => {
                setShowActions(false);
                onImportPress?.();
              }}
              accessibilityRole="button"
              accessibilityLabel="Импорт"
            >
              <Text style={styles.actionsItemText}>Импорт</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionsItem}
              onPress={openManualAdd}
              accessibilityRole="button"
              accessibilityLabel="Добавить вручную"
            >
              <Text style={styles.actionsItemText}>Добавить вручную</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionsItem, styles.actionsItemCancel]}
              onPress={() => setShowActions(false)}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.actionsItemCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showManualAdd}
        transparent
        animationType="fade"
        onRequestClose={closeManualAdd}
      >
        <View style={styles.manualOverlay}>
          <Pressable
            style={styles.manualBackdrop}
            onPress={closeManualAdd}
            accessibilityRole="button"
            accessibilityLabel="Закрыть форму"
          />
          <View style={styles.manualModal}>
            <View style={styles.manualHeader}>
              <Text style={styles.manualTitle}>Добавить точку вручную</Text>
              <TouchableOpacity
                style={styles.manualHeaderButton}
                onPress={closeManualAdd}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <Text style={styles.manualHeaderButtonText}>Закрыть</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.manualScroll} contentContainerStyle={styles.manualScrollContent}>
              <FormFieldWithValidation label="Название" required error={manualError && !manualName.trim() ? manualError : null}>
                <TextInput
                  style={styles.manualInput}
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="Например: Любимое кафе"
                  placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                />
              </FormFieldWithValidation>

              <FormFieldWithValidation label="Адрес или координаты" required error={manualError && !manualCoords ? manualError : null}>
                <AddressSearch
                  placeholder="Введите адрес или lat, lng"
                  enableCoordinateInput
                  value={manualAddress}
                  onAddressSelect={(address, coords) => {
                    setManualAddress(address);
                    setManualCoords(coords);
                  }}
                />
              </FormFieldWithValidation>

              <FormFieldWithValidation label="Цвет" required>
                <SimpleMultiSelect
                  data={Object.entries(COLOR_CATEGORIES).map(([value, info]) => ({ value, label: (info as any).label }))}
                  value={[manualColor]}
                  onChange={(vals) => {
                    const v = vals[0] as PointColor | undefined;
                    if (v) setManualColor(v);
                  }}
                  labelField="label"
                  valueField="value"
                  search={false}
                />
              </FormFieldWithValidation>

              <FormFieldWithValidation label="Категория" required>
                <SimpleMultiSelect
                  data={availableCategoryOptions}
                  value={[manualCategory]}
                  onChange={(vals) => {
                    const v = vals[0] as PointCategory | undefined;
                    if (v) setManualCategory(v);
                  }}
                  labelField="label"
                  valueField="value"
                  search
                />
              </FormFieldWithValidation>

              <FormFieldWithValidation label="Статус" required>
                <SimpleMultiSelect
                  data={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                  value={[manualStatus]}
                  onChange={(vals) => {
                    const v = vals[0] as PointStatus | undefined;
                    if (v) setManualStatus(v);
                  }}
                  labelField="label"
                  valueField="value"
                  search={false}
                />
              </FormFieldWithValidation>

              {manualError && manualName.trim() && manualCoords ? (
                <Text style={styles.manualErrorText}>{manualError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.manualFooter}>
              <TouchableOpacity
                style={[styles.manualSaveButton, isSavingManual && styles.manualSaveButtonDisabled]}
                onPress={handleSaveManual}
                disabled={isSavingManual}
                accessibilityRole="button"
                accessibilityLabel="Сохранить точку"
              >
                <Text style={styles.manualSaveButtonText}>
                  {isSavingManual ? 'Сохранение…' : 'Сохранить'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRecommendations}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecommendations(false)}
      >
        <View style={styles.recoOverlay}>
          <TouchableOpacity
            style={styles.recoBackdrop}
            activeOpacity={1}
            onPress={() => setShowRecommendations(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть рекомендации"
          />

          <View style={styles.recoModal}>
            <View style={styles.recoHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recoTitle}>Куда поехать сегодня</Text>
                <Text style={styles.recoSubtitle}>3 случайные точки</Text>
              </View>

              <TouchableOpacity
                style={styles.recoHeaderButton}
                onPress={() => setRecommendationsNonce((v) => v + 1)}
                accessibilityRole="button"
                accessibilityLabel="Обновить рекомендации"
              >
                <Text style={styles.recoHeaderButtonText}>Обновить</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.recoHeaderButton}
                onPress={() => setShowRecommendations(false)}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
              >
                <Text style={styles.recoHeaderButtonText}>Закрыть</Text>
              </TouchableOpacity>
            </View>

            {!points.length ? (
              <View style={styles.recoEmpty}>
                <Text style={styles.recoEmptyText}>Нет точек</Text>
                <Text style={styles.recoEmptySubtext}>
                  Импортируйте или добавьте точки вручную, чтобы получить рекомендации
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.recoScroll}
                contentContainerStyle={styles.recoScrollContent}
              >
                {recommendations.map((p) => (
                  <PointCard key={p.id} point={p} />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: DESIGN_TOKENS.spacing.xl,
  },
  header: {
    padding: DESIGN_TOKENS.spacing.lg,
    backgroundColor: colors.surface,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  titleRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerActionsNarrow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    justifyContent: 'center',
  },
  headerIconButton: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonPrimary: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700' as any,
    color: colors.text,
  },
  recoOpenButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  recoOpenButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700' as any,
    color: colors.textOnPrimary,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '700' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  subtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 2,
  },
  viewButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
  viewIconButton: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonActive: {
    backgroundColor: colors.primary,
  },
  viewButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: '600' as any,
  },
  viewButtonTextActive: {
    color: colors.textOnPrimary,
  },
  mapContainer: {
    flex: 1,
  },
  mapInner: {
    flex: 1,
  },
  locateFab: {
    position: 'absolute',
    right: DESIGN_TOKENS.spacing.lg,
    bottom: DESIGN_TOKENS.spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  locateFabDisabled: {
    opacity: 0.6,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : null),
  },
  actionsOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  actionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  actionsModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: DESIGN_TOKENS.spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionsTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  actionsItem: {
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  actionsItemText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700' as any,
    color: colors.text,
  },
  actionsItemCancel: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  actionsItemCancelText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700' as any,
    color: colors.textMuted,
    textAlign: 'center',
  },
  manualOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  manualBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  manualModal: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualHeader: {
    padding: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  manualTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800' as any,
    color: colors.text,
    flex: 1,
  },
  manualHeaderButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualHeaderButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700' as any,
    color: colors.text,
  },
  manualScroll: {
    flex: 1,
  },
  manualScrollContent: {
    padding: DESIGN_TOKENS.spacing.lg,
  },
  manualInput: {
    backgroundColor: colors.surface,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualFooter: {
    padding: DESIGN_TOKENS.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  manualSaveButton: {
    backgroundColor: colors.primary,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
  },
  manualSaveButtonDisabled: {
    opacity: 0.7,
  },
  manualSaveButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '800' as any,
  },
  manualErrorText: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    color: colors.danger,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600' as any,
  },
  searchContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  searchInput: {
    backgroundColor: colors.surface,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  filterButtonText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
  },
  emptyContainer: {
    padding: DESIGN_TOKENS.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  emptySubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.xl,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    color: colors.danger,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
  },
  recoOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  recoBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  recoModal: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
  },
  recoHeader: {
    padding: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  recoTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700' as any,
    color: colors.text,
  },
  recoSubtitle: {
    marginTop: 2,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  recoHeaderButton: {
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recoHeaderButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600' as any,
    color: colors.text,
  },
  recoScroll: {
    flex: 1,
  },
  recoScrollContent: {
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },
  recoEmpty: {
    padding: DESIGN_TOKENS.spacing.xl,
    alignItems: 'center',
  },
  recoEmptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  recoEmptySubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
