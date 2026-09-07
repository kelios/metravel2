// #1844: на компактной шапке вкладки «Маршрут» описание поездки обрезалось до
// двух строк без единого способа его развернуть — список автобусов RGTR до
// старта Mullerthal Trail был не виден вовсе. Тест держит и кнопку, и обратную
// сторону: там, где текст не обрезан, кнопки быть не должно.
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import TripPlanCollapsibleText, {
  estimateTripPlanTextLines,
  tripPlanTextCharsPerLine,
} from '@/components/trips/planning/TripPlanCollapsibleText';

// Компактная шапка живёт на всей мобильной ширине, поэтому вместимость строки
// считается по вьюпорту: 390dp — эталон из постановки, 430dp — крупный телефон.
let mockViewportWidth = 390;

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isHydrated: true, isMobile: true, width: mockViewportWidth }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primaryDark: 'darkslategray',
    text: 'black',
  }),
}));

const LOGISTICS_TEXT =
  'Как доехать до старта: из Люксембурга автобусы RGTR 211, 212, 190, 191 до Эхтернаха.\n' +
  'Обратно с финиша: 272, 222, 231, 262 — последний рейс около 19:40, дальше только такси.';

const SHORT_TEXT = 'Идём налегке, ночуем в Бердорфе.';

const EXPAND_LABEL = 'Показать полностью';
const COLLAPSE_LABEL = 'Свернуть';

describe('TripPlanCollapsibleText', () => {
  beforeEach(() => {
    mockViewportWidth = 390;
  });

  it('offers the toggle and clamps the text when the description does not fit the compact header', () => {
    const { getByTestId, getByText } = render(
      <TripPlanCollapsibleText
        text={LOGISTICS_TEXT}
        numberOfLines={2}
        testID="trip-plan-description"
      />,
    );

    expect(getByTestId('trip-plan-description').props.numberOfLines).toBe(2);
    expect(getByText(EXPAND_LABEL)).toBeTruthy();
  });

  it('shows the whole description on press and folds it back', () => {
    const { getByTestId, getByText, queryByText } = render(
      <TripPlanCollapsibleText
        text={LOGISTICS_TEXT}
        numberOfLines={2}
        testID="trip-plan-description"
      />,
    );

    fireEvent.press(getByTestId('trip-plan-description-toggle'));

    expect(getByTestId('trip-plan-description').props.numberOfLines).toBeUndefined();
    expect(getByText(COLLAPSE_LABEL)).toBeTruthy();
    expect(queryByText(EXPAND_LABEL)).toBeNull();

    fireEvent.press(getByTestId('trip-plan-description-toggle'));

    expect(getByTestId('trip-plan-description').props.numberOfLines).toBe(2);
    expect(getByText(EXPAND_LABEL)).toBeTruthy();
  });

  it('leaves a short description untouched — no toggle and no clamping', () => {
    const { getByTestId, queryByTestId } = render(
      <TripPlanCollapsibleText
        text={SHORT_TEXT}
        numberOfLines={2}
        testID="trip-plan-description"
      />,
    );

    expect(queryByTestId('trip-plan-description-toggle')).toBeNull();
    expect(getByTestId('trip-plan-description').props.numberOfLines).toBeUndefined();
  });

  // Один и тот же текст на 390dp не помещается в две строки, а на 430dp
  // помещается: кнопка, ничего не меняющая по нажатию, — тоже дефект.
  it('keeps the toggle off a description that fits two lines on a wider phone', () => {
    const borderlineText =
      'Старт от вокзала: автобус 211 в 8:40, обратно 262 в 19:40 — билет берите у водителя, наличными.';
    expect(borderlineText.length).toBe(95);

    mockViewportWidth = 390;
    const narrow = render(
      <TripPlanCollapsibleText
        text={borderlineText}
        numberOfLines={2}
        testID="trip-plan-description"
      />,
    );
    expect(narrow.getByTestId('trip-plan-description-toggle')).toBeTruthy();

    mockViewportWidth = 430;
    const wide = render(
      <TripPlanCollapsibleText
        text={borderlineText}
        numberOfLines={2}
        testID="trip-plan-description"
      />,
    );
    expect(wide.queryByTestId('trip-plan-description-toggle')).toBeNull();
    expect(wide.getByTestId('trip-plan-description').props.numberOfLines).toBeUndefined();
  });

  // Регресс desktop web и соседних вкладок: там шапка не компактная,
  // `numberOfLines` не передаётся — описание и так видно целиком.
  it('does not add the toggle where the header renders the description in full', () => {
    const { getByTestId, queryByTestId } = render(
      <TripPlanCollapsibleText text={LOGISTICS_TEXT} testID="trip-plan-description" />,
    );

    expect(queryByTestId('trip-plan-description-toggle')).toBeNull();
    expect(getByTestId('trip-plan-description').props.numberOfLines).toBeUndefined();
  });

  it('starts collapsed again for another trip description', () => {
    const { getByTestId, getByText, rerender } = render(
      <TripPlanCollapsibleText
        text={LOGISTICS_TEXT}
        numberOfLines={2}
        testID="trip-plan-description"
      />,
    );

    fireEvent.press(getByTestId('trip-plan-description-toggle'));
    expect(getByTestId('trip-plan-description').props.numberOfLines).toBeUndefined();

    rerender(
      <TripPlanCollapsibleText
        text={`${LOGISTICS_TEXT} Вторая поездка, другое описание.`}
        numberOfLines={2}
        testID="trip-plan-description"
      />,
    );

    expect(getByTestId('trip-plan-description').props.numberOfLines).toBe(2);
    expect(getByText(EXPAND_LABEL)).toBeTruthy();
  });
});

describe('estimateTripPlanTextLines', () => {
  it('counts every hard line break as its own line', () => {
    expect(estimateTripPlanTextLines('Старт\nФиниш\nОбратно', 47)).toBe(3);
  });

  it('wraps long lines by the line capacity', () => {
    expect(estimateTripPlanTextLines('a'.repeat(47), 47)).toBe(1);
    expect(estimateTripPlanTextLines('a'.repeat(48), 47)).toBe(2);
    expect(estimateTripPlanTextLines('a'.repeat(95), 47)).toBe(3);
  });
});

describe('tripPlanTextCharsPerLine', () => {
  it('grows the line capacity with the viewport a compact header still covers', () => {
    expect(tripPlanTextCharsPerLine(390)).toBe(47);
    expect(tripPlanTextCharsPerLine(430)).toBe(53);
    expect(tripPlanTextCharsPerLine(767)).toBe(98);
  });

  it('falls back to the reference phone width before hydration reports a viewport', () => {
    expect(tripPlanTextCharsPerLine(0)).toBe(47);
    expect(tripPlanTextCharsPerLine(Number.NaN)).toBe(47);
  });
});
