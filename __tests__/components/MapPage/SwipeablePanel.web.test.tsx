import React from 'react';
import { render } from '@testing-library/react-native';
import SwipeablePanel from '@/components/MapPage/SwipeablePanel';
import { Text, View } from 'react-native';

describe('SwipeablePanel (Web)', () => {
  it('рендерится без ошибок', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <SwipeablePanel isOpen={true} onClose={onClose}>
        <Text>Test Content</Text>
      </SwipeablePanel>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('рендерится с правильными пропсами', () => {
    const onClose = jest.fn();
    const { getByText, rerender } = render(
      <SwipeablePanel
        isOpen={true}
        onClose={onClose}
        swipeDirection="right"
        threshold={100}
      >
        <Text>Test Content</Text>
      </SwipeablePanel>
    );

    expect(getByText('Test Content')).toBeTruthy();

    // Проверяем, что компонент может быть перерендерен с другими пропсами
    rerender(
      <SwipeablePanel
        isOpen={false}
        onClose={onClose}
        swipeDirection="left"
        threshold={150}
      >
        <Text>Test Content Updated</Text>
      </SwipeablePanel>
    );

    expect(getByText('Test Content Updated')).toBeTruthy();
  });

  it('рендерится с кастомными стилями', () => {
    const onClose = jest.fn();
    const customStyle = { backgroundColor: 'red' };

    const { getByText } = render(
      <SwipeablePanel isOpen={true} onClose={onClose} style={customStyle}>
        <Text>Test Content</Text>
      </SwipeablePanel>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('поддерживает различные направления свайпа', () => {
    const onClose = jest.fn();

    // Свайп вправо
    const { rerender, getByText } = render(
      <SwipeablePanel isOpen={true} onClose={onClose} swipeDirection="right">
        <Text>Test Content</Text>
      </SwipeablePanel>
    );

    expect(getByText('Test Content')).toBeTruthy();

    // Свайп влево
    rerender(
      <SwipeablePanel isOpen={true} onClose={onClose} swipeDirection="left">
        <Text>Test Content</Text>
      </SwipeablePanel>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('рендерит дочерние элементы', () => {
    const onClose = jest.fn();

    const { getByText, getByTestId } = render(
      <SwipeablePanel isOpen={true} onClose={onClose}>
        <View testID="child-view">
          <Text>Child 1</Text>
          <Text>Child 2</Text>
        </View>
      </SwipeablePanel>
    );

    expect(getByTestId('child-view')).toBeTruthy();
    expect(getByText('Child 1')).toBeTruthy();
    expect(getByText('Child 2')).toBeTruthy();
  });
});

