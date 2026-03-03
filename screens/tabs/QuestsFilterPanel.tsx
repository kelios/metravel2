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

const sx = (...args: Array<object | false | null | undefined>) =>
    StyleSheet.flatten(args.filter(Boolean));

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
            {/* Section: Location */}
            <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Локация</Text>
                <Text style={s.sectionMeta}>{citiesWithNearbyCount}</Text>
            </View>

            {!dataLoaded ? (
                <View style={s.skeletonCol}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonLoader key={i} width="100%" height={44} borderRadius={radii.sm} />
                    ))}
                </View>
            ) : (
                <>
                    <TextInput
                        value={citySearchQuery}
                        onChangeText={onCitySearchChange}
                        placeholder="Поиск города…"
                        placeholderTextColor={colors.textMuted}
                        style={s.searchInput}
                        autoCorrect={false}
                        autoCapitalize="none"
                        clearButtonMode="while-editing"
                    />

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

                    {/* Desktop select */}
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

                    {/* City list (vertical in panel) */}
                    <View style={s.cityList}>
                        {prioritizedCities.map((item) => {
                            const active = selectedCityId === item.id;
                            const count = cityQuestCountById[item.id] || 0;
                            return (
                                <Pressable
                                    key={item.id}
                                    onPress={() => onSelectCity(item.id)}
                                    style={sx(s.cityCard, active && s.cityCardActive)}
                                >
                                    <View style={s.cityTopRow}>
                                        <Text style={sx(s.cityName, active && s.cityNameActive)} numberOfLines={1}>
                                            {item.id === NEARBY_ID ? 'Рядом' : item.name}
                                        </Text>
                                        <Text style={s.questsCount}>{count}</Text>
                                    </View>
                                    {item.id === NEARBY_ID ? (
                                        <Text style={s.cityHint} numberOfLines={1}>
                                            {userLoc ? 'по геолокации' : 'гео отключена'}
                                        </Text>
                                    ) : null}
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
                    <View style={[s.divider]} />
                    <Text style={s.sectionTitle}>Радиус поиска</Text>
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
    const shouldUseNativeDriver = Platform.OS !== 'web';

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
    }, [visible, slideAnim]);

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
                        <Text style={s.drawerTitle}>Фильтры</Text>
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel="Закрыть фильтры"
                            style={s.closeBtn}
                        >
                            <Feather name="x" size={20} color={colors.text} />
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
        scrollContent: { paddingVertical: spacing.sm, gap: isMobile ? spacing.xs : spacing.sm },

        sectionHeader: {
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
        },
        sectionTitle: {
            color: colors.text, fontSize: isMobile ? typography.sizes.xs : typography.sizes.sm,
            fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
        },
        sectionMeta: { color: colors.textMuted, fontSize: typography.sizes.xs, fontWeight: '600' },

        searchInput: {
            height: isMobile ? 40 : 38,
            minHeight: DESIGN_TOKENS.touchTarget.minHeight,
            borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.surface, borderRadius: radii.sm,
            paddingHorizontal: spacing.sm, color: colors.text,
            fontSize: typography.sizes.sm,
        },

        chipsRow: {
            flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs,
        },

        cityList: { gap: isMobile ? 2 : spacing.xxs },
        cityCard: {
            paddingHorizontal: spacing.sm,
            paddingVertical: isMobile ? spacing.sm : spacing.xs,
            borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.surface,
            minHeight: isMobile ? DESIGN_TOKENS.touchTarget.minHeight : undefined,
            justifyContent: 'center',
            ...Platform.select({ web: { transition: 'all 0.15s ease', cursor: 'pointer' } as any }),
        },
        cityCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        cityTopRow: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs,
        },
        cityName: { color: colors.text, fontSize: typography.sizes.sm, fontWeight: '600', flexShrink: 1 },
        cityNameActive: { color: colors.primaryText, fontWeight: '700' },
        questsCount: {
            color: colors.textMuted, fontSize: typography.sizes.xs, fontWeight: '600',
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: spacing.xxs + 2, paddingVertical: 1,
            borderRadius: radii.pill, overflow: 'hidden',
            minWidth: 22, textAlign: 'center',
        },
        cityHint: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

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
            borderRightWidth: 1, borderRightColor: colors.border,
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
        },
        drawerTitle: {
            color: colors.text, fontSize: typography.sizes.md, fontWeight: '700',
        },
        closeBtn: {
            width: DESIGN_TOKENS.touchTarget.minWidth,
            height: DESIGN_TOKENS.touchTarget.minHeight,
            borderRadius: radii.sm,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.backgroundSecondary,
        },
    });
}

