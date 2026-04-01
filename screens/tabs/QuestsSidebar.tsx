import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { ThemedColors } from '@/hooks/useTheme';

import type { City, NearbyCity } from './questsShared';
import { pluralizeQuest } from './questsShared';

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
    nearbyRadiusKm: number;
    areAllCountryGroupsCollapsed: boolean;
    collapsedCountryCodes: Record<string, boolean>;
    citiesByCountry: CountryGroup[];
    cityQuestCountById: Record<string, number>;
    spacingMd: number;
    onSelectCity: (id: string) => void;
    onSetViewMode: (mode: 'list' | 'map') => void;
    onToggleCountryGroup: (code: string) => void;
    onToggleAllCountryGroups: () => void;
    onSetRadius: (km: number) => void;
};

export default function QuestsSidebar({
    styles,
    colors,
    viewMode,
    selectedCityId,
    nearbyId,
    nearbyRadiusKm,
    areAllCountryGroupsCollapsed,
    collapsedCountryCodes,
    citiesByCountry,
    cityQuestCountById,
    spacingMd,
    onSelectCity,
    onSetViewMode,
    onToggleCountryGroup,
    onToggleAllCountryGroups,
    onSetRadius,
}: QuestsSidebarProps) {
    return (
        <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Приключения</Text>
                <Text style={styles.sidebarSubtitle}>
                    Раскрой тайны городов через загадки и легенды
                </Text>
                <View style={styles.sidebarActions}>
                    <Pressable
                        style={[
                            styles.actionBtn,
                            viewMode === 'map' && styles.actionBtnSecondary,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={viewMode === 'map' ? 'Показать квесты списком' : 'Показать квесты на карте'}
                        onPress={() => onSetViewMode(viewMode === 'map' ? 'list' : 'map')}
                    >
                        <Feather name={viewMode === 'map' ? 'list' : 'map'} size={16} color={viewMode === 'map' ? colors.text : colors.textOnPrimary} />
                        <Text style={[styles.actionBtnText, viewMode === 'map' && styles.actionBtnTextSecondary]}>
                            {viewMode === 'map' ? 'Показать списком' : 'Показать на карте'}
                        </Text>
                    </Pressable>
                </View>
            </View>

            <ScrollView
                style={styles.sidebarScroll}
                contentContainerStyle={{ paddingBottom: spacingMd }}
                showsVerticalScrollIndicator
            >
                <View style={styles.cityListSection}>
                    <Text style={styles.cityListLabel}>Выбор местоположения</Text>
                    <Pressable
                        onPress={() => onSelectCity(nearbyId)}
                        style={[styles.cityItem, selectedCityId === nearbyId && styles.cityItemActive]}
                        accessibilityRole="button"
                        accessibilityLabel={`Рядом, ${pluralizeQuest(cityQuestCountById[nearbyId] || 0)}`}
                        accessibilityState={{ selected: selectedCityId === nearbyId }}
                    >
                        <View style={styles.cityItemLeft}>
                            <View style={[styles.cityItemIcon, selectedCityId === nearbyId && styles.cityItemIconActive]}>
                                <Feather name="navigation" size={18} color={selectedCityId === nearbyId ? colors.textOnPrimary : colors.textMuted} />
                            </View>
                            <Text style={[styles.cityItemText, selectedCityId === nearbyId && styles.cityItemTextActive]}>
                                Рядом со мной
                            </Text>
                        </View>
                    </Pressable>
                </View>

                {citiesByCountry.length > 0 && (
                    <View style={styles.countryToolsSection}>
                        <Pressable
                            onPress={onToggleAllCountryGroups}
                            style={styles.collapseAllBtn}
                            accessibilityRole="button"
                            accessibilityLabel={areAllCountryGroupsCollapsed ? 'Развернуть все страны' : 'Свернуть все страны'}
                        >
                            <Feather
                                name={areAllCountryGroupsCollapsed ? 'chevrons-down' : 'chevrons-up'}
                                size={14}
                                color={colors.textMuted}
                            />
                            <Text style={styles.collapseAllBtnText}>
                                {areAllCountryGroupsCollapsed ? 'Развернуть все' : 'Свернуть все'}
                            </Text>
                        </Pressable>
                    </View>
                )}

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
                                                <Feather name={isActive ? 'compass' : 'map-pin'} size={18} color={isActive ? colors.textOnPrimary : colors.textMuted} />
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

                {selectedCityId === nearbyId && (
                    <View style={styles.radiusSection}>
                        <Text style={styles.radiusLabel}>Радиус:</Text>
                        {[5, 10, 15, 20, 30].map((km) => (
                            <Pressable
                                key={km}
                                onPress={() => onSetRadius(km)}
                                style={[styles.radiusChip, nearbyRadiusKm === km && styles.radiusChipActive]}
                                accessibilityRole="button"
                                accessibilityLabel={`Радиус ${km} км`}
                            >
                                <Text style={[styles.radiusChipText, nearbyRadiusKm === km && styles.radiusChipTextActive]}>
                                    {km} км
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
