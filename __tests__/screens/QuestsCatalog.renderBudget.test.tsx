// #1826, пункт 5: замер того, что вообще поддаётся замеру кодом — сколько
// карточек уходит в первый кадр и стоят ли на пути границы мемоизации. INP и
// профиль ввода снимаются в браузере на приёмке, здесь фиксируются числа,
// которые от браузера не зависят и не дадут им молча вернуться назад.

import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import QuestCard from '@/screens/tabs/QuestCard';
import QuestsSidebar from '@/screens/tabs/QuestsSidebar';
import type { QuestMeta } from '@/utils/questAdapters';

let mockIsMobile = false;

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: mockIsMobile }),
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

// Карточка подменяется, чтобы замер считал именно смонтированные карточки, а не
// стоимость их содержимого. Мемоизация настоящей карточки проверяется отдельно,
// через `jest.requireActual`.
jest.mock('@/screens/tabs/QuestCard', () => {
    const React = require('react');
    const { Text } = require('react-native');
    const MockQuestCard = ({ quest }: { quest: { id: string; title: string } }) =>
        React.createElement(Text, { testID: `quest-card-${quest.id}` }, quest.title);
    return { __esModule: true, default: MockQuestCard };
});

const REACT_MEMO = Symbol.for('react.memo');

const makeQuest = (index: number): QuestMeta => ({
    id: `quest-${index}`,
    title: `Quest ${index}`,
    cityId: 'warsaw',
    cityName: 'Warsaw',
    countryName: 'Poland',
    lat: 52.23,
    lng: 21.01,
} as QuestMeta);

const CATALOG_SIZE = 177;

const styles = new Proxy({}, { get: () => ({}) }) as Record<string, unknown>;
const colors = new Proxy({}, { get: () => '#000' }) as Record<string, string>;

beforeEach(() => {
    mockIsMobile = false;
});

describe('#1826 бюджет первого кадра каталога', () => {
    it('в первый кадр уходит окно, а не весь каталог', () => {
        (Platform as { OS: string }).OS = 'web';
        const quests = Array.from({ length: CATALOG_SIZE }, (_, index) => makeQuest(index));

        const { queryAllByTestId } = render(
            <QuestsContentPanel
                styles={styles as never}
                colors={colors as never}
                dataLoaded
                viewMode="list"
                selectedCityId="warsaw"
                selectedCityName="Warsaw"
                nearbyId="__nearby__"
                nearbyRadiusKm={15}
                questsAll={quests}
                questCardWidth={320}
                mapPoints={[]}
                mapCenter={{ latitude: 52.23, longitude: 21.01 }}
                userLoc={null}
                isMapAreaActive={false}
                geoMessage={null}
                geoRequesting={false}
                showMapAreaSearch={false}
                radiiLg={24}
                LazyQuestMap={(() => null) as never}
                isMobile={false}
                onShowNearby={() => {}}
                onOpenFilterDrawer={() => {}}
                onToggleViewMode={() => {}}
                onSetRadius={() => {}}
                onMapUserLocationChange={() => {}}
                onMapMove={() => {}}
                onSearchMapArea={() => {}}
            />
        );

        const mounted = queryAllByTestId(/^quest-card-/).length;
        expect({ catalog: CATALOG_SIZE, mountedInFirstFrame: mounted }).toEqual({
            catalog: CATALOG_SIZE,
            mountedInFirstFrame: 24,
        });
    });
});

describe('#1826 границы мемоизации на пути от состояния экрана к карточке', () => {
    it('карточка каталога мемоизирована', () => {
        const actual = jest.requireActual('@/screens/tabs/QuestCard') as { default: unknown };
        expect((actual.default as { $$typeof?: symbol }).$$typeof).toBe(REACT_MEMO);
    });

    it('сайдбар каталога мемоизирован', () => {
        expect((QuestsSidebar as unknown as { $$typeof?: symbol }).$$typeof).toBe(REACT_MEMO);
    });

    it('замер смотрит на настоящий компонент, а не на мок', () => {
        expect(QuestCard).not.toBe(jest.requireActual('@/screens/tabs/QuestCard').default);
    });
});
