import { memo } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { QUEST_CARD_BASE_HEIGHT, QUEST_CARD_PHONE_HEIGHT, QUESTS_GRID_MIN_COLUMN_WIDTH } from '@/constants/questLayout';
import { translate as i18nT } from '@/i18n';
import { webViewStyle } from '@/utils/webProps';

import { pluralizeQuest } from './questsShared';

/**
 * Каркас каталога квестов до прихода данных (#2170).
 *
 * Этот кадр есть в статическом HTML и на медленной сети держится десятки
 * секунд, поэтому он обязан занимать ровно то место, которое займёт контент:
 * иначе шапка каталога и всё, что под ней, прыгает в момент ответа API
 * (замер прода 04.10.2026: строка счётчика с чипом сортировки сдвигала тело
 * каталога на 38 px, CLS 0,036).
 */

type GridSkeletonProps = {
    styles: any;
    radius: number;
};

// На web каркас одинаков до и после гидратации на любой ширине: число колонок
// и высоту клетки считает CSS, а не признак «телефон». Серверная разметка
// всегда узкая (ширина на сервере неизвестна), и каркас, зависящий от неё,
// на широком экране перекладывался при гидратации — вторая клетка выезжала
// из-под сгиба во вторую колонку (замер прода 05.10.2026: CLS 0,034 на 1280 и
// 0,057 на 1440).
const SKELETON_CELLS = Platform.OS === 'web' ? 6 : 2;

/** Клетки той же сетки и той же пропорции, что у `QuestCard`. */
export const QuestsGridSkeleton = memo(function QuestsGridSkeleton({ styles, radius }: GridSkeletonProps) {
    return (
        <View style={[styles.questsGrid, placeholderStyles.grid]} testID="quests-grid-skeleton">
            {Array.from({ length: SKELETON_CELLS }).map((_, i) => (
                <View key={i} style={placeholderStyles.cell}>
                    {/* Плашка позиционирована абсолютно: высота клетки приходит из
                        aspect-ratio, а процент от такой высоты у потомка в потоке
                        считается не во всех браузерах. */}
                    <SkeletonLoader width="100%" height="100%" borderRadius={radius} style={StyleSheet.absoluteFill} />
                </View>
            ))}
        </View>
    );
});

type CountPlaceholderProps = {
    styles: any;
    /** Появится ли после загрузки чип сортировки: уверенно это известно только для полного каталога. */
    withSortChip: boolean;
};

/**
 * Строка «N квестов» и чип сортировки до ответа API. Рисуются теми же стилями
 * и тем же текстом, что настоящие, поэтому перенос строки на узком экране
 * совпадает в любой локали; сам текст прозрачен, виден только контур.
 */
export const QuestsCountPlaceholder = memo(function QuestsCountPlaceholder({
    styles,
    withSortChip,
}: CountPlaceholderProps) {
    return (
        <>
            <Text style={[styles.contentCount, placeholderStyles.ghostText]} aria-hidden>
                {pluralizeQuest(100)}
            </Text>
            {withSortChip && (
                <View style={[styles.sortChip, placeholderStyles.ghostChip]} aria-hidden testID="quests-sort-placeholder">
                    <View style={placeholderStyles.ghostIcon} />
                    <Text style={[styles.sortChipText, placeholderStyles.ghostText]}>
                        {i18nT('quests:screens.tabs.QuestsContentPanel.popularSortLabel')}
                    </Text>
                </View>
            )}
        </>
    );
});

const placeholderStyles = StyleSheet.create({
    grid: Platform.select<ViewStyle>({
        // Та же формула, что у широкой сетки каталога; на телефоне она даёт одну колонку.
        web: webViewStyle({
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${QUESTS_GRID_MIN_COLUMN_WIDTH}px), 1fr))`,
        }),
        default: {},
    }),
    cell: {
        width: '100%',
        ...Platform.select<ViewStyle>({
            // Пропорция, которую `QuestCard` считает из ширины трека сетки.
            web: { aspectRatio: QUESTS_GRID_MIN_COLUMN_WIDTH / QUEST_CARD_BASE_HEIGHT },
            default: { height: QUEST_CARD_PHONE_HEIGHT },
        }),
    },
    ghostText: {
        color: 'transparent',
    },
    ghostChip: {
        borderColor: 'transparent',
    },
    // Иконка чипа: Feather 13 px.
    ghostIcon: {
        width: 13,
        height: 13,
    },
});
