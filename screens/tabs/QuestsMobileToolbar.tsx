import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import NavigationIcon from '@/components/layout/NavigationIcon';
import { translate as i18nT } from '@/i18n';
import type { QuestThemeEntry } from './questsShared';

const EMPTY_THEMES: QuestThemeEntry[] = [];

/**
 * Липкая шапка каталога квестов на телефоне.
 *
 * Правило проекта: фиксированная шапка на мобильном не выше ~20% вьюпорта
 * (390×844 → низ не ниже 169px вместе с глобальной шапкой 64px). Прежняя
 * компоновка — заголовок в две строки, пять квадратных кнопок, чипы в два ряда
 * и поиск — занимала 201px, низ уезжал на 265px. Здесь в шапке остаются только
 * два ряда:
 *
 * 1. поиск + «карта/список» + «выбрать город» — действия, нужные в любой точке
 *    прокрутки;
 * 2. горизонтальная лента чипов: сброс, «Для детей», «Вело», «Рядом со мной» и
 *    порядок каталога. Подпись видна прямо на чипе — раньше «детские», «вело» и
 *    «рядом» были безымянными иконками, которые угадывались только по
 *    `accessibilityLabel`.
 *
 * Заголовок с количеством квестов уходит в начало списка (`QuestsContentPanel`)
 * и прокручивается вместе с ним.
 */

type QuestsMobileToolbarProps = {
    styles: any;
    colors: any;
    searchField: ReactNode;
    sortChips: ReactNode;
    viewMode: 'list' | 'map';
    onToggleViewMode: () => void;
    onOpenFilterDrawer: () => void;
    selectedCityId: string | null;
    kidsFilterId: string;
    bikeFilterId: string;
    nearbyId: string;
    onShowKids: () => void;
    onShowBike: () => void;
    /** Чипы тематических подборок (#2377): только темы с квестами. */
    themeChips?: QuestThemeEntry[];
    onShowTheme?: (selectionId: string) => void;
    onShowNearby: () => void;
    geoRequesting: boolean;
    showResetChip: boolean;
    onResetFilters: () => void;
};

type ToolbarChipProps = {
    styles: any;
    icon: ReactNode;
    label: string;
    onPress: () => void;
    accessibilityLabel: string;
    testID: string;
    active?: boolean;
    disabled?: boolean;
};

/**
 * Чип ленты: прозрачная зона касания 44px, внутри — пилюля 32px. `hitSlop`
 * не годится: RN-web Pressable его не поддерживает, и на mobile web касание
 * сжималось бы до видимой пилюли.
 */
function ToolbarChip({
    styles,
    icon,
    label,
    onPress,
    accessibilityLabel,
    testID,
    active = false,
    disabled = false,
}: ToolbarChipProps) {
    return (
        <Pressable
            style={styles.mobileChipHit}
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: active, disabled }}
            testID={testID}
        >
            <View style={[styles.sortChip, active && styles.sortChipActive, disabled && styles.headerIconBtnDisabled]}>
                {icon}
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{label}</Text>
            </View>
        </Pressable>
    );
}

function QuestsMobileToolbar({
    styles,
    colors,
    searchField,
    sortChips,
    viewMode,
    onToggleViewMode,
    onOpenFilterDrawer,
    selectedCityId,
    kidsFilterId,
    bikeFilterId,
    nearbyId,
    onShowKids,
    onShowBike,
    themeChips = EMPTY_THEMES,
    onShowTheme = () => {},
    onShowNearby,
    geoRequesting,
    showResetChip,
    onResetFilters,
}: QuestsMobileToolbarProps) {
    const kidsActive = selectedCityId === kidsFilterId;
    const bikeActive = selectedCityId === bikeFilterId;
    const nearbyActive = selectedCityId === nearbyId;
    const chipIconColor = (active: boolean) => (active ? colors.textOnPrimary : colors.primary);

    return (
        <View style={styles.contentHeader} testID="quests-content-header">
            <View style={styles.mobileToolbarRow}>
                <View style={styles.mobileSearchSlot}>{searchField}</View>
                {/* Серверный кадр всегда узкий: на ≥768px `app/global.css` прячет
                    этот контейнер и ленту чипов, а поиск остаётся видимым — так
                    кадр до гидратации совпадает с desktop-шапкой. */}
                <View style={styles.headerToggleRow} testID="quests-mobile-controls">
                    <Pressable
                        style={[styles.headerIconBtn, viewMode === 'map' && styles.headerIconBtnActive]}
                        onPress={onToggleViewMode}
                        accessibilityRole="button"
                        accessibilityLabel={viewMode === 'map' ? i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_spisok_kvestov_a0806030') : i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_kvesty_na_karte_afca9878')}
                        testID="quests-toggle-view-mode"
                    >
                        <Feather
                            name={viewMode === 'map' ? 'list' : 'map'}
                            size={17}
                            color={viewMode === 'map' ? colors.textOnPrimary : colors.text}
                        />
                    </Pressable>
                    <Pressable
                        style={styles.headerIconBtn}
                        onPress={onOpenFilterDrawer}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.vybrat_gorod_0bc4253e')}
                        testID="quests-open-filters"
                    >
                        <Feather name="filter" size={17} color={colors.text} />
                    </Pressable>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.mobileChipScroller}
                contentContainerStyle={styles.mobileChipScrollerContent}
                testID="quests-mobile-chips"
            >
                {showResetChip && (
                    <ToolbarChip
                        styles={styles}
                        icon={<Feather name="x" size={13} color={colors.primary} />}
                        label={i18nT('quests:screens.tabs.QuestsContentPanel.vse_kvesty_1c003efd')}
                        onPress={onResetFilters}
                        accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.sbrosit_filtry_i_pokazat_vse_kvesty_79d935b0')}
                        testID="quests-reset-filters"
                    />
                )}
                <ToolbarChip
                    styles={styles}
                    active={kidsActive}
                    icon={<Feather name="smile" size={13} color={chipIconColor(kidsActive)} />}
                    label={i18nT('quests:screens.tabs.QuestsSidebar.dlya_detey_1655148c')}
                    onPress={onShowKids}
                    accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_kvesty_dlya_detey_dd437d45')}
                    testID="quests-show-kids"
                />
                <ToolbarChip
                    styles={styles}
                    active={bikeActive}
                    icon={<NavigationIcon name="bike" size={13} color={chipIconColor(bikeActive)} />}
                    label={i18nT('quests:screens.tabs.QuestsSidebar.veloLabel')}
                    onPress={onShowBike}
                    accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.veloShowA11y')}
                    testID="quests-show-bike"
                />
                {themeChips.map((entry) => {
                    const active = selectedCityId === entry.selectionId;
                    return (
                        <ToolbarChip
                            key={entry.selectionId}
                            styles={styles}
                            active={active}
                            icon={<NavigationIcon name={entry.icon} size={13} color={chipIconColor(active)} />}
                            label={entry.label}
                            onPress={() => onShowTheme(entry.selectionId)}
                            accessibilityLabel={i18nT('quests:screens.tabs.QuestsContentPanel.themeShowA11y', { value1: entry.label })}
                            testID={`quests-show-theme-${entry.id}`}
                        />
                    );
                })}
                <ToolbarChip
                    styles={styles}
                    active={nearbyActive}
                    disabled={geoRequesting}
                    icon={<Feather name="navigation" size={13} color={chipIconColor(nearbyActive)} />}
                    label={i18nT('quests:screens.tabs.QuestsSidebar.ryadom_so_mnoy_28d9b150')}
                    onPress={onShowNearby}
                    accessibilityLabel={geoRequesting ? i18nT('quests:screens.tabs.QuestsContentPanel.ischem_kvesty_ryadom_so_mnoy_f5a72f30') : i18nT('quests:screens.tabs.QuestsContentPanel.pokazat_kvesty_ryadom_so_mnoy_d7a7ee55')}
                    testID="quests-show-nearby"
                />
                {sortChips}
            </ScrollView>
        </View>
    );
}

// Без memo: `searchField` и `sortChips` — свежие узлы на каждый рендер панели.
export default QuestsMobileToolbar;
