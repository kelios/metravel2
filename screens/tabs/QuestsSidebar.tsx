import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { useResponsive } from '@/hooks/useResponsive';
import type { ThemedColors } from '@/hooks/useTheme';

import type { City, NearbyCity } from './questsShared';
import { pluralizeQuest } from './questsShared';

type FeatherName = ComponentProps<typeof Feather>['name'];

type SidebarActionButtonProps = {
    styles: any;
    colors: ThemedColors;
    isMobile: boolean;
    icon: FeatherName;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onPress: () => void;
    accessibilityLabel: string;
    accessibilityState?: Record<string, boolean>;
    testID?: string;
};

// Иконка-действие в шапке сайдбара. На мобильном — квадратная icon-only кнопка
// (подпись только в accessibilityLabel/title). На вебе — пилюля, которая по
// наведению плавно раскрывается и показывает текстовую подпись рядом с иконкой.
function SidebarActionButton({
    styles,
    colors,
    isMobile,
    icon,
    label,
    active = false,
    disabled = false,
    onPress,
    accessibilityLabel,
    accessibilityState,
    testID,
}: SidebarActionButtonProps) {
    const [hovered, setHovered] = useState(false);
    const iconColor = active ? colors.textOnPrimary : colors.text;

    if (isMobile) {
        return (
            <Pressable
                style={[
                    styles.sidebarActionIconBtn,
                    active && styles.sidebarActionIconBtnActive,
                    disabled && styles.sidebarActionIconBtnDisabled,
                ]}
                onPress={onPress}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityState={accessibilityState}
                testID={testID}
                {...({ title: label } as any)}
            >
                <Feather name={icon} size={18} color={iconColor} />
            </Pressable>
        );
    }

    const isOpen = hovered && !disabled;
    return (
        <Pressable
            style={[
                styles.sidebarActionPill,
                active && styles.sidebarActionPillActive,
                disabled && styles.sidebarActionIconBtnDisabled,
            ]}
            onPress={onPress}
            disabled={disabled}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
            testID={testID}
        >
            <Feather name={icon} size={18} color={iconColor} />
            <View style={[styles.sidebarActionPillLabelWrap, isOpen && styles.sidebarActionPillLabelWrapOpen]}>
                <Text
                    numberOfLines={1}
                    style={[styles.sidebarActionPillLabel, active && styles.sidebarActionPillLabelActive]}
                >
                    {label}
                </Text>
            </View>
        </Pressable>
    );
}

type CountryGroup = {
    code: string;
    name: string;
    cities: (City | NearbyCity)[];
};

type QuestsSidebarProps = {
    styles: any;
    colors: ThemedColors;
    viewMode: 'list' | 'map';
    selectedCityId: string | null;
    nearbyId: string;
    kidsFilterId: string;
    areAllCountryGroupsCollapsed: boolean;
    collapsedCountryCodes: Record<string, boolean>;
    citiesByCountry: CountryGroup[];
    cityQuestCountById: Record<string, number>;
    spacingMd: number;
    onSelectCity: (id: string) => void;
    onSetViewMode: (mode: 'list' | 'map') => void;
    onToggleCountryGroup: (code: string) => void;
    onToggleAllCountryGroups: () => void;
    onCloseDrawer?: () => void;
};

export default function QuestsSidebar({
    styles,
    colors,
    viewMode,
    selectedCityId,
    nearbyId,
    kidsFilterId,
    areAllCountryGroupsCollapsed,
    collapsedCountryCodes,
    citiesByCountry,
    cityQuestCountById,
    spacingMd,
    onSelectCity,
    onSetViewMode,
    onToggleCountryGroup,
    onToggleAllCountryGroups,
    onCloseDrawer,
}: QuestsSidebarProps) {
    const { isMobile } = useResponsive();
    const iconSize = isMobile ? 16 : 18;
    const hasCountryGroups = citiesByCountry.length > 0;
    const isNearbySelected = selectedCityId === nearbyId;
    const isKidsSelected = selectedCityId === kidsFilterId;
    const mapActionActive = viewMode === 'map';
    const mapActionLabel = viewMode === 'map' ? 'Показать квесты списком' : 'Показать квесты на карте';
    const toggleAllLabel = areAllCountryGroupsCollapsed ? 'Развернуть все страны' : 'Свернуть все страны';

    return (
        <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
                <View style={styles.sidebarTitleRow}>
                    <Text style={styles.sidebarTitle}>Приключения</Text>
                    {onCloseDrawer && (
                        <Pressable
                            onPress={onCloseDrawer}
                            style={styles.sidebarCloseBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Закрыть меню"
                            hitSlop={8}
                        >
                            <Feather name="x" size={20} color={colors.text} />
                        </Pressable>
                    )}
                </View>
                <Text style={styles.sidebarSubtitle}>
                    Раскрой тайны городов через загадки и легенды
                </Text>
                <View style={styles.sidebarActions}>
                    <SidebarActionButton
                        styles={styles}
                        colors={colors}
                        isMobile={isMobile}
                        icon={viewMode === 'map' ? 'list' : 'map'}
                        label={viewMode === 'map' ? 'Показать списком' : 'Показать на карте'}
                        active={mapActionActive}
                        onPress={() => onSetViewMode(viewMode === 'map' ? 'list' : 'map')}
                        accessibilityLabel={mapActionLabel}
                        accessibilityState={{ selected: mapActionActive }}
                        testID="quests-sidebar-toggle-view-mode"
                    />
                    <SidebarActionButton
                        styles={styles}
                        colors={colors}
                        isMobile={isMobile}
                        icon="navigation"
                        label="Рядом со мной"
                        active={isNearbySelected}
                        onPress={() => onSelectCity(nearbyId)}
                        accessibilityLabel={`Рядом со мной, ${pluralizeQuest(cityQuestCountById[nearbyId] || 0)}`}
                        accessibilityState={{ selected: isNearbySelected }}
                        testID="quests-sidebar-nearby-button"
                    />
                    <SidebarActionButton
                        styles={styles}
                        colors={colors}
                        isMobile={isMobile}
                        icon="book-open"
                        label="Детские сказки"
                        active={isKidsSelected}
                        onPress={() => onSelectCity(kidsFilterId)}
                        accessibilityLabel={`Детские сказки, ${pluralizeQuest(cityQuestCountById[kidsFilterId] || 0)}`}
                        accessibilityState={{ selected: isKidsSelected }}
                        testID="quests-sidebar-kids-button"
                    />
                    <SidebarActionButton
                        styles={styles}
                        colors={colors}
                        isMobile={isMobile}
                        icon={areAllCountryGroupsCollapsed ? 'chevrons-down' : 'chevrons-up'}
                        label={areAllCountryGroupsCollapsed ? 'Развернуть все' : 'Свернуть все'}
                        disabled={!hasCountryGroups}
                        onPress={onToggleAllCountryGroups}
                        accessibilityLabel={toggleAllLabel}
                        accessibilityState={{ expanded: !areAllCountryGroupsCollapsed, disabled: !hasCountryGroups }}
                        testID="quests-sidebar-toggle-all-countries"
                    />
                </View>
            </View>

            <ScrollView
                style={styles.sidebarScroll}
                contentContainerStyle={{ paddingBottom: spacingMd }}
                showsVerticalScrollIndicator
            >
                {citiesByCountry.map((group) => {
                    const isCollapsed = collapsedCountryCodes[group.code] ?? false;
                    const countryQuestCount = group.cities.reduce((acc, city) => acc + (cityQuestCountById[city.id] || 0), 0);
                    return (
                        <View key={group.code} style={styles.cityListSection}>
                            <Pressable
                                onPress={() => onToggleCountryGroup(group.code)}
                                style={styles.countryHeader}
                                accessibilityRole="button"
                                accessibilityLabel={`${isCollapsed ? 'Развернуть' : 'Свернуть'} группу ${group.name || group.code}, ${pluralizeQuest(countryQuestCount)}`}
                                accessibilityState={{ expanded: !isCollapsed }}
                            >
                                <Text style={styles.countryLabel}>{group.name}</Text>
                                <View style={styles.countryHeaderActions}>
                                    <Text style={styles.countryCount}>{pluralizeQuest(countryQuestCount)}</Text>
                                    <Feather
                                        name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                                        size={16}
                                        color={colors.textMuted}
                                    />
                                </View>
                            </Pressable>
                            {!isCollapsed && group.cities.map((city) => {
                                const isActive = selectedCityId === city.id;
                                const count = cityQuestCountById[city.id] || 0;
                                return (
                                    <Pressable
                                        key={city.id}
                                        onPress={() => onSelectCity(city.id)}
                                        style={[styles.cityItem, isActive && styles.cityItemActive]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${city.name}, ${pluralizeQuest(count)}`}
                                        accessibilityState={{ selected: isActive }}
                                    >
                                        <View style={styles.cityItemLeft}>
                                            <View style={[styles.cityItemIcon, isActive && styles.cityItemIconActive]}>
                                                <Feather name={isActive ? 'compass' : 'map-pin'} size={iconSize} color={isActive ? colors.textOnPrimary : colors.textMuted} />
                                            </View>
                                            <Text style={[styles.cityItemText, isActive && styles.cityItemTextActive]}>
                                                {city.name}
                                            </Text>
                                        </View>
                                        {count > 0 && (
                                            <View style={[styles.cityItemCount, isActive && styles.cityItemCountActive]}>
                                                <Text style={[styles.cityItemCountText, isActive && styles.cityItemCountTextActive]}>
                                                    {count}
                                                </Text>
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}
