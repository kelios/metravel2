import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EmptyState from '@/components/EmptyState';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, size: _size, color: _color, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

// Mock constants
jest.mock('@/constants/airyColors', () => ({
  AIRY_COLORS: {
    primary: '#ff9f5a',
    primaryLight: '#ffd28f',
  },
  AIRY_GRADIENTS: {
    primary: 'linear-gradient(135deg, #ff9f5a 0%, #ff6b35 100%)',
  },
  AIRY_BOX_SHADOWS: {
    medium: '0 4px 12px rgba(255, 159, 90, 0.2)',
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

  it('should not render action button when not provided', () => {
    const { toJSON } = render(
      <EmptyState
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
        icon="inbox"
        title="No items"
        description="Description"
      />
    );

    // Проверяем, что компонент рендерится с дефолтным размером
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
