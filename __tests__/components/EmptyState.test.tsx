import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import EmptyState from '@/components/ui/EmptyState';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const mockRN: any = {};
  for (const key in RN) {
    if (
      key !== 'ProgressBarAndroid' &&
      key !== 'Clipboard' &&
      key !== 'PushNotificationIOS' &&
      key !== 'DevSettings'
    ) {
      mockRN[key] = RN[key];
    }
  }
  mockRN.useWindowDimensions = () => ({ width: 375, height: 667 });
  mockRN.ProgressBarAndroid = RN.ProgressBarAndroid || {};
  mockRN.Clipboard = RN.Clipboard || {};
  mockRN.PushNotificationIOS = RN.PushNotificationIOS || {};
  mockRN.DevSettings = RN.DevSettings || {
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  return mockRN;
});

describe('EmptyState', () => {
  it('should render with icon, title and description', () => {
    const { toJSON, getByTestId } = render(
      <EmptyState
        density="full"
        icon="inbox"
        title="No items"
        description="There are no items to display"
      />
    );

    // Проверяем, что компонент рендерится
    const tree = toJSON();
    expect(tree).toBeTruthy();
    
    // Проверяем структуру через JSON
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('No items');
    expect(treeStr).toContain('There are no items to display');
    
    // Проверяем наличие иконки через testID
    expect(getByTestId('feather-inbox')).toBeTruthy();
  });

  it('should render action button when provided', () => {
    const onPress = jest.fn();
    const { UNSAFE_getAllByType, toJSON } = render(
      <EmptyState
        density="full"
        icon="inbox"
        title="No items"
        description="There are no items to display"
        action={{
          label: 'Add Item',
          onPress,
        }}
      />
    );

    // Проверяем структуру через JSON
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Add Item');

    // Находим Pressable и нажимаем на него
    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);
    expect(pressables.length).toBeGreaterThan(0);
    
    // Нажимаем на последний Pressable (кнопка действия)
    fireEvent.press(pressables[pressables.length - 1]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should pass custom layout action style while preserving primary button color', () => {
    const customActionStyle = { alignSelf: 'stretch' as const, backgroundImage: 'none' };
    const { UNSAFE_getAllByType } = render(
      <EmptyState
        density="full"
        icon="inbox"
        title="No items"
        description="There are no items to display"
        action={{
          label: 'Add Item',
          onPress: jest.fn(),
          style: customActionStyle as any,
        }}
      />
    );

    const { Pressable, StyleSheet } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);
    const actionButton = pressables[pressables.length - 1];
    const buttonStyle = actionButton.props.style({ pressed: false, hovered: false });

    expect(StyleSheet.flatten(buttonStyle)).toMatchObject({
      ...customActionStyle,
      backgroundColor: '#7a9d8f',
    });
  });

  it('should not render action button when not provided', () => {
    const { toJSON } = render(
      <EmptyState
        density="full"
        icon="inbox"
        title="No items"
        description="There are no items to display"
      />
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('Add Item');
  });

  it('should use custom icon size', () => {
    const { toJSON } = render(
      <EmptyState
        density="full"
        icon="inbox"
        title="No items"
        description="Description"
        iconSize={120}
      />
    );

    // Проверяем, что компонент рендерится с кастомным размером
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should use custom icon color', () => {
    const { toJSON } = render(
      <EmptyState
        density="full"
        icon="inbox"
        title="No items"
        description="Description"
        iconColor="#ff0000"
      />
    );

    // Проверяем, что компонент рендерится с кастомным цветом
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should use default icon size when not provided', () => {
    const { toJSON } = render(
      <EmptyState
        density="full"
        icon="inbox"
        title="No items"
        description="Description"
      />
    );

    // Проверяем, что компонент рендерится с дефолтным размером
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  describe('density (#2104)', () => {
    const flat = (node: any) => StyleSheet.flatten(node.props.style) || {};
    const circleOf = (getByTestId: any, icon: string) => {
      let node = getByTestId(`feather-${icon}`).parent;
      while (node && flat(node).borderRadius == null) node = node.parent;
      return node;
    };

    it('compact: без flex/minHeight, круг 56, иконка 28, testID кнопок', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <EmptyState
          density="compact"
          icon="map"
          title="Ваши маршруты появятся здесь"
          description="Описание"
          action={{ label: 'Создать', onPress }}
          secondaryAction={{ label: 'Квест', onPress }}
        />
      );
      const root = flat(getByTestId('empty-state'));
      expect(root.minHeight).toBeUndefined();
      expect(root.flex).toBeUndefined();
      const circle = flat(circleOf(getByTestId, 'map'));
      expect(circle.width).toBe(56);
      expect(circle.height).toBe(56);
      expect(getByTestId('feather-map').props.size).toBe(28);
      fireEvent.press(getByTestId('empty-state-action'));
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(getByTestId('empty-state-secondary-action')).toBeTruthy();
    });

    it('full: прежний вид — minHeight и круг больше компактного', () => {
      const { getByTestId } = render(
        <EmptyState density="full" icon="map" title="T" description="D" />
      );
      const root = flat(getByTestId('empty-state'));
      expect(root.minHeight).toBeGreaterThanOrEqual(260);
      expect(root.flex).toBe(1);
      expect(flat(circleOf(getByTestId, 'map')).width).toBeGreaterThan(56);
    });

    it('moreActions и собственные testID действий, описание необязательно', () => {
      const onMore = jest.fn();
      const { getByTestId, queryByText } = render(
        <EmptyState
          density="compact"
          testID="panel-empty"
          icon="map-pin"
          title="Ничего не нашлось"
          action={{ label: 'Расширить', onPress: jest.fn(), testID: 'empty-expand-radius' }}
          moreActions={[{ label: 'Фильтры', onPress: onMore, testID: 'empty-open-filters' }]}
        />
      );
      expect(getByTestId('panel-empty')).toBeTruthy();
      expect(getByTestId('empty-expand-radius')).toBeTruthy();
      fireEvent.press(getByTestId('empty-open-filters'));
      expect(onMore).toHaveBeenCalledTimes(1);
      expect(queryByText('undefined')).toBeNull();
    });
  });

  // #2114: компактная заглушка часто монтируется после ответа данных, а useResponsive
  // даёт новому потребителю один кадр «до гидратации» (desktop). Вид не должен зависеть
  // от ширины — иначе второй кадр перекладывает кнопки и сдвигает всё ниже.
  it('compact не зависит от ширины, full — зависит', () => {
    const { createEmptyStateStyles } = require('@/components/ui/EmptyState');
    const { useThemedColors } = require('@/hooks/useTheme');
    const colors = (() => {
      let value: unknown;
      const Probe = () => {
        value = useThemedColors();
        return null;
      };
      render(<Probe />);
      return value;
    })();
    const flat = (styles: Record<string, unknown>) =>
      JSON.stringify(Object.fromEntries(Object.entries(styles).map(([k, v]) => [k, StyleSheet.flatten(v as never)])));
    expect(flat(createEmptyStateStyles(colors, 'compact', true))).toEqual(flat(createEmptyStateStyles(colors, 'compact', false)));
    expect(flat(createEmptyStateStyles(colors, 'full', true))).not.toEqual(flat(createEmptyStateStyles(colors, 'full', false)));
  });

  // Кнопки компактной заглушки: узко — столбик, шире планшета — ряд; первый кадр (React
  // в узком варианте) на широком экране выправляет critical CSS из того же реестра.
  it('кнопки compact — реестр по ширине и правило critical CSS', () => {
    const { EMPTY_STATE_LAYOUT } = require('@/components/ui/emptyStateLayout');
    const { breakpointStyle } = require('@/utils/breakpointLayout');
    const { buildCriticalCSS } = require('@/utils/criticalCSSBuilder');
    expect(breakpointStyle(EMPTY_STATE_LAYOUT, 'compactActions', false)).toMatchObject({ flexDirection: 'column', gap: 8 });
    expect(breakpointStyle(EMPTY_STATE_LAYOUT, 'compactActions', true)).toMatchObject({ flexDirection: 'row', gap: 12 });
    expect(buildCriticalCSS()).toContain('[data-bp-layout="emptyState-compactActions"]{flex-direction:row !important');
  });
});
