import { fireEvent, render } from '@testing-library/react-native';
import { FlatList, Platform } from 'react-native';

import QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type { QuestMeta } from '@/utils/questAdapters';

let mockIsMobile = false;
let mockPlayersCount: number | null = null;
const mockUseQuestPlayersCount = jest.fn((enabled?: boolean) => (enabled ? mockPlayersCount : null));

jest.mock('@/hooks/useQuestPlayersCount', () => ({
    useQuestPlayersCount: (enabled?: boolean) => mockUseQuestPlayersCount(enabled),
}));

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: mockIsMobile }),
    // #1826: дерево каталога переведено на ширинную подписку — мок обязан
    // отдавать её тоже, иначе набор падает не на поведении, а на форме модуля.
    useBreakpoints: () => ({
        isMobile: mockIsMobile,
        isSmallPhone: false,
        isPhone: mockIsMobile,
        isTablet: false,
        isLargeTablet: false,
        width: mockIsMobile ? 390 : 1440,
    }),
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/screens/tabs/QuestCard', () => {
    const React = require('react');
    const { Text } = require('react-native');

    return function MockQuestCard({ cityId, quest, index, nearby, cardWidth }: { cityId: string; quest: { id: string; title: string }; index?: number; nearby?: boolean; cardWidth?: number }) {
        return React.createElement(Text, {
            testID: `quest-card-${quest.id}`,
            accessibilityLabel: cityId,
            accessibilityHint: String(index),
            accessibilityState: { selected: Boolean(nearby) },
            style: { width: cardWidth },
        }, quest.title);
    };
});

const HIDDEN = { includeHiddenElements: true } as const;

describe('QuestsContentPanel', () => {
    const styles = {
        content: {},
        contentHeader: {},
        contentTitleBlock: {},
        contentTitle: {},
        contentCount: {},
        headerToggleRow: {},
        headerIconBtn: {},
        headerIconBtnActive: {},
        headerIconBtnDisabled: {},
        contentBody: {},
        contentBodyMap: {},
        nearbyCtaBlock: {},
        geoMessageText: {},
        mapSection: {},
        geoBanner: {},
        geoBannerText: {},
        mapLoading: {},
        mapContainer: {},
        mapSearchAreaBtn: {},
        mapSearchAreaBtnText: {},
        questsGrid: {},
        questVirtualizedList: {},
        questVirtualizedListContent: {},
        questVirtualizedItem: {},
        contentCountRow: {},
        resetFiltersChip: {},
        resetFiltersChipText: {},
        sortChip: {},
        sortChipActive: {},
        sortChipText: {},
        sortChipTextActive: {},
    };

    const colors = {
        text: '#111',
        textOnPrimary: '#fff',
        primary: '#222',
        warning: '#d97706',
        warningSoft: '#fef3c7',
        warningDark: '#92400e',
    };

    beforeEach(() => {
        mockIsMobile = false;
        mockPlayersCount = null;
        mockUseQuestPlayersCount.mockClear();
        document.body.innerHTML = '';
        document.head.querySelectorAll('style[data-ssg-quests-listing-style="true"]').forEach((node) => node.remove());
    });

    const makeQuest = (index: number): QuestMeta => ({
        id: `quest-${index}`,
        numericId: index + 1,
        title: `Quest ${index}`,
        points: 3,
        cityId: 'warsaw',
        cityName: 'Warsaw',
        lat: 52.23 + index / 1000,
        lng: 21.01 + index / 1000,
        durationMin: 60,
        difficulty: 'easy',
        cover: `https://cdn.example.com/quest-${index}.jpg`,
        ratingAvg: null,
        ratingCount: 0,
        completionsCount: 0,
        viewsCount: 0,
        isCompletedByMe: false,
        firstCompleter: null,
    });

    const makeBaseProps = () => ({
        styles,
        colors,
        dataLoaded: true,
        viewMode: 'list' as const,
        selectedCityId: 'minsk',
        selectedCityName: 'Минск',
        nearbyId: '__nearby__',
        questsAll: [makeQuest(0)],
        questCardWidth: 320,
        userLoc: null,
        isMapAreaActive: false,
        geoMessage: null,
        geoRequesting: false,
        radiiLg: 24,
        isMobile: false,
        filtersActive: true,
        onResetFilters: () => {},
        onShowNearby: () => {},
        onOpenFilterDrawer: () => {},
        onToggleViewMode: () => {},
    });

    /**
     * #1790: переключатель «Популярные» показывается ровно тогда, когда экран
     * сказал, что сортировать есть что, и подписывается по своему состоянию —
     * иначе a11y-имя обещало бы включить уже включённую сортировку.
     */
    describe('popular sort chip', () => {
        it('stays hidden while the slice has nothing to reorder', async () => {
            const { queryByTestId } = await render(<QuestsContentPanel {...makeBaseProps()} />);
            expect(queryByTestId('quests-sort-popular')).toBeNull();
        });

        it('stays hidden until the catalog is loaded', async () => {
            const { queryByTestId } = await render(
                <QuestsContentPanel {...makeBaseProps()} dataLoaded={false} availableSortOrders={['popular']} />,
            );
            expect(queryByTestId('quests-sort-popular')).toBeNull();
        });

        /**
         * #2170: до ответа API строка счётчика и чип сортировки уже занимают своё
         * место. Без резерва тело каталога сдвигалось на 38 px в момент ответа
         * (CLS 0,036 на телефоне), а на медленной сети это происходит на 28-й
         * секунде — под пальцем.
         */
        it('reserves the count line and the sort chip while the catalog is loading', async () => {
            const { getByTestId, queryByTestId, rerender } = await render(
                <QuestsContentPanel {...makeBaseProps()} selectedCityId="__all__" dataLoaded={false} questsAll={[]} />,
            );
            // Резерв скрыт от скринридера (aria-hidden), поэтому ищем и скрытые узлы.
            expect(getByTestId('quests-sort-placeholder', HIDDEN)).toBeTruthy();
            expect(getByTestId('quests-grid-skeleton')).toBeTruthy();

            await rerender(<QuestsContentPanel {...makeBaseProps()} availableSortOrders={['popular']} />);
            expect(queryByTestId('quests-sort-placeholder', HIDDEN)).toBeNull();
            expect(queryByTestId('quests-grid-skeleton')).toBeNull();
            expect(getByTestId('quests-sort-popular')).toBeTruthy();
        });

        // В срезе города прохождений может не набраться на сортировку: зарезервированный
        // чип, который не появился, дал бы тот же сдвиг, только вверх.
        it.each([
            ['a city slice', { selectedCityId: 'minsk' }],
            ['the nearby slice', { selectedCityId: '__nearby__', userLoc: { latitude: 53.9, longitude: 27.56 } }],
            ['a map-area slice', { selectedCityId: '__all__', isMapAreaActive: true }],
        ])('does not reserve a sort chip for %s', async (_name, props) => {
            const { queryByTestId } = await render(
                <QuestsContentPanel {...makeBaseProps()} dataLoaded={false} questsAll={[]} {...props} />,
            );
            expect(queryByTestId('quests-sort-placeholder', HIDDEN)).toBeNull();
        });

        // Каркас не зависит от признака «телефон»: серверная разметка web всегда узкая,
        // и зависящий от неё каркас на широком экране перекладывался бы при гидратации
        // (замер прода: CLS 0,034 на 1280, 0,057 на 1440). На native клеток две.
        it.each([
            ['a phone', true],
            ['a wide screen', false],
        ])('renders the same skeleton cells on %s', async (_name, isMobile) => {
            mockIsMobile = isMobile;
            const { getByTestId } = await render(
                <QuestsContentPanel {...makeBaseProps()} isMobile={isMobile} dataLoaded={false} questsAll={[]} />,
            );
            expect(getByTestId('quests-grid-skeleton').children).toHaveLength(2);
        });

        it('offers to sort, then to undo it, and reports the state to assistive tech', async () => {
            const onSelectSortOrder = jest.fn();
            const { getByTestId, rerender } = await render(
                <QuestsContentPanel
                    {...makeBaseProps()}
                    availableSortOrders={['popular']}
                    onSelectSortOrder={onSelectSortOrder}
                />,
            );

            const chip = getByTestId('quests-sort-popular');
            expect(chip.props.accessibilityLabel).toBe('Сортировать по популярности');
            expect(chip.props.accessibilityState.selected).toBe(false);
            await fireEvent.press(chip);
            expect(onSelectSortOrder).toHaveBeenCalledWith('popular');

            await rerender(
                <QuestsContentPanel
                    {...makeBaseProps()}
                    availableSortOrders={['popular']}
                    activeSortOrder="popular"
                    onSelectSortOrder={onSelectSortOrder}
                />,
            );

            const activeChip = getByTestId('quests-sort-popular');
            expect(activeChip.props.accessibilityLabel).toBe('Вернуть обычный порядок');
            expect(activeChip.props.accessibilityState.selected).toBe(true);
        });
    });

    /**
     * #1988: порядок каталога стал выбором из нескольких вариантов, а не
     * тумблером. Панель обязана показывать ровно те, которые экран объявил
     * доступными, и держать выбранным ровно один.
     */
    describe('rating sort chip', () => {
        it('stays hidden while the catalog has no publicly rated quests', async () => {
            const { queryByTestId } = await render(
                <QuestsContentPanel {...makeBaseProps()} availableSortOrders={['popular']} />,
            );
            expect(queryByTestId('quests-sort-popular')).not.toBeNull();
            expect(queryByTestId('quests-sort-rating')).toBeNull();
        });

        it('offers rating sort on its own when popularity has nothing to reorder', async () => {
            const onSelectSortOrder = jest.fn();
            const { getByTestId, queryByTestId } = await render(
                <QuestsContentPanel
                    {...makeBaseProps()}
                    availableSortOrders={['rating']}
                    onSelectSortOrder={onSelectSortOrder}
                />,
            );
            expect(queryByTestId('quests-sort-popular')).toBeNull();

            const chip = getByTestId('quests-sort-rating');
            expect(chip.props.accessibilityLabel).toBe('Сортировать по рейтингу');
            await fireEvent.press(chip);
            expect(onSelectSortOrder).toHaveBeenCalledWith('rating');
        });

        it('keeps exactly one order selected when both are offered', async () => {
            const { getByTestId } = await render(
                <QuestsContentPanel
                    {...makeBaseProps()}
                    availableSortOrders={['popular', 'rating']}
                    activeSortOrder="rating"
                />,
            );
            expect(getByTestId('quests-sort-rating').props.accessibilityState.selected).toBe(true);
            expect(getByTestId('quests-sort-popular').props.accessibilityState.selected).toBe(false);
            expect(getByTestId('quests-sort-rating').props.accessibilityLabel).toBe(
                'Вернуть обычный порядок',
            );
        });
    });

    /**
     * #1791: «Пройденные» видит любой вошедший игрок, в том числе тот, кто
     * ещё ничего не прошёл, — пустая сетка без объяснения читалась бы как
     * сломанный каталог.
     */
    it('explains an empty personal slice and offers the way back to the catalog', async () => {
        const onResetFilters = jest.fn();
        const { getByText } = await render(
            <QuestsContentPanel
                {...makeBaseProps()}
                selectedCityId="__completed__"
                selectedCityName={null}
                questsAll={[]}
                onResetFilters={onResetFilters}
            />,
        );

        expect(getByText('Квесты, пройденные мной')).toBeTruthy();
        expect(getByText('Вы ещё не прошли ни одного квеста')).toBeTruthy();
        await fireEvent.press(getByText('Выбрать первый квест'));
        expect(onResetFilters).toHaveBeenCalledTimes(1);
    });

    it('keeps the empty-slice explanation away from a slice that has results', async () => {
        const { queryByText, getByTestId, rerender } = await render(
            <QuestsContentPanel {...makeBaseProps()} selectedCityId="__completed__" selectedCityName={null} />,
        );

        expect(getByTestId('quests-content-title').props.children).toBe('Квесты, пройденные мной');
        expect(queryByText('Вы ещё не прошли ни одного квеста')).toBeNull();

        // Пустой срез «Не пройденные» — не тот же случай: объяснение про
        // «ни одного квеста» там было бы ложью, поэтому оно к нему не липнет.
        await rerender(
            <QuestsContentPanel
                {...makeBaseProps()}
                selectedCityId="__uncompleted__"
                selectedCityName={null}
                questsAll={[]}
            />,
        );

        expect(getByTestId('quests-content-title').props.children).toBe('Квесты, ещё не пройденные мной');
        expect(queryByText('Вы ещё не прошли ни одного квеста')).toBeNull();
    });

    it.each(['web', 'android'])('keeps empty-state precedence and clears it when results arrive on %s', async (platform) => {
        (Platform as { OS: string }).OS = platform;
        mockIsMobile = true;
        const props = { ...makeBaseProps(), isMobile: true, isMapAreaActive: true };
        const { getAllByText, queryByText, rerender } = await render(
            <QuestsContentPanel {...props} searchQuery="missing" questsAll={[]} />,
        );

        expect(getAllByText('Ничего не найдено')).toHaveLength(1);
        expect(queryByText('Рядом ничего не найдено')).toBeNull();

        await rerender(<QuestsContentPanel {...props} questsAll={[]} />);
        expect(getAllByText('Рядом ничего не найдено')).toHaveLength(1);
        expect(queryByText('Ничего не найдено')).toBeNull();

        await rerender(
            <QuestsContentPanel
                {...props}
                isMapAreaActive={false}
                selectedCityId="__nearby__"
                userLoc={{ lat: 53.9, lng: 27.56 }}
                questsAll={[]}
            />,
        );
        expect(getAllByText('Рядом ничего не найдено')).toHaveLength(1);

        await rerender(<QuestsContentPanel {...props} searchQuery="quest" />);
        expect(queryByText('Ничего не найдено')).toBeNull();
        expect(queryByText('Рядом ничего не найдено')).toBeNull();
    });

    it.each(['web', 'android'])('distinguishes location lookup from catalog loading on %s', async (platform) => {
        (Platform as { OS: string }).OS = platform;
        mockIsMobile = true;
        const props = {
            ...makeBaseProps(),
            isMobile: true,
            selectedCityId: '__nearby__',
            geoRequesting: true,
        };
        const { getByTestId, queryByTestId, queryByText, rerender } = await render(
            <QuestsContentPanel {...props} questsAll={[]} />,
        );

        expect(getByTestId('quests-nearby-loading')).toBeTruthy();
        expect(queryByText('Рядом ничего не найдено')).toBeNull();

        await rerender(<QuestsContentPanel {...props} dataLoaded={false} questsAll={[]} />);
        expect(getByTestId('quests-grid-skeleton')).toBeTruthy();
        expect(queryByTestId('quests-nearby-loading')).toBeNull();
        expect(queryByText('Рядом ничего не найдено')).toBeNull();
    });

    it('keeps the city-selection prompt alongside an empty map-area result on web', async () => {
        (Platform as { OS: string }).OS = 'web';
        const { getByText } = await render(
            <QuestsContentPanel {...makeBaseProps()} selectedCityId={null} isMapAreaActive questsAll={[]} />,
        );
        expect(getByText('Рядом ничего не найдено')).toBeTruthy();
        expect(getByText('Выберите город')).toBeTruthy();
    });

    it.each([false, true])('names other players explicitly in the completion slice (mobile=%s)', async (mobile) => {
        mockIsMobile = mobile;
        const { getByTestId, queryByText } = await render(
            <QuestsContentPanel {...makeBaseProps()} selectedCityId="__completed_by_others__" selectedCityName={null} />,
        );
        expect(getByTestId('quests-content-title').props.children).toBe('Квесты, пройденные другими');
        expect(queryByText('Вы ещё не прошли ни одного квеста')).toBeNull();
    });

    it('names the reviews slice without treating it as a city', async () => {
        const { getByTestId } = await render(
            <QuestsContentPanel {...makeBaseProps()} selectedCityId="__reviewed__" selectedCityName={null} />,
        );
        expect(getByTestId('quests-content-title').props.children).toBe('Квесты с отзывами');
    });

    it('removes only the marked no-JS quest listing and its associated style on web mount', async () => {
        (Platform as { OS: string }).OS = 'web';
        document.body.innerHTML = [
            '<section data-ssg-quests-listing="true">No-JS quest catalog</section>',
            '<section data-ssg-quest-city="true">City landing content</section>',
        ].join('');
        document.head.insertAdjacentHTML(
            'beforeend',
            '<style data-ssg-quests-listing-style="true">[data-ssg-quests-listing]{display:none}</style>',
        );

        await render(<QuestsContentPanel {...makeBaseProps()} />);

        expect(document.querySelector('section[data-ssg-quests-listing="true"]')).toBeNull();
        expect(document.querySelector('style[data-ssg-quests-listing-style="true"]')).toBeNull();
        expect(document.querySelector('section[data-ssg-quest-city="true"]')?.textContent).toBe('City landing content');
    });

    it('renders a neutral localized location heading without guessing a city prefix', async () => {
        (Platform as { OS: string }).OS = 'web';

        const { getByTestId, getByText, queryByText } = await render(
            <QuestsContentPanel {...makeBaseProps()} selectedCityName="Минск" />,
        );

        const heading = getByTestId('quests-content-title');
        expect(getByText('Квесты: Минск')).toBeTruthy();
        expect(queryByText('Квесты в городе Минск')).toBeNull();
        expect(heading.props.accessibilityRole).toBe('header');
        expect(heading.props['aria-level']).toBe(1);
    });

    it('opens the city drawer from the mobile city button', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'android';
        const onOpenFilterDrawer = jest.fn();

        const { getByLabelText } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={[]}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile
                onShowNearby={() => {}}
                onOpenFilterDrawer={onOpenFilterDrawer}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
            />
        );

        await fireEvent.press(getByLabelText('Выбрать город'));

        expect(onOpenFilterDrawer).toHaveBeenCalledTimes(1);
    });

    it('uses a virtualized FlatList for Android mobile quest list scrolling', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'android';
        const quests = Array.from({ length: 12 }, (_, index) => makeQuest(index));
        // Геттер FlatList на react-native не подменяется присваиванием экспорта.
        // Контракт окна виртуализации читаем с props класса, хост остаётся настоящим.
        const flatListProps = new Map<string, any>();
        const renderFlatList = FlatList.prototype.render;
        const flatListSpy = jest.spyOn(FlatList.prototype, 'render').mockImplementation(function (this: any) {
            if (this.props?.testID === 'quests-virtualized-list') flatListProps.set(this.props.testID, this.props);
            return renderFlatList.call(this);
        });

        try {
            const { getByTestId } = await render(
                <QuestsContentPanel
                    styles={styles}
                    colors={colors}
                    dataLoaded
                    viewMode="list"
                    selectedCityId="warsaw"
                    selectedCityName="Warsaw"
                    nearbyId="__nearby__"
                    nearbyRadiusKm={15}
                    questsAll={quests}
                    questCardWidth={320}
                    userLoc={null}
                    isMapAreaActive={false}
                    geoMessage={null}
                    geoRequesting={false}
                    radiiLg={24}
                    isMobile
                    onShowNearby={() => {}}
                    onOpenFilterDrawer={() => {}}
                    onToggleViewMode={() => {}}
                    onSetRadius={() => {}}
                />
            );

            const list = flatListProps.get('quests-virtualized-list');
            expect(list).toBeDefined();

            expect(getByTestId('quests-virtualized-list')).toBeTruthy();
            expect(list.data).toHaveLength(12);
            expect(list.initialNumToRender).toBe(4);
            expect(list.maxToRenderPerBatch).toBe(4);
            expect(list.updateCellsBatchingPeriod).toBe(50);
            expect(list.windowSize).toBe(5);
            expect(list.removeClippedSubviews).toBe(true);
        } finally {
            flatListSpy.mockRestore();
        }
    });

    it('keeps the FlatList root (and search field) mounted when Android search narrows to zero results', async () => {
        // Регрессия: раньше нативная ветка списка гейтилась на questsAll.length > 0,
        // поэтому «0 результатов» переключало корень View(FlatList) → ScrollView и
        // перемонтировало шапку с TextInput — поле теряло фокус, клавиатура
        // закрывалась при наборе. Ветка обязана оставаться FlatList в обоих состояниях.
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'android';

        const baseProps = {
            styles,
            colors,
            dataLoaded: true,
            viewMode: 'list' as const,
            selectedCityId: 'warsaw',
            selectedCityName: 'Warsaw',
            nearbyId: '__nearby__',
            searchQuery: 'quest',
            onSearchChange: () => {},
            nearbyRadiusKm: 15,
            questCardWidth: 320,
            userLoc: null,
            isMapAreaActive: false,
            geoMessage: null,
            geoRequesting: false,
            radiiLg: 24,
            isMobile: true,
            filtersActive: false,
            onResetFilters: () => {},
            onShowNearby: () => {},
            onOpenFilterDrawer: () => {},
            onToggleViewMode: () => {},
            onSetRadius: () => {},
        };

        const { getByTestId, queryByText, rerender } = await render(
            <QuestsContentPanel {...baseProps} questsAll={[makeQuest(0), makeQuest(1)]} />
        );

        expect(getByTestId('quests-virtualized-list')).toBeTruthy();
        expect(getByTestId('quests-search-input')).toBeTruthy();

        // Набор сузил результат до нуля — корень НЕ должен переключиться на ScrollView.
        await rerender(<QuestsContentPanel {...baseProps} questsAll={[]} />);

        expect(getByTestId('quests-virtualized-list')).toBeTruthy();
        expect(getByTestId('quests-search-input')).toBeTruthy();
        expect(queryByText('Ничего не найдено')).toBeTruthy();
    });

    // #1826: сетка на web осталась сеткой (не FlatList), но в первый кадр
    // уходит окно, а не весь каталог: 177 карточек одним `map` рвали ввод в
    // поиске. Окно растёт по прокрутке.
    it('renders a first window of the web grid and grows it on scroll', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const quests = Array.from({ length: 54 }, (_, index) => makeQuest(index));

        const { getByTestId, queryByTestId } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={quests}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
            />
        );

        expect(queryByTestId('quests-virtualized-list')).toBeNull();
        expect(getByTestId('quest-card-quest-0').props.accessibilityHint).toBe('0');
        expect(getByTestId('quest-card-quest-23').props.accessibilityHint).toBe('23');
        expect(queryByTestId('quest-card-quest-24')).toBeNull();
        expect(queryByTestId('quest-card-quest-53')).toBeNull();

        const scrollToEnd = async () => await fireEvent.scroll(getByTestId('quests-content'), {
            nativeEvent: {
                contentOffset: { y: 10000 },
                contentSize: { height: 10400, width: 390 },
                layoutMeasurement: { height: 800, width: 390 },
            },
        });

        await scrollToEnd();
        expect(getByTestId('quest-card-quest-24').props.accessibilityHint).toBe('24');
        expect(queryByTestId('quest-card-quest-48')).toBeNull();

        await scrollToEnd();
        expect(getByTestId('quest-card-quest-53').props.accessibilityHint).toBe('53');
    });

    // Прокрутка — не единственный путь раскрытия: на широком экране или при
    // увеличенном масштабе окно укладывается во вьюпорт целиком, скролл-событий
    // не возникает вовсе, и остаток каталога был бы недостижим.
    //
    // Порядок событий здесь настоящий, web-овский: один общий ResizeObserver отдаёт
    // вложенную сетку РАНЬШЕ скроллера, поэтому на первом layout сетки высоты
    // вьюпорта ещё нет. Раскрытие обязано случиться на следующем событии, а не
    // зависеть от порядка. Высоту контента шлём только layout-ом самой сетки:
    // `onContentSizeChange` на web внутри вьюпорта не приходит вовсе.
    it('grows the web grid window while the content still fits the viewport', async () => {
        mockIsMobile = false;
        (Platform as { OS: string }).OS = 'web';
        const quests = Array.from({ length: 54 }, (_, index) => makeQuest(index));

        const { getByTestId, queryByTestId } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={quests}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile={false}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
            />
        );

        expect(queryByTestId('quest-card-quest-24')).toBeNull();

        const layout = async (testID: string, height: number) => await fireEvent(
            getByTestId(testID),
            'layout',
            { nativeEvent: { layout: { height, width: 1440 } } },
        );

        // Первый батч ResizeObserver: вложенная сетка приходит раньше скроллера,
        // высоты вьюпорта ещё нет — раскрывать не по чему.
        await layout('quests-grid', 1200);
        expect(queryByTestId('quest-card-quest-24')).toBeNull();

        // Вьюпорт заведомо выше сетки: скроллить нечего, окно обязано вырасти само.
        await layout('quests-content', 20000);
        expect(getByTestId('quest-card-quest-24')).toBeTruthy();

        // Раскрытие переизмеряет сетку: пока она помещается, окно растёт дальше.
        await layout('quests-grid', 2400);
        expect(getByTestId('quest-card-quest-53')).toBeTruthy();
    });

    // Обратная сторона того же пути: пока сетка выше вьюпорта, прокрутка есть и
    // окно не должно раскрываться само — иначе виртуализация схлопнется в тот же
    // полный каталог, ради ухода от которого она и появилась.
    it('keeps the web grid window closed while the grid overflows the viewport', async () => {
        mockIsMobile = false;
        (Platform as { OS: string }).OS = 'web';
        const quests = Array.from({ length: 54 }, (_, index) => makeQuest(index));

        const { getByTestId, queryByTestId } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={quests}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile={false}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
            />
        );

        await fireEvent(getByTestId('quests-grid'), 'layout', { nativeEvent: { layout: { height: 3200, width: 1440 } } });
        await fireEvent(getByTestId('quests-content'), 'layout', { nativeEvent: { layout: { height: 900, width: 1440 } } });

        expect(queryByTestId('quest-card-quest-24')).toBeNull();
    });

    // Пока сетки нет на экране (режим карты), её последняя измеренная высота
    // протухает. Layout скроллера, пришедший в это время, не должен раскрывать
    // окно по высоте прежней сетки: вернувшись в список, пользователь увидел бы
    // раздутое окно, которого никто не запрашивал.
    it('does not reveal from a stale grid height while the grid is unmounted', async () => {
        mockIsMobile = false;
        (Platform as { OS: string }).OS = 'web';
        const quests = Array.from({ length: 54 }, (_, index) => makeQuest(index));

        const panel = (mode: 'list' | 'map') => (
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode={mode}
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={quests}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile={false}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
            />
        );

        const { getByTestId, queryByTestId, rerender } = await render(panel('list'));

        // Сетка выше вьюпорта: прокрутка есть, окно само не растёт.
        await fireEvent(getByTestId('quests-grid'), 'layout', { nativeEvent: { layout: { height: 3200, width: 1440 } } });
        await fireEvent(getByTestId('quests-content'), 'layout', { nativeEvent: { layout: { height: 900, width: 1440 } } });
        expect(queryByTestId('quest-card-quest-24')).toBeNull();

        // Карта снимает сетку с экрана; вертикальный ресайз в этот момент даёт
        // layout скроллера, но сравнивать его уже не с чем.
        await rerender(panel('map'));
        await fireEvent(getByTestId('quests-content'), 'layout', { nativeEvent: { layout: { height: 5000, width: 1440 } } });

        await rerender(panel('list'));
        expect(queryByTestId('quest-card-quest-24')).toBeNull();
    });

    // Смена набора обязана начинать окно заново: иначе узкий срез после «всех
    // квестов» рисовался бы с раздутым окном.
    it('restarts the web grid window when the catalog changes', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const quests = Array.from({ length: 54 }, (_, index) => makeQuest(index));

        const panel = (data: QuestMeta[]) => (
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={data}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
            />
        );

        const { getByTestId, queryByTestId, rerender } = await render(panel(quests));

        await fireEvent.scroll(getByTestId('quests-content'), {
            nativeEvent: {
                contentOffset: { y: 10000 },
                contentSize: { height: 10400, width: 390 },
                layoutMeasurement: { height: 800, width: 390 },
            },
        });
        expect(getByTestId('quest-card-quest-24')).toBeTruthy();

        await rerender(panel(quests.slice(0, 40)));
        expect(queryByTestId('quest-card-quest-24')).toBeNull();
        expect(getByTestId('quest-card-quest-23')).toBeTruthy();
    });

    // Переключатель «Популярные» отдаёт новый массив того же набора. Окно,
    // привязанное к ссылке, схлопывалось бы на смене одного лишь порядка.
    it('keeps the web grid window when only the order of the same catalog changes', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const quests = Array.from({ length: 54 }, (_, index) => makeQuest(index));

        const panel = (data: QuestMeta[]) => (
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={data}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
            />
        );

        const { getByTestId, rerender } = await render(panel(quests));
        await fireEvent.scroll(getByTestId('quests-content'), {
            nativeEvent: {
                contentOffset: { y: 10000 },
                contentSize: { height: 10400, width: 390 },
                layoutMeasurement: { height: 800, width: 390 },
            },
        });
        expect(getByTestId('quest-card-quest-24')).toBeTruthy();

        await rerender(panel(quests.slice().reverse()));
        expect(getByTestId('quest-card-quest-29')).toBeTruthy();
    });

    it('exposes the mobile nearby CTA and geolocation message in list mode', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const onShowNearby = jest.fn();

        const { getByTestId, getByText } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="__nearby__"
                selectedCityName="Рядом"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={[]}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage="Разрешите доступ к геолокации."
                geoRequesting={false}
                radiiLg={24}
                isMobile
                onShowNearby={onShowNearby}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
            />
        );

        const nearbyButton = getByTestId('quests-show-nearby');
        expect(nearbyButton.props.accessibilityState).toEqual({ selected: true, disabled: false });
        await fireEvent.press(nearbyButton);

        expect(onShowNearby).toHaveBeenCalledTimes(1);
        expect(getByText('Разрешите доступ к геолокации.')).toBeTruthy();
    });

    it('presents kids quests as an audience filter rather than fairytales', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const onShowKids = jest.fn();

        const { getByLabelText, getByText, queryByText } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="__kids__"
                selectedCityName="Для детей"
                nearbyId="__nearby__"
                kidsFilterId="__kids__"
                questsAll={[makeQuest(0)]}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile
                filtersActive
                onResetFilters={() => {}}
                onShowKids={onShowKids}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
            />,
        );

        await fireEvent.press(getByLabelText('Показать квесты для детей'));

        expect(onShowKids).toHaveBeenCalledTimes(1);
        expect(getByText('Квесты для детей')).toBeTruthy();
        expect(queryByText('Детские сказки')).toBeNull();
    });

    it('keeps each quest backend city route inside a merged city catalog', async () => {
        (Platform as { OS: string }).OS = 'web';
        const quest = makeQuest(0);
        quest.cityId = 'warsaw';

        const { getByTestId } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="minsk"
                selectedCityName="Минск"
                nearbyId="__nearby__"
                questsAll={[quest]}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile={false}
                filtersActive
                onResetFilters={() => {}}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
            />,
        );

        expect(getByTestId('quest-card-quest-0').props.accessibilityLabel).toBe('warsaw');
    });

    it('shows the reset-filters chip when a filter narrows the catalog and hides it otherwise', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const onResetFilters = jest.fn();

        const baseProps = {
            styles,
            colors,
            dataLoaded: true,
            viewMode: 'list' as const,
            selectedCityName: 'Warsaw',
            nearbyId: '__nearby__',
            nearbyRadiusKm: 15,
            questsAll: [makeQuest(0)],
            questCardWidth: 320,
            userLoc: null,
            isMapAreaActive: false,
            geoMessage: null,
            geoRequesting: false,
            radiiLg: 24,
            isMobile: true,
            onResetFilters,
            onShowNearby: () => {},
            onOpenFilterDrawer: () => {},
            onToggleViewMode: () => {},
            onSetRadius: () => {},
        };

        const { getByTestId, queryByTestId, rerender } = await render(
            <QuestsContentPanel {...baseProps} selectedCityId="warsaw" filtersActive />
        );

        await fireEvent.press(getByTestId('quests-reset-filters'));
        expect(onResetFilters).toHaveBeenCalledTimes(1);

        await rerender(
            <QuestsContentPanel {...baseProps} selectedCityId="__nearby__" selectedCityName="Рядом" filtersActive={false} />
        );
        expect(queryByTestId('quests-reset-filters')).toBeNull();
    });

    it('keeps the default full catalog distinct from nearby and map-area filters', async () => {
        (Platform as { OS: string }).OS = 'web';
        const baseProps = {
            styles,
            colors,
            dataLoaded: true,
            viewMode: 'list' as const,
            selectedCityName: null,
            nearbyId: '__nearby__',
            questsAll: [makeQuest(0)],
            questCardWidth: 320,
            userLoc: { lat: 52.23, lng: 21.01 },
            geoMessage: null,
            geoRequesting: false,
            radiiLg: 24,
            isMobile: false,
            onResetFilters: () => {},
            onShowNearby: () => {},
            onOpenFilterDrawer: () => {},
            onToggleViewMode: () => {},
        };

        const { getByText, getByTestId, queryAllByTestId, rerender } = await render(
            <QuestsContentPanel
                {...baseProps}
                selectedCityId="__all__"
                isMapAreaActive={false}
                filtersActive={false}
            />,
        );

        expect(getByText('Все квесты')).toBeTruthy();
        expect(getByTestId('quest-card-quest-0').props.accessibilityState?.selected).toBe(false);
        expect(queryAllByTestId('quests-seo-intro-faq')).toHaveLength(2);

        await rerender(
            <QuestsContentPanel
                {...baseProps}
                selectedCityId="__all__"
                isMapAreaActive
                filtersActive
            />,
        );

        expect(getByText('Квесты в этой области')).toBeTruthy();
        expect(getByTestId('quest-card-quest-0').props.accessibilityState?.selected).toBe(false);
        expect(queryAllByTestId('quests-seo-intro-faq')).toHaveLength(0);
    });

    it('adds the catalog-wide player count only to the full catalog header (#2761)', async () => {
        (Platform as { OS: string }).OS = 'web';
        mockPlayersCount = 26;
        const baseProps = {
            styles,
            colors,
            dataLoaded: true,
            viewMode: 'list' as const,
            selectedCityName: null,
            nearbyId: '__nearby__',
            questsAll: [{ ...makeQuest(0), completionsCount: 3 }, makeQuest(1)],
            questCardWidth: 320,
            userLoc: null,
            geoMessage: null,
            geoRequesting: false,
            radiiLg: 24,
            isMobile: false,
            isMapAreaActive: false,
            onResetFilters: () => {},
            onShowNearby: () => {},
            onOpenFilterDrawer: () => {},
            onToggleViewMode: () => {},
        };

        const { getByText, queryByText, rerender } = await render(
            <QuestsContentPanel {...baseProps} selectedCityId="__all__" filtersActive={false} />,
        );
        expect(getByText('2 квеста · 3 прохождения · 26 игроков')).toBeTruthy();

        await rerender(
            <QuestsContentPanel
                {...baseProps}
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                filtersActive
            />,
        );
        expect(getByText('2 квеста · 3 прохождения')).toBeTruthy();
        expect(queryByText(/игрок/)).toBeNull();
        expect(mockUseQuestPlayersCount).toHaveBeenLastCalledWith(false);

        // Нет числа (ошибка, офлайн, старый бэкенд) — шапка как раньше.
        mockPlayersCount = null;
        await rerender(<QuestsContentPanel {...baseProps} selectedCityId="__all__" filtersActive={false} />);
        expect(getByText('2 квеста · 3 прохождения')).toBeTruthy();
    });

    it('waits for the catalog before asking for the player count', async () => {
        (Platform as { OS: string }).OS = 'web';
        await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded={false}
                viewMode="list"
                selectedCityId="__all__"
                selectedCityName={null}
                nearbyId="__nearby__"
                questsAll={[]}
                questCardWidth={320}
                userLoc={null}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile={false}
                isMapAreaActive={false}
                filtersActive={false}
                onResetFilters={() => {}}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
            />,
        );
        expect(mockUseQuestPlayersCount).toHaveBeenLastCalledWith(false);
    });

    it('shows a geolocation failure message on desktop while falling back to all quests', async () => {
        (Platform as { OS: string }).OS = 'web';

        const { getByText } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="list"
                selectedCityId="__all__"
                selectedCityName={null}
                nearbyId="__nearby__"
                questsAll={[makeQuest(0)]}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage="Геолокация запрещена. Показываем весь каталог."
                geoRequesting={false}
                radiiLg={24}
                isMobile={false}
                filtersActive={false}
                onResetFilters={() => {}}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
            />,
        );

        expect(getByText('Геолокация запрещена. Показываем весь каталог.')).toBeTruthy();
    });

    it('keeps the same header toggle row visible in map mode so the user can switch back to the list', async () => {
        mockIsMobile = true;
        (Platform as { OS: string }).OS = 'web';
        const onToggleViewMode = jest.fn();
        const onOpenFilterDrawer = jest.fn();
        const onShowNearby = jest.fn();

        const { getByTestId, getByLabelText } = await render(
            <QuestsContentPanel
                styles={styles}
                colors={colors}
                dataLoaded
                viewMode="map"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={[]}
                questCardWidth={320}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                radiiLg={24}
                isMobile
                onShowNearby={onShowNearby}
                onOpenFilterDrawer={onOpenFilterDrawer}
                onToggleViewMode={onToggleViewMode}
                onSetRadius={() => {}}
            />
        );

        // Same three icon controls as list mode: toggle view, pick city, show nearby.
        await fireEvent.press(getByTestId('quests-toggle-view-mode'));
        expect(onToggleViewMode).toHaveBeenCalledTimes(1);

        await fireEvent.press(getByLabelText('Выбрать город'));
        expect(onOpenFilterDrawer).toHaveBeenCalledTimes(1);

        await fireEvent.press(getByTestId('quests-show-nearby'));
        expect(onShowNearby).toHaveBeenCalledTimes(1);
    });

    // #2389: режим карты приходит готовым слотом; панель рисует только его,
    // без пустых состояний списка, а в списке слот не появляется.
    it('renders the map slot instead of list empty-states in map mode', async () => {
        (Platform as { OS: string }).OS = 'web';
        const { Text } = require('react-native') as typeof import('react-native');
        const mapSlot = <Text testID="quests-map-slot">map</Text>;
        const props = { ...makeBaseProps(), searchQuery: '', onSearchChange: () => {}, questsAll: [], isMapAreaActive: true, mapSlot };

        const { getByTestId, queryByText, rerender, queryByTestId } = await render(
            <QuestsContentPanel {...props} viewMode="map" />,
        );

        expect(getByTestId('quests-map-slot')).toBeTruthy();
        expect(queryByText('Рядом ничего не найдено')).toBeNull();

        await rerender(<QuestsContentPanel {...props} viewMode="list" />);
        expect(queryByTestId('quests-map-slot')).toBeNull();
        expect(queryByText('Рядом ничего не найдено')).toBeTruthy();
    });

    // #2005: колонку web-сетки задаёт CSS auto-fill по контейнеру, поэтому карточка
    // берёт трек измеренной сетки, а не оценку модели от вьюпорта. Native
    // раскладывается по модели и сохраняет `questCardWidth`.
    it.each([
        ['web', 606, 606],
        ['web', 862, 415],
        ['android', 606, 320],
    ])('на %s сетка %i px даёт карточке %i px', async (os, gridWidth, cardWidth) => {
        (Platform as { OS: string }).OS = os;
        const { getByTestId } = await render(<QuestsContentPanel {...makeBaseProps()} />);
        expect(getByTestId('quest-card-quest-0')).toHaveStyle({ width: 320 });

        await fireEvent(getByTestId('quests-grid'), 'layout', { nativeEvent: { layout: { height: 400, width: gridWidth } } });

        expect(getByTestId('quest-card-quest-0')).toHaveStyle({ width: cardWidth });
    });
});
