import EmptyState from '@/components/ui/EmptyState';
import QuestLandingLoadError from '@/components/quests/QuestLandingLoadError';
import { translate as i18nT } from '@/i18n'

type Props = {
    styles: React.ComponentProps<typeof QuestLandingLoadError>['styles'];
    /** #3379: чанк движка поиска не загрузился и после повторов — ошибка с «Повторить». */
    retrySearch?: () => void;
    searchActive: boolean;
    empty: boolean;
    isMapAreaActive: boolean;
    nearbyWithLocation: boolean;
    citySelected: boolean;
    completedSlice: boolean;
    isMobile: boolean;
    onClearSearch: () => void;
    onResetFilters: () => void;
};

/**
 * Пустые состояния каталога квестов (#3379 (е)). Все они клиентские — ждут
 * гидратации (`dataLoaded`) или действия посетителя, — поэтому живут ленивым
 * чанком, а не в стартовом `__shared:quests-catalog`.
 */
export default function QuestsCatalogEmptyStates({
    styles,
    retrySearch,
    searchActive,
    empty,
    isMapAreaActive,
    nearbyWithLocation,
    citySelected,
    completedSlice,
    isMobile,
    onClearSearch,
    onResetFilters,
}: Props) {
    if (retrySearch) return <QuestLandingLoadError styles={styles} onRetry={retrySearch} />;
    return (
        <>
            {searchActive && empty && (
                <EmptyState
                    density="compact"
                    icon="search"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.nichego_ne_naydeno_21857ccf')}
                    description={i18nT('quests:screens.tabs.QuestsContentPanel.poprobuyte_drugoe_nazvanie_ili_gorod_980ce716')}
                    variant="empty"
                    action={{
                        label: i18nT('quests:screens.tabs.QuestsContentPanel.ochistit_poisk_c6fc5f29'),
                        onPress: onClearSearch,
                    }}
                />
            )}

            {!searchActive && empty && (isMapAreaActive || nearbyWithLocation) && (
                <EmptyState
                    density="compact"
                    icon="map-pin"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.ryadom_nichego_ne_naydeno_271dd8e7')}
                    description={i18nT('quests:screens.tabs.QuestsContentPanel.posmotrite_kvesty_v_drugih_gorodah_ili_vyber_720d6ffd')}
                    variant="empty"
                />
            )}

            {!searchActive && !citySelected && (
                <EmptyState
                    density="compact"
                    icon="compass"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.vyberite_gorod_023bdfab')}
                    description={isMobile ? i18nT('quests:screens.tabs.QuestsContentPanel.nazhmite_gorod_chtoby_vybrat_bdb9cf3e') : i18nT('quests:screens.tabs.QuestsContentPanel.vyberite_gorod_iz_spiska_sleva_3a187f1e')}
                    variant="empty"
                />
            )}

            {/* «Пройденные» — единственный срез, который может оказаться пустым при
                живом фильтре: пустая сетка без объяснения выглядела бы как
                сломанный каталог, поэтому здесь явное состояние с выходом обратно. */}
            {!searchActive && !isMapAreaActive && completedSlice && empty && (
                <EmptyState
                    density="compact"
                    icon="check-circle"
                    title={i18nT('quests:screens.tabs.QuestsContentPanel.completedEmptyTitle')}
                    description={i18nT('quests:screens.tabs.QuestsContentPanel.completedEmptyDescription')}
                    variant="empty"
                    action={{
                        label: i18nT('quests:screens.tabs.QuestsContentPanel.completedEmptyAction'),
                        onPress: onResetFilters,
                    }}
                />
            )}
        </>
    );
}
