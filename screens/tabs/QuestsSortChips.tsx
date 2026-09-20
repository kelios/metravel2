import { memo } from 'react';
import { Pressable, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { translate as i18nT, type TranslationKey } from '@/i18n';

import type { QuestSortOrder } from './questsShared';

/**
 * Ряд чипов выбора порядка каталога (#1988).
 *
 * Вынесен из `QuestsContentPanel` не ради красоты: вместе с чипами панель
 * переваливала документированный порог 800 LOC
 * (`docs/features/quests.md` → «Порог guard-скрипта»), а поймать это гейтом
 * было нельзя — `scripts/guard-file-complexity-changed.js` берёт baseline из
 * `HEAD`, то есть из коммита, который порог уже перешагнул.
 */

/** Стабильная пустая ссылка: дефолт-литерал в пропсах ломал бы мемоизацию. */
export const EMPTY_SORT_ORDERS: QuestSortOrder[] = [];

/**
 * Витрина вариантов порядка. Держим списком, а не ветками в разметке:
 * добавление третьего критерия не должно множить копии одного и того же чипа.
 */
const SORT_ORDER_CHIPS: {
    order: Exclude<QuestSortOrder, 'default'>;
    icon: 'trending-up' | 'star';
    testID: string;
    // Именно `TranslationKey`, а не `string`: с `string` опечатка в ключе
    // компилируется молча, а на web `i18nT` принимает уже инлайненный babel'ем
    // литерал — заявленный `string` разошёлся бы с фактическим значением.
    labelKey: TranslationKey;
    onKey: TranslationKey;
    offKey: TranslationKey;
}[] = [
    {
        order: 'popular',
        icon: 'trending-up',
        testID: 'quests-sort-popular',
        labelKey: 'quests:screens.tabs.QuestsContentPanel.popularSortLabel',
        onKey: 'quests:screens.tabs.QuestsContentPanel.popularSortA11yOn',
        offKey: 'quests:screens.tabs.QuestsContentPanel.popularSortA11yOff',
    },
    {
        order: 'rating',
        icon: 'star',
        testID: 'quests-sort-rating',
        labelKey: 'quests:screens.tabs.QuestsContentPanel.ratingSortLabel',
        onKey: 'quests:screens.tabs.QuestsContentPanel.ratingSortA11yOn',
        offKey: 'quests:screens.tabs.QuestsContentPanel.ratingSortA11yOff',
    },
];

type QuestsSortChipsProps = {
    styles: any;
    colors: { primary: string; textOnPrimary: string };
    availableSortOrders: QuestSortOrder[];
    activeSortOrder: QuestSortOrder;
    onSelectSortOrder: (order: QuestSortOrder) => void;
};

function QuestsSortChips({
    styles,
    colors,
    availableSortOrders,
    activeSortOrder,
    onSelectSortOrder,
}: QuestsSortChipsProps) {
    return (
        <>
            {SORT_ORDER_CHIPS.map((chip) => {
                if (!availableSortOrders.includes(chip.order)) return null;
                const isActive = activeSortOrder === chip.order;
                return (
                    <Pressable
                        key={chip.order}
                        style={[styles.sortChip, isActive && styles.sortChipActive]}
                        onPress={() => onSelectSortOrder(chip.order)}
                        accessibilityRole="button"
                        accessibilityLabel={isActive ? i18nT(chip.offKey) : i18nT(chip.onKey)}
                        accessibilityState={{ selected: isActive }}
                        hitSlop={8}
                        testID={chip.testID}
                    >
                        <Feather
                            name={chip.icon}
                            size={13}
                            color={isActive ? colors.textOnPrimary : colors.primary}
                        />
                        <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                            {i18nT(chip.labelKey)}
                        </Text>
                    </Pressable>
                );
            })}
        </>
    );
}

export default memo(QuestsSortChips);
