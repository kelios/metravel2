// screens/tabs/QuestsFilterPanel.tsx
// Боковая панель фильтров для страницы квестов.
import React, { useMemo } from 'react';
import {
    View, Text, StyleSheet, Pressable, Platform,
    ScrollView, TextInput, Modal, Animated, Dimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import SelectComponent from '@/components/forms/SelectComponent';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';

const { spacing, radii, typography } = DESIGN_TOKENS;
const NEARBY_ID = '__nearby__';

/** Drawer width adapts: 85% of screen (min 260, max 340) */
const getDrawerWidth = () => {
    const screenW = Dimensions.get('window').width;
    return Math.min(340, Math.max(260, Math.round(screenW * 0.85)));
};

type CityQuickFilter = 'all' | 'withQuests' | 'nearby';

type City = { id: string; name: string; country?: string; lat?: number; lng?: number };

export interface QuestsFilterPanelProps {
    selectedCityId: string | null;
    onSelectCity: (id: string) => void;
    citySearchQuery: string;
    onCitySearchChange: (q: string) => void;
    cityQuickFilter: CityQuickFilter;
    onCityQuickFilterChange: (f: CityQuickFilter) => void;
    nearbyRadiusKm: number;
    onRadiusChange: (km: number) => void;
    prioritizedCities: City[];
    cityQuestCountById: Record<string, number>;
    citiesWithNearbyCount: number;
    userLoc: { lat: number; lng: number } | null;
    dataLoaded: boolean;
    isMobile?: boolean;
}

/* ─── Filter panel content (used in both sidebar and drawer) ─── */

export function QuestsFilterContent({
    selectedCityId, onSelectCity,
    citySearchQuery, onCitySearchChange,
    cityQuickFilter, onCityQuickFilterChange,
    nearbyRadiusKm, onRadiusChange,
    prioritizedCities, cityQuestCountById, citiesWithNearbyCount,
    userLoc, dataLoaded, isMobile,
}: QuestsFilterPanelProps) {
    const colors = useThemedColors();
    const s = useMemo(() => panelStyles(colors, !!isMobile), [colors, isMobile]);

    return (
        <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {/* Section header */}
            <View style={s.sectionHeader}>
                <Text style={s.sectionLabel}>Город</Text>
                <View style={s.sectionCountBadge}>
                    <Text style={s.sectionCountText}>{citiesWithNearbyCount}</Text>
                </View>
            </View>

            {!dataLoaded ? (
                <View style={s.skeletonCol}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonLoader key={i} width="100%" height={44} borderRadius={radii.sm} />
                    ))}
                </View>
            ) : (
                <>
                    {/* Search */}
                    <View style={s.searchWrap}>
                        <Feather name="search" size={14} color={colors.textMuted} style={s.searchIcon} />
                        <TextInput
                            value={citySearchQuery}
                            onChangeText={onCitySearchChange}
                            placeholder="Поиск…"
                            placeholderTextColor={colors.textMuted}
                            style={s.searchInput}
                            autoCorrect={false}
                            autoCapitalize="none"
                            clearButtonMode="while-editing"
                        />
                    </View>

                    {/* Quick filter chips */}
                    <View style={s.chipsRow}>
                        {([
                            { id: 'all' as CityQuickFilter, label: 'Все' },
                            { id: 'withQuests' as CityQuickFilter, label: 'С квестами' },
                            { id: 'nearby' as CityQuickFilter, label: 'Рядом' },
                        ]).map((f) => (
                            <Chip
                                key={f.id}
                                label={f.label}
                                selected={cityQuickFilter === f.id}
                                onPress={() => onCityQuickFilterChange(f.id)}
                            />
                        ))}
                    </View>

                    {/* Desktop native select (hidden on mobile) */}
                    {Platform.OS === 'web' && !isMobile ? (
                        <SelectComponent
                            value={selectedCityId || ''}
                            onChange={(v) => { if (v) onSelectCity(v); }}
                            options={prioritizedCities.map((c) => ({
                                value: c.id,
                                label: `${c.id === NEARBY_ID ? 'Рядом' : c.name} (${cityQuestCountById[c.id] || 0})`,
                            }))}
                            placeholder="Выберите локацию"
                        />
                    ) : null}

                    {/* City list */}
                    <View style={s.cityList}>
                        {prioritizedCities.map((item) => {
                            const active = selectedCityId === item.id;
                            const count = cityQuestCountById[item.id] || 0;
                            const isNearby = item.id === NEARBY_ID;
                            return (
                                <Pressable
                                    key={item.id}
                                    onPress={() => onSelectCity(item.id)}
                                    style={({ pressed }) => [s.cityCard, active && s.cityCardActive, pressed && s.cityCardPressed]}
                                >
                                    <View style={s.cityCardLeft}>
                                        <View style={[s.cityIcon, active && s.cityIconActive]}>
                                            <Feather
                                                name={isNearby ? 'navigation' : 'map-pin'}
                                                size={12}
                                                color={active ? colors.primaryText : colors.textMuted}
                                            />
                                        </View>
                                        <View style={s.cityTextBlock}>
                                            <Text style={[s.cityName, active && s.cityNameActive]} numberOfLines={1}>
                                                {isNearby ? 'Рядом' : item.name}
                                            </Text>
                                            {isNearby && (
                                                <Text style={s.cityHint} numberOfLines={1}>
                                                    {userLoc ? 'по геолокации' : 'гео отключена'}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    {count > 0 && (
                                        <View style={[s.countBadge, active && s.countBadgeActive]}>
                                            <Text style={[s.countBadgeText, active && s.countBadgeTextActive]}>{count}</Text>
                                        </View>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>

                    {prioritizedCities.length === 0 ? (
                        <EmptyState
                            icon="search"
                            title="Не найдено"
                            description="Попробуйте изменить запрос."
                            variant="search"
                            iconSize={36}
                        />
                    ) : null}
                </>
            )}

            {/* Radius (only for Nearby) */}
            {selectedCityId === NEARBY_ID && (
                <>
                    <View style={s.divider} />
                    <View style={s.sectionHeader}>
                        <Text style={s.sectionLabel}>Радиус</Text>
                    </View>
                    <View style={s.chipsRow}>
                        {[2, 5, 10, 15, 20].map((km) => (
                            <Chip
                                key={km}
                                label={`${km} км`}
                                selected={nearbyRadiusKm === km}
                                onPress={() => onRadiusChange(km)}
                            />
                        ))}
                    </View>
                </>
            )}
        </ScrollView>
    );
}

/* ─── Mobile drawer wrapper ─── */

export function QuestsFilterDrawer({
    visible, onClose, ...filterProps
}: QuestsFilterPanelProps & { visible: boolean; onClose: () => void }) {
    const colors = useThemedColors();
    const drawerW = useMemo(getDrawerWidth, []);
    const s = useMemo(() => drawerStyles(colors, drawerW), [colors, drawerW]);
    const slideAnim = React.useRef(new Animated.Value(-1)).current;
    const shouldUseNativeDriver = false;

    React.useEffect(() => {
        if (visible) {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: shouldUseNativeDriver,
            }).start();
        } else {
            slideAnim.setValue(-1);
        }
    }, [visible, slideAnim, shouldUseNativeDriver]);

    return (
        <Modal
            visible={visible}
            animationType="none"
            transparent
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={s.overlay}>
                <Animated.View
                    style={[
                        s.panel,
                        {
                            transform: [{
                                translateX: slideAnim.interpolate({
                                    inputRange: [-1, 0],
                                    outputRange: [-drawerW, 0],
                                }),
                            }],
                        },
                    ]}
                >
                    {/* Drawer header */}
                    <View style={s.drawerHeader}>
                        <View style={s.drawerTitleRow}>
                            <Feather name="compass" size={16} color={colors.primary} />
                            <Text style={s.drawerTitle}>Город</Text>
                        </View>
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Закрыть фильтры"
                            style={s.closeBtn}
                        >
                            <Feather name="x" size={18} color={colors.text} />
                        </Pressable>
                    </View>
                    <QuestsFilterContent {...filterProps} isMobile />
                </Animated.View>

                {/* Backdrop */}
                <Pressable
                    style={s.backdrop}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Закрыть фильтры"
                />
            </View>
        </Modal>
    );
}

/* ─── Styles ─── */

function panelStyles(colors: ThemedColors, isMobile: boolean) {
    return StyleSheet.create({
        scroll: { flex: 1 },
        scrollContent: { paddingVertical: spacing.sm, gap: spacing.sm, paddingBottom: spacing.xl },

        sectionHeader: {
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        },
        sectionLabel: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        sectionCountBadge: {
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
        sectionCountText: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '700',
        },

        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.backgroundSecondary,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.borderLight,
            paddingHorizontal: spacing.sm,
            height: isMobile ? 44 : 36,
            gap: spacing.xs,
        },
        searchIcon: { flexShrink: 0 },
        searchInput: {
            flex: 1,
            height: '100%',
            color: colors.text,
            fontSize: typography.sizes.sm,
            ...Platform.select({ web: { outlineStyle: 'none' } as any }),
        },

        chipsRow: {
            flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs,
        },

        cityList: { gap: 2 },
        cityCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.xs,
            paddingVertical: isMobile ? 10 : 7,
            borderRadius: radii.sm,
            minHeight: isMobile ? DESIGN_TOKENS.touchTarget.minHeight : undefined,
            gap: spacing.xs,
            ...Platform.select({ web: { transition: 'background-color 0.12s ease', cursor: 'pointer' } as any }),
        },
        cityCardActive: { backgroundColor: colors.primarySoft },
        cityCardPressed: { opacity: 0.75 },
        cityCardLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            flex: 1,
            minWidth: 0,
        },
        cityIcon: {
            width: 26,
            height: 26,
            borderRadius: radii.sm,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        },
        cityIconActive: {
            backgroundColor: colors.primarySoft,
        },
        cityTextBlock: {
            flex: 1,
            minWidth: 0,
        },
        cityName: {
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: '500',
            flexShrink: 1,
        },
        cityNameActive: { color: colors.primaryText, fontWeight: '700' },
        cityHint: { color: colors.textMuted, fontSize: 10, marginTop: 1 },

        countBadge: {
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.borderLight,
            minWidth: 24,
            alignItems: 'center',
            flexShrink: 0,
        },
        countBadgeActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        countBadgeText: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '700',
            textAlign: 'center',
        },
        countBadgeTextActive: {
            color: colors.textOnPrimary,
        },

        divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.xs },

        skeletonCol: { gap: spacing.xs },
    });
}

function drawerStyles(colors: ThemedColors, drawerWidth: number) {
    return StyleSheet.create({
        overlay: {
            flex: 1, flexDirection: 'row',
        },
        panel: {
            width: drawerWidth, backgroundColor: colors.surface,
            borderRightWidth: 1, borderRightColor: colors.borderLight,
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.xl,
            ...Platform.select({
                web: { boxShadow: (colors.boxShadows as any)?.heavy } as any,
                android: { elevation: 8 },
                default: {},
            }),
        },
        backdrop: {
            flex: 1, backgroundColor: colors.overlay ?? 'rgba(0,0,0,0.45)',
        },
        drawerHeader: {
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: Platform.OS === 'ios' ? spacing.xxl : spacing.md,
            paddingBottom: spacing.sm,
            borderBottomWidth: 1, borderBottomColor: colors.borderLight,
            marginBottom: spacing.xxs,
        },
        drawerTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
        },
        drawerTitle: {
            color: colors.text,
            fontSize: typography.sizes.md,
            fontWeight: '800',
            letterSpacing: -0.3,
        },
        closeBtn: {
            width: DESIGN_TOKENS.touchTarget.minWidth,
            height: DESIGN_TOKENS.touchTarget.minHeight,
            borderRadius: radii.pill,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.borderLight,
        },
    });
}

