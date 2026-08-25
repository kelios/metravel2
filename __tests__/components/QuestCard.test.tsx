import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { PixelRatio, Platform } from 'react-native';

import QuestCard from '@/screens/tabs/QuestCard';
import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient';
import { IMAGE_WIDTHS } from '@/constants/imageContract';
import type { QuestMeta } from '@/utils/questAdapters';

const mockPush = jest.fn();
const mockImageCardMedia = jest.fn((props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'quest-card-media', ...props });
});

let mockIsPhone = true;

jest.mock('expo-router', () => ({
    router: {
        push: (...args: any[]) => mockPush(...args),
    },
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/components/layout/UserAvatar', () => 'UserAvatar');
jest.mock('@/components/ui/ShimmerOverlay', () => ({
    ShimmerOverlay: 'ShimmerOverlay',
}));
jest.mock('@/components/ui/ImageCardMedia', () => ({
    __esModule: true,
    default: (props: any) => mockImageCardMedia(props),
}));
jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isPhone: mockIsPhone }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        backgroundTertiary: 'backgroundTertiary',
        backgroundSecondary: 'backgroundSecondary',
        borderLight: 'borderLight',
        brandAlpha30: 'brandAlpha30',
        brandDark: 'brandDark',
        primary: 'primary',
        surface: 'surface',
        text: 'text',
        textMuted: 'textMuted',
        textOnDark: 'textOnDark',
    }),
}));
jest.mock('@/hooks/useQuestsApi', () => ({
    useQuestReviews: () => ({
        data: [],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    }),
}));

const styles = new Proxy({}, {
    get: () => ({}),
});

const makeQuest = (overrides: Partial<QuestMeta> = {}): QuestMeta => ({
    id: 'krakow-dragon',
    title: 'Тайна дракона',
    points: 6,
    cityId: 'krakow',
    cityName: 'Kraków',
    lat: 50.061,
    lng: 19.936,
    durationMin: 90,
    difficulty: 'easy',
    cover: 'https://cdn.example.com/quest.jpg',
    ratingAvg: 4.7,
    ratingCount: 1,
    completionsCount: 0,
    isCompletedByMe: false,
    firstCompleter: null,
    ...overrides,
});

const renderWithQueryClient = (ui: React.ReactElement) =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            {ui}
        </QueryClientProvider>,
    );

describe('QuestCard', () => {
    beforeEach(() => {
        mockIsPhone = true;
        mockPush.mockClear();
        mockImageCardMedia.mockClear();
        (Platform as { OS: string }).OS = 'web';
    });

    it('renders mobile quest media with a sharp cover and no zero-completions badge', () => {
        const { queryByTestId, queryByText } = renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="krakow"
                quest={makeQuest()}
                nearby
            />,
        );

        expect(mockImageCardMedia).toHaveBeenCalledTimes(1);
        expect(mockImageCardMedia.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({
                src: 'https://cdn.example.com/quest.jpg',
                width: 340,
                height: 238,
                fit: 'contain',
                blurBackground: false,
                loading: 'lazy',
                priority: 'low',
                optimizeWeb: false,
            }),
        );
        expect(mockImageCardMedia.mock.calls[0]?.[0]).not.toHaveProperty('allowCriticalWebBlur');
        expect(mockImageCardMedia.mock.calls[0]?.[0]).not.toHaveProperty('preserveOptimizedWebSrc');
        // INV2-01: карточка с нулём прохождений не должна публично сообщать об этом.
        expect(queryByTestId('quest-card-pioneer-krakow-dragon')).toBeNull();
        expect(queryByText('Ещё никто не проходил')).toBeNull();
    });

    // Геометрия слота каталога: `cardWidth = max(280, width − 48)`
    // (`hooks/useQuestCatalogResponsiveModel.ts:39`), высота — 238 в полосе
    // `isPhone` = [360, 480) (`hooks/useResponsive.ts:218`) и
    // `round(cardWidth / 380 × 260)` вне её. Поэтому на десктопе пропорция слота
    // константна (1.4615), а внутри полосы `isPhone` она едет от 1.311 до 1.811.
    const QUEST_CATALOG_SLOTS = [
        { label: 'mobile 390 (приёмка)', isPhone: true, cardWidth: 342, maxShare: 0.1 },
        // 420, а не 380: на 1280 каталог рисует две колонки — sidebar 340,
        // contentWidth 876, `min(420, floor((876 − 24) / 2))`
        // (`hooks/useQuestCatalogResponsiveModel.ts:41-44`). Слот 420×287.
        { label: 'desktop 1280 (приёмка)', isPhone: false, cardWidth: 420, maxShare: 0.1 },
        // Одноколоночный город: `cardWidth = min(600, contentWidth)`, слот 600×411.
        { label: 'desktop, одна колонка', isPhone: false, cardWidth: 600, maxShare: 0.1 },
        { label: 'узкий край полосы isPhone (360)', isPhone: true, cardWidth: 312, maxShare: 0.135 },
        { label: 'широкий край полосы isPhone (479)', isPhone: true, cardWidth: 431, maxShare: 0.135 },
    ] as const;

    /**
     * Пропорции обложек квестов на проде. Замер 2026-08-25,
     * `/api/quests/?compact=1&page_size=300`: 156 квестов, квадратных нет.
     */
    const PROD_COVER_RATIOS = [4 / 3, 1.461632, 1.5, 16 / 9];

    it.each(QUEST_CATALOG_SLOTS)(
        'кадрирует обложку `contain`, поле не выше потолка своей ширины ($label)',
        ({ isPhone, cardWidth, maxShare }) => {
            // docs/RULES.md → «Images and placeholders»: обложки квестов рисуются
            // ТОЛЬКО `contain`, исключений по поверхностям нет, а правка самого
            // правила запрещена (прецедент 29c30d95/INV2-17, откат 2026-08-19).
            // Эта строка меняла режим пять раз с апреля по июль 2026, каждый раз
            // без обоснования именно кропа, поэтому она закреплена отдельным
            // тестом, а не только внутри проверки блюр-подложки.
            mockIsPhone = isPhone;
            mockImageCardMedia.mockClear();
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={cardWidth}
                    cityId="krakow"
                    quest={makeQuest()}
                />,
            );

            const mediaProps = mockImageCardMedia.mock.calls[0]?.[0];
            expect(mediaProps?.fit).toBe('contain');

            // Порог у приёмочных ширин (390 и 1280) — 10% из Done gate #1560.
            // На краях полосы `isPhone` высота приколота к 238, слот уезжает от
            // пропорций обложек, и поле честно доходит до 13.2%; потолок 13.5%
            // не даёт ему вырасти молча. Лечится это заливкой и контентом
            // (семейство #1542/#1558), а не возвратом `cover`.
            const slotWidth = Number(mediaProps?.width);
            const slotHeight = Number(mediaProps?.height);
            for (const ratio of PROD_COVER_RATIOS) {
                const renderedWidth = Math.min(slotWidth, slotHeight * ratio);
                const renderedHeight = Math.min(slotHeight, slotWidth / ratio);
                const worst = Math.max(
                    (slotWidth - renderedWidth) / 2 / slotWidth,
                    (slotHeight - renderedHeight) / 2 / slotHeight,
                );
                expect(worst).toBeLessThanOrEqual(maxShare);
            }
        },
    );

    it('web оставляет блюр-подложку выключенной, native получает заливку полей', () => {
        // Две стороны одного контракта. Web: подложку включать нельзя —
        // WebKit держал её нарисованной, пока резкий `<img>` не появился
        // (регресс ниже по файлу). Native: при `contain` поля закрывает именно
        // blur-слой expo-image, потому что индекс `dominant_color` работает
        // только на web (`components/ui/ImageCardMedia.tsx:254`). Константный
        // `false` отбирал у Android и iPhone заливку и давал прозрачные поля.
        for (const [os, expected] of [['web', false], ['android', true], ['ios', true]] as const) {
            (Platform as { OS: string }).OS = os;
            mockImageCardMedia.mockClear();
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={345}
                    cityId="krakow"
                    quest={makeQuest()}
                />,
            );
            expect(mockImageCardMedia.mock.calls[0]?.[0]?.blurBackground).toBe(expected);
        }
    });

    it('requests high fetch priority for the first above-the-fold cards', () => {
        renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="krakow"
                quest={makeQuest()}
                index={0}
            />,
        );

        expect(mockImageCardMedia.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({ priority: 'high' }),
        );
    });

    it('asks to clarify age for a kids quest without replacing its city label', () => {
        const { getByTestId, getByText, queryByText } = renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="krakow"
                quest={makeQuest({ tags: ['kids', 'family'] })}
            />,
        );

        expect(getByTestId('quest-card-kids-krakow-dragon')).toBeTruthy();
        expect(getByText('Уточнить возраст')).toBeTruthy();
        expect(getByText('Kraków')).toBeTruthy();
        expect(queryByText('Для детей')).toBeNull();
        expect(queryByText('Детская сказка')).toBeNull();
    });

    it('shows an explicit age category when age tags are present', () => {
        const { getByTestId, getByText, queryByText } = renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="vitebsk"
                quest={makeQuest({ id: 'vitebsk-teens', tags: ['kids', 'age-11-14'] })}
            />,
        );

        expect(getByTestId('quest-card-kids-vitebsk-teens')).toBeTruthy();
        expect(getByText('11-14 лет')).toBeTruthy();
        expect(queryByText('Для детей')).toBeNull();
    });

    it('passes a resized proxy cover URL to native image instead of the full-size original', () => {
        (Platform as { OS: string }).OS = 'android';
        const prevApiUrl = process.env.EXPO_PUBLIC_API_URL;
        process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by';

        try {
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={340}
                    cityId="krakow"
                    quest={makeQuest({
                        cover: 'https://metravel.by/quest-cover/quests/1/main/abc.png',
                    })}
                    index={5}
                />,
            );

            const src = String(mockImageCardMedia.mock.calls[0]?.[0]?.src);
            const url = new URL(src);

            expect(url.origin + url.pathname).toBe(
                'https://metravel.by/quest-cover/quests/1/main/abc.png',
            );
            // Ширина — ступень контракта, а не «хоть какая-нибудь»: слот 340 CSS
            // при DPR 2 просит 680, ближайшая ступень `IMAGE_WIDTHS.questCover` — 800.
            expect(IMAGE_WIDTHS.questCover).toContain(Number(url.searchParams.get('w')));

            // Раньше здесь ожидались `q=60` и `fit=cover`. `quest-cover` — durable-
            // семейство: производные нарезаны заранее с качеством своего профиля
            // (`IMAGE_QUALITY.questCover`, он же q60) и под свой fit, поэтому оба
            // параметра бэкенд игнорирует, а каждый их набор — ОТДЕЛЬНЫЙ адрес,
            // отдельная запись в nginx- и браузерном кэше на один и тот же файл, и
            // расхождение с манифестным адресом (манифест их не ставит).
            //
            // Проба прода 2026-08-10, `quest-cover/quests/1/main/f0011e51….webp`:
            // `?w=800`, `?w=800&q=60&fit=cover` и даже `?w=800&q=20` — 7 798 B и
            // один и тот же md5 `c6aa4466…`, `immutable`. То есть `q` здесь не
            // «настройка качества», а мёртвый cache-buster: снятие его картинку не
            // ухудшает, она и так отдаётся q60-производной.
            //
            // Гейт живёт в `utils/imageProxy.ts` (`servedFromDurableFamily`), его
            // прямой контракт — `__tests__/utils/imageOptimization.test.ts`.
            // Legacy-роуты (`/media-resize/**`) режут в момент запроса, там оба
            // параметра по-прежнему отправляются.
            expect(url.searchParams.get('q')).toBeNull();
            expect(url.searchParams.get('fit')).toBeNull();
        } finally {
            process.env.EXPO_PUBLIC_API_URL = prevApiUrl;
        }
    });

    it('keeps only the first two covers eager and high-priority', () => {
        for (const index of [0, 1, 2]) {
            mockImageCardMedia.mockClear();
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={420}
                    cityId="krakow"
                    quest={makeQuest({ id: `quest-${index}` })}
                    index={index}
                />,
            );

            expect(mockImageCardMedia.mock.calls[0]?.[0]).toEqual(
                expect.objectContaining({
                    loading: index < 2 ? 'eager' : 'lazy',
                    priority: index < 2 ? 'high' : 'low',
                }),
            );
        }
    });

    it('запрашивает retina-ширину под слот 420 на DPR2: 840 → потолок набора 800', () => {
        const pixelRatioSpy = jest.spyOn(PixelRatio, 'get').mockReturnValue(2);
        const prevApiUrl = process.env.EXPO_PUBLIC_API_URL;
        process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by';

        try {
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={420}
                    cityId="krakow"
                    quest={makeQuest({
                        cover: 'https://metravel.by/quest-cover/quests/1/main/abc.png',
                    })}
                    index={2}
                />,
            );

            // Раньше здесь ожидалось `w=480`: на web плотность экрана намеренно
            // игнорировалась (`dpr = 1`), потому что мастером лежал PNG на 2.4 МБ и
            // каждая холодная конверсия стоила секунды. После #1166 мастер — WebP на
            // 46 КБ, и эта плата исчезла, а визуальная осталась: слот 420 CSS при
            // DPR 2 требует 840 device px, и на 480 браузер растягивал в 1.75×.
            // Замер 2026-07-31: w=320 → 1 918 B (апскейл 1.75×), w=640 → 5 390 B (0.88×).
            const src = String(mockImageCardMedia.mock.calls[0]?.[0]?.src);
            // 840 упирается в потолок набора `IMAGE_WIDTHS.questCover` (800).
            // Апскейл 1.05× — незаметен; расширять контракт ради него не нужно,
            // это был бы двусторонний релиз (#1167).
            expect(new URL(src).searchParams.get('w')).toBe('800');
            expect(src).not.toContain('w=1280');
        } finally {
            process.env.EXPO_PUBLIC_API_URL = prevApiUrl;
            pixelRatioSpy.mockRestore();
        }
    });

    it('regression: never renders only the blurred backdrop on a DPR3 iPhone card', () => {
        const pixelRatioSpy = jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
        const prevApiUrl = process.env.EXPO_PUBLIC_API_URL;
        process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by';

        try {
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={345}
                    cityId="krakow"
                    quest={makeQuest({
                        cover: 'https://metravel.by/quest-cover/quests/125/main/abc.png',
                    })}
                    index={0}
                />,
            );

            const src = String(mockImageCardMedia.mock.calls[0]?.[0]?.src);
            const mediaProps = mockImageCardMedia.mock.calls[0]?.[0];

            // This regression is not an undersized-source problem: Safari kept
            // the CSS blur backdrop painted while the sharp <img> was absent.
            // Ширина: слот 345 CSS × min(DPR 3, 2) = 690 → ступень 800.
            expect(new URL(src).searchParams.get('w')).toBe('800');
            expect(mediaProps).toEqual(expect.objectContaining({
                fit: 'contain',
                blurBackground: false,
            }));
            expect(mediaProps).not.toHaveProperty('allowCriticalWebBlur');
        } finally {
            process.env.EXPO_PUBLIC_API_URL = prevApiUrl;
            pixelRatioSpy.mockRestore();
        }
    });

    it('keeps the existing 2x cover cap on Android devices with DPR3 screens', () => {
        (Platform as { OS: string }).OS = 'android';
        const pixelRatioSpy = jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
        const prevApiUrl = process.env.EXPO_PUBLIC_API_URL;
        process.env.EXPO_PUBLIC_API_URL = 'https://metravel.by';

        try {
            renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={345}
                    cityId="krakow"
                    quest={makeQuest({
                        cover: 'https://metravel.by/quest-cover/quests/125/main/abc.png',
                    })}
                    index={0}
                />,
            );

            const src = String(mockImageCardMedia.mock.calls[0]?.[0]?.src);
            const selectedWidth = Number(new URL(src).searchParams.get('w'));

            expect(selectedWidth).toBe(800);
        } finally {
            process.env.EXPO_PUBLIC_API_URL = prevApiUrl;
            pixelRatioSpy.mockRestore();
        }
    });

    it('opens the quest reviews modal from the mobile reviews CTA', () => {
        const { getByTestId } = renderWithQueryClient(
            <QuestCard
                styles={styles}
                cardWidth={340}
                cityId="krakow"
                quest={makeQuest({ completionsCount: 3 })}
            />,
        );

        fireEvent.press(getByTestId('quest-card-reviews-krakow-dragon'));

        expect(getByTestId('quest-reviews-modal')).toBeTruthy();
        expect(mockPush).not.toHaveBeenCalled();
    });

    // INV2-01 (#1471): счётчик прохождений в desktop-оверлее каталога склоняется
    // по-русски. Раньше все фикстуры шли в mobile-ветку (isPhone=true), где счётчик
    // выводится голым числом без слова, поэтому runtime-склонение «раз/раза» никто
    // не покрывал: приёмка 22.08.2026 поймала на проде «Пройдено 3 раз» вместо
    // «Пройдено 3 раза». Эти тесты фиксируют desktop-ветку, чтобы форма не съехала.
    describe('completions counter (desktop overlay)', () => {
        beforeEach(() => {
            mockIsPhone = false;
        });

        // Контроль русских форм: 1 → «раз», 2/3/4 → «раза», 5/11/21 → «раз».
        it.each([
            [1, 'Пройдено 1 раз'],
            [2, 'Пройдено 2 раза'],
            [3, 'Пройдено 3 раза'],
            [4, 'Пройдено 4 раза'],
            [5, 'Пройдено 5 раз'],
            [11, 'Пройдено 11 раз'],
            [21, 'Пройдено 21 раз'],
        ])('склоняет ненулевой счётчик: count=%i → "%s"', (count, expected) => {
            const { getByText } = renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={380}
                    cityId="minsk"
                    quest={makeQuest({ id: 'minsk-nezavisimosti', completionsCount: count })}
                />,
            );

            expect(getByText(expected)).toBeTruthy();
        });

        it('сохраняет реальный счётчик и первопроходца вместе', () => {
            const { getByText } = renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={380}
                    cityId="minsk"
                    quest={makeQuest({
                        id: 'minsk-nezavisimosti',
                        completionsCount: 3,
                        firstCompleter: { id: 7, name: 'Roman Shakun', avatar: null },
                    })}
                />,
            );

            expect(getByText('Пройдено 3 раза')).toBeTruthy();
            expect(getByText('Первым прошёл: Roman Shakun')).toBeTruthy();
        });

        it('нулевое состояние не показывает статистику прохождений в оверлее', () => {
            const { queryByTestId, queryByText } = renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={380}
                    cityId="minsk"
                    quest={makeQuest({ id: 'minsk-empty', completionsCount: 0, firstCompleter: null })}
                />,
            );

            expect(queryByTestId('quest-card-completions-minsk-empty')).toBeNull();
            expect(queryByText('Ещё никто не проходил')).toBeNull();
            expect(queryByText(/Пройдено/)).toBeNull();
        });
    });

    // #1486: усреднённая оценка по одному-двум отзывам врёт — «5.0» за одного
    // человека. Показываем агрегат только за выборку от трёх, вход в читалку
    // при этом остаётся на месте: количество отзывов — факт, а не вывод.
    describe('порог показа агрегированной оценки', () => {
        describe.each([
            ['телефонная полоса деталей', true],
            ['десктопный оверлей', false],
        ])('%s', (_label, isPhone) => {
            beforeEach(() => {
                mockIsPhone = isPhone;
            });

            it.each([0, 1, 2])('скрывает оценку при %i отзывах', (ratingCount) => {
                const { queryByTestId } = renderWithQueryClient(
                    <QuestCard
                        styles={styles}
                        cardWidth={380}
                        cityId="minsk"
                        quest={makeQuest({ id: 'minsk-threshold', ratingAvg: 5, ratingCount })}
                    />,
                );

                expect(queryByTestId('quest-card-rating-minsk-threshold')).toBeNull();
            });

            it('показывает оценку начиная с трёх отзывов', () => {
                const { getByTestId } = renderWithQueryClient(
                    <QuestCard
                        styles={styles}
                        cardWidth={380}
                        cityId="minsk"
                        quest={makeQuest({ id: 'minsk-threshold', ratingAvg: 4.7, ratingCount: 3 })}
                    />,
                );

                expect(getByTestId('quest-card-rating-minsk-threshold')).toBeTruthy();
            });
        });

        it('оставляет вход в читалку при единственном отзыве', () => {
            mockIsPhone = true;
            const { getByTestId, queryByTestId } = renderWithQueryClient(
                <QuestCard
                    styles={styles}
                    cardWidth={380}
                    cityId="minsk"
                    quest={makeQuest({ id: 'minsk-single', ratingAvg: 5, ratingCount: 1 })}
                />,
            );

            expect(queryByTestId('quest-card-rating-minsk-single')).toBeNull();
            expect(getByTestId('quest-card-reviews-minsk-single')).toBeTruthy();
        });
    });
});
