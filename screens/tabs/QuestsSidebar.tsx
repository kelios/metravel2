import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import NavigationIcon from '@/components/layout/NavigationIcon';
import type { NavigationIconName } from '@/constants/navigationIcons';
import { useResponsive } from '@/hooks/useResponsive';
import type { ThemedColors } from '@/hooks/useTheme';

import type { City, NearbyCity } from './questsShared';
import { pluralizeQuest } from './questsShared';
import { COMPLETED_FILTER_ID, REVIEWED_FILTER_ID, UNCOMPLETED_FILTER_ID } from './QuestsScreen.helpers';
import { translate as i18nT } from '@/i18n'


type SidebarActionButtonProps = {
    styles: any;
    colors: ThemedColors;
    isMobile: boolean;
    icon: NavigationIconName;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onPress: () => void;
    accessibilityLabel: string;
    accessibilityState?: Record<string, boolean>;
    testID?: string;
    labelAlign?: 'start' | 'end';
};

// Иконка-действие в шапке сайдбара. На мобильном — квадратная icon-only кнопка
// (подпись только в accessibilityLabel/title). На вебе — та же квадратная
// кнопка, а подпись при наведении всплывает отдельным чипом ПОД ней: чип
// абсолютный и не трогает раскладку ряда, поэтому кнопка не меняет размер и не
// может уехать из-под курсора (иначе hover сбрасывался бы и кнопка дёргалась).
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
    labelAlign = 'start',
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
                <NavigationIcon name={icon} size={18} color={iconColor} />
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
            <NavigationIcon name={icon} size={18} color={iconColor} />
            <View
                pointerEvents="none"
                style={[
                    styles.sidebarActionPillLabelWrap,
                    labelAlign === 'end'
                        ? styles.sidebarActionPillLabelWrapEnd
                        : styles.sidebarActionPillLabelWrapStart,
                    isOpen && styles.sidebarActionPillLabelWrapOpen,
                ]}
            >
                <Text numberOfLines={1} style={styles.sidebarActionPillLabel}>
                    {label}
                </Text>
            </View>
        </Pressable>
    );
}

type SidebarFilterRowProps = {
    styles: any;
    colors: ThemedColors;
    iconSize: number;
    icon: React.ComponentProps<typeof Feather>['name'];
    label: string;
    count: number;
    active: boolean;
    onPress: () => void;
    accessibilityLabel: string;
    testID: string;
};

// Виртуальный срез каталога в списке городов: та же строка, что и город, но с
// собственной иконкой. Отдельным компонентом — потому что таких срезов уже
// три (отзывы, пройденные, не пройденные), и порознь они разъезжались бы в
// разметке и состояниях.
function SidebarFilterRow({
    styles,
    colors,
    iconSize,
    icon,
    label,
    count,
    active,
    onPress,
    accessibilityLabel,
    testID,
}: SidebarFilterRowProps) {
    return (
        <Pressable
            onPress={onPress}
            style={[styles.cityItem, active && styles.cityItemActive]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: active }}
            testID={testID}
        >
            <View style={styles.cityItemLeft}>
                <View style={[styles.cityItemIcon, active && styles.cityItemIconActive]}>
                    <Feather name={icon} size={iconSize} color={active ? colors.textOnPrimary : colors.textMuted} />
                </View>
                <Text style={[styles.cityItemText, active && styles.cityItemTextActive]}>
                    {label}
                </Text>
            </View>
            <View style={[styles.cityItemCount, active && styles.cityItemCountActive]}>
                <Text style={[styles.cityItemCountText, active && styles.cityItemCountTextActive]}>
                    {count}
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
    testID?: string;
    viewMode: 'list' | 'map';
    selectedCityId: string | null;
    nearbyRequesting: boolean;
    nearbyId: string;
    kidsFilterId: string;
    bikeFilterId: string;
    /** Личные срезы каталога показываются только вошедшему игроку (#1791). */
    showCompletedFilter?: boolean;
    showUncompletedFilter?: boolean;
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
    testID,
    viewMode,
    selectedCityId,
    nearbyRequesting,
    nearbyId,
    kidsFilterId,
    bikeFilterId,
    showCompletedFilter = false,
    showUncompletedFilter = false,
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
    const isBikeSelected = selectedCityId === bikeFilterId;
    const reviewedQuestCount = cityQuestCountById[REVIEWED_FILTER_ID] || 0;
    const isReviewedSelected = selectedCityId === REVIEWED_FILTER_ID;
    const completedQuestCount = cityQuestCountById[COMPLETED_FILTER_ID] || 0;
    const uncompletedQuestCount = cityQuestCountById[UNCOMPLETED_FILTER_ID] || 0;
    const isCompletedSelected = selectedCityId === COMPLETED_FILTER_ID;
    const isUncompletedSelected = selectedCityId === UNCOMPLETED_FILTER_ID;
    const mapActionActive = viewMode === 'map';
    const mapActionLabel = viewMode === 'map' ? i18nT('quests:screens.tabs.QuestsSidebar.pokazat_kvesty_spiskom_0029a3b3') : i18nT('quests:screens.tabs.QuestsSidebar.pokazat_kvesty_na_karte_d06a6df4');
    const toggleAllLabel = areAllCountryGroupsCollapsed ? i18nT('quests:screens.tabs.QuestsSidebar.razvernut_vse_strany_58a7fc2c') : i18nT('quests:screens.tabs.QuestsSidebar.svernut_vse_strany_ee35b08d');
    const nearbyQuestCount = cityQuestCountById[nearbyId];
    const nearbyAccessibilityLabel = typeof nearbyQuestCount === 'number'
        ? i18nT('quests:screens.tabs.QuestsSidebar.ryadom_so_mnoy_value1_3b987cd8', { value1: pluralizeQuest(nearbyQuestCount) })
        : i18nT('quests:screens.tabs.QuestsSidebar.ryadom_so_mnoy_28d9b150');

    return (
        <View style={styles.sidebar} testID={testID}>
            <View style={styles.sidebarHeader}>
                <View style={styles.sidebarTitleRow}>
                    <Text style={styles.sidebarTitle}>{i18nT('quests:screens.tabs.QuestsSidebar.priklyucheniya_32619ed3')}</Text>
                    {onCloseDrawer && (
                        <Pressable
                            onPress={onCloseDrawer}
                            style={styles.sidebarCloseBtn}
                            accessibilityRole="button"
                            accessibilityLabel={i18nT('quests:screens.tabs.QuestsSidebar.zakryt_menyu_8f129c26')}
                            hitSlop={8}
                        >
                            <Feather name="x" size={20} color={colors.text} />
                        </Pressable>
                    )}
                </View>
                <Text style={styles.sidebarSubtitle}>
                    {i18nT('quests:screens.tabs.QuestsSidebar.raskroy_tayny_gorodov_cherez_zagadki_i_legen_d6d8c5ad')}</Text>
                <View style={styles.sidebarActions}>
                    <SidebarActionButton
                        styles={styles}
                        colors={colors}
                        isMobile={isMobile}
                        icon={viewMode === 'map' ? 'list' : 'map'}
                        label={viewMode === 'map' ? i18nT('quests:screens.tabs.QuestsSidebar.pokazat_spiskom_b48809cc') : i18nT('quests:screens.tabs.QuestsSidebar.pokazat_na_karte_6180ef1d')}
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
                        label={i18nT('quests:screens.tabs.QuestsSidebar.ryadom_so_mnoy_28d9b150')}
                        active={isNearbySelected}
                        disabled={nearbyRequesting}
                        onPress={() => onSelectCity(nearbyId)}
                        accessibilityLabel={nearbyAccessibilityLabel}
                        accessibilityState={{ selected: isNearbySelected, disabled: nearbyRequesting }}
                        testID="quests-sidebar-nearby-button"
                    />
                    <SidebarActionButton
                        styles={styles}
                        colors={colors}
                        isMobile={isMobile}
                        icon="smile"
                        label={i18nT('quests:screens.tabs.QuestsSidebar.dlya_detey_1655148c')}
                        active={isKidsSelected}
                        onPress={() => onSelectCity(kidsFilterId)}
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsSidebar.kvesty_dlya_detey_value1_29205187', { value1: pluralizeQuest(cityQuestCountById[kidsFilterId] || 0) })}
                        accessibilityState={{ selected: isKidsSelected }}
                        testID="quests-sidebar-kids-button"
                    />
                    <SidebarActionButton
                        styles={styles}
                        colors={colors}
                        isMobile={isMobile}
                        icon="bike"
                        label={i18nT('quests:screens.tabs.QuestsSidebar.veloLabel')}
                        active={isBikeSelected}
                        onPress={() => onSelectCity(bikeFilterId)}
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsSidebar.veloA11y', { value1: pluralizeQuest(cityQuestCountById[bikeFilterId] || 0) })}
                        accessibilityState={{ selected: isBikeSelected }}
                        testID="quests-sidebar-bike-button"
                        labelAlign="end"
                    />
                    <SidebarActionButton
                        styles={styles}
                        colors={colors}
                        isMobile={isMobile}
                        icon={areAllCountryGroupsCollapsed ? 'chevrons-down' : 'chevrons-up'}
                        label={areAllCountryGroupsCollapsed ? i18nT('quests:screens.tabs.QuestsSidebar.razvernut_vse_d7cac57a') : i18nT('quests:screens.tabs.QuestsSidebar.svernut_vse_c847c584')}
                        disabled={!hasCountryGroups}
                        onPress={onToggleAllCountryGroups}
                        accessibilityLabel={toggleAllLabel}
                        accessibilityState={{ expanded: !areAllCountryGroupsCollapsed, disabled: !hasCountryGroups }}
                        testID="quests-sidebar-toggle-all-countries"
                        labelAlign="end"
                    />
                </View>
            </View>

            <ScrollView
                style={styles.sidebarScroll}
                contentContainerStyle={{ paddingBottom: spacingMd }}
                showsVerticalScrollIndicator
            >
                {reviewedQuestCount > 0 && (
                    <SidebarFilterRow
                        styles={styles}
                        colors={colors}
                        iconSize={iconSize}
                        icon="message-circle"
                        label={i18nT('quests:screens.tabs.QuestsSidebar.reviewedLabel')}
                        count={reviewedQuestCount}
                        active={isReviewedSelected}
                        onPress={() => onSelectCity(REVIEWED_FILTER_ID)}
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsSidebar.reviewedA11y', { value1: pluralizeQuest(reviewedQuestCount) })}
                        testID="quests-sidebar-reviewed-button"
                    />
                )}
                {showCompletedFilter && (
                    <SidebarFilterRow
                        styles={styles}
                        colors={colors}
                        iconSize={iconSize}
                        icon="check-circle"
                        label={i18nT('quests:screens.tabs.QuestsSidebar.completedLabel')}
                        count={completedQuestCount}
                        active={isCompletedSelected}
                        onPress={() => onSelectCity(COMPLETED_FILTER_ID)}
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsSidebar.completedA11y', { value1: pluralizeQuest(completedQuestCount) })}
                        testID="quests-sidebar-completed-button"
                    />
                )}
                {showUncompletedFilter && (
                    <SidebarFilterRow
                        styles={styles}
                        colors={colors}
                        iconSize={iconSize}
                        icon="circle"
                        label={i18nT('quests:screens.tabs.QuestsSidebar.uncompletedLabel')}
                        count={uncompletedQuestCount}
                        active={isUncompletedSelected}
                        onPress={() => onSelectCity(UNCOMPLETED_FILTER_ID)}
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsSidebar.uncompletedA11y', { value1: pluralizeQuest(uncompletedQuestCount) })}
                        testID="quests-sidebar-uncompleted-button"
                    />
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
                                accessibilityLabel={i18nT('quests:screens.tabs.QuestsSidebar.value1_gruppu_value2_value3_b04a718c', { value1: isCollapsed
                                    ? i18nT('quests:screens.tabs.QuestsSidebar.actions.expand')
                                    : i18nT('quests:screens.tabs.QuestsSidebar.actions.collapse'), value2: group.name || group.code, value3: pluralizeQuest(countryQuestCount) })}
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
