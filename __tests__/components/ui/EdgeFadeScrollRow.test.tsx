import React from 'react';
import { ScrollView, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';

import EdgeFadeScrollRow, { transparentVariant } from '@/components/ui/EdgeFadeScrollRow';

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ surface: '#ffffff', background: '#fdfcfb' }),
}));

// Общий мок из `__mocks__` глотает `colors`, а именно они здесь и проверяются:
// цвет затухания обязан совпасть с фоном под рядом, иначе у края встаёт полоса.
jest.mock('expo-linear-gradient', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    LinearGradient: (props: Record<string, any>) =>
      ReactModule.createElement(View, {
        testID: props.testID,
        style: props.style,
        pointerEvents: props.pointerEvents,
        colors: props.colors,
      }),
  };
});

const scrollEvent = (offsetX: number, layoutWidth: number, contentWidth: number) => ({
  nativeEvent: {
    contentOffset: { x: offsetX },
    layoutMeasurement: { width: layoutWidth },
    contentSize: { width: contentWidth },
  },
});

const renderRow = (props: Record<string, unknown> = {}) =>
  render(
    <EdgeFadeScrollRow {...props}>
      <Text>Страны</Text>
      <Text>Карта</Text>
      <Text>Хочу поехать</Text>
    </EdgeFadeScrollRow>
  );

describe('EdgeFadeScrollRow', () => {
  it('оставляет ряд без затухания, пока он помещается целиком', () => {
    const { UNSAFE_getByType, queryByTestId } = renderRow();
    const scroll = UNSAFE_getByType(ScrollView);

    act(() => {
      scroll.props.onLayout({ nativeEvent: { layout: { width: 390 } } });
      scroll.props.onContentSizeChange(360, 44);
    });

    expect(queryByTestId('edge-fade-left')).toBeNull();
    expect(queryByTestId('edge-fade-right')).toBeNull();
  });

  it('показывает затухание только с той стороны, где есть куда прокручивать', () => {
    const { UNSAFE_getByType, queryByTestId } = renderRow();
    const scroll = UNSAFE_getByType(ScrollView);

    act(() => {
      scroll.props.onLayout({ nativeEvent: { layout: { width: 390 } } });
      scroll.props.onContentSizeChange(700, 44);
    });

    expect(queryByTestId('edge-fade-left')).toBeNull();
    expect(queryByTestId('edge-fade-right')).toBeTruthy();

    act(() => {
      scroll.props.onScroll(scrollEvent(120, 390, 700));
    });

    expect(queryByTestId('edge-fade-left')).toBeTruthy();
    expect(queryByTestId('edge-fade-right')).toBeTruthy();

    act(() => {
      scroll.props.onScroll(scrollEvent(310, 390, 700));
    });

    expect(queryByTestId('edge-fade-left')).toBeTruthy();
    expect(queryByTestId('edge-fade-right')).toBeNull();
  });

  it('не зажигает затухание на субпиксельном хвосте прокрутки', () => {
    const { UNSAFE_getByType, queryByTestId } = renderRow();
    const scroll = UNSAFE_getByType(ScrollView);

    act(() => {
      scroll.props.onScroll(scrollEvent(1.5, 390, 392));
    });

    expect(queryByTestId('edge-fade-left')).toBeNull();
    expect(queryByTestId('edge-fade-right')).toBeNull();
  });

  it('прокидывает собственные обработчики и ref вызывающей стороны', () => {
    const onLayout = jest.fn();
    const onScroll = jest.fn();
    const ref = React.createRef<ScrollView>();

    const { UNSAFE_getByType } = render(
      <EdgeFadeScrollRow ref={ref} onLayout={onLayout} onScroll={onScroll}>
        <Text>Страны</Text>
      </EdgeFadeScrollRow>
    );
    const scroll = UNSAFE_getByType(ScrollView);

    act(() => {
      scroll.props.onLayout({ nativeEvent: { layout: { width: 390 } } });
      scroll.props.onScroll(scrollEvent(0, 390, 700));
    });

    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(ref.current).toBeTruthy();
  });

  it('затухает в переданный фон поверхности, а не в цвет карточки', () => {
    const { UNSAFE_getByType, getByTestId } = renderRow({ fadeColor: '#fdfcfb' });
    const scroll = UNSAFE_getByType(ScrollView);

    act(() => {
      scroll.props.onScroll(scrollEvent(120, 390, 700));
    });

    // Слева непрозрачный край у самой кромки, справа — наоборот.
    expect(getByTestId('edge-fade-left').props.colors).toEqual([
      '#fdfcfb',
      'rgba(253, 252, 251, 0)',
    ]);
    expect(getByTestId('edge-fade-right').props.colors).toEqual([
      'rgba(253, 252, 251, 0)',
      '#fdfcfb',
    ]);
  });

  it('без явного цвета берёт `colors.surface` темы', () => {
    const { UNSAFE_getByType, getByTestId } = renderRow();
    const scroll = UNSAFE_getByType(ScrollView);

    act(() => {
      scroll.props.onScroll(scrollEvent(120, 390, 700));
    });

    expect(getByTestId('edge-fade-right').props.colors).toEqual([
      'rgba(255, 255, 255, 0)',
      '#ffffff',
    ]);
  });

  it('гасит градиент в тот же цвет с нулевой альфой, а не в чёрный transparent', () => {
    // На iOS `transparent` — это rgba(0,0,0,0), и ряд затухал бы через серость.
    expect(transparentVariant('#ffffff')).toBe('rgba(255, 255, 255, 0)');
    expect(transparentVariant('#fdfcfb')).toBe('rgba(253, 252, 251, 0)');
    expect(transparentVariant('#2a2a2a')).toBe('rgba(42, 42, 42, 0)');
    expect(transparentVariant('#fff')).toBe('rgba(255, 255, 255, 0)');
    expect(transparentVariant('rgb(26, 26, 26)')).toBe('rgba(26, 26, 26, 0)');
    expect(transparentVariant('rgba(26, 26, 26, 0.9)')).toBe('rgba(26, 26, 26, 0)');
  });
});
