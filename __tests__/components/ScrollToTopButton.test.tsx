import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ScrollToTopButton from '@/components/ScrollToTopButton';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, size, color, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

describe('ScrollToTopButton', () => {
  let scrollViewRef: React.RefObject<any>;
  let flatListRef: React.RefObject<any>;

  beforeEach(() => {
    scrollViewRef = { current: { scrollTo: jest.fn() } };
    flatListRef = { current: { scrollToOffset: jest.fn() } };
  });

  it('should not render when forceVisible is false', () => {
    const { queryByTestId } = render(<ScrollToTopButton forceVisible={false} />);
    expect(queryByTestId('scroll-to-top-button')).toBeNull();
  });

  it('should render when scroll position is above threshold', () => {
    const { getByTestId } = render(<ScrollToTopButton forceVisible />);
    expect(getByTestId('scroll-to-top-button')).toBeTruthy();
  });

  it('should scroll ScrollView to top when button is pressed', () => {
    const { getByTestId } = render(
      <ScrollToTopButton
        forceVisible
        scrollViewRef={scrollViewRef}
      />
    );

    const button = getByTestId('scroll-to-top-button');
    fireEvent.press(button!);

    expect(scrollViewRef.current.scrollTo).toHaveBeenCalledWith({
      y: 0,
      animated: true,
    });
  });

  it('should scroll FlatList to top when button is pressed', () => {
    const { getByTestId } = render(
      <ScrollToTopButton
        forceVisible
        flatListRef={flatListRef}
      />
    );

    const button = getByTestId('scroll-to-top-button');
    fireEvent.press(button!);

    expect(flatListRef.current.scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: true,
    });
  });

  it('should prioritize ScrollView over FlatList', () => {
    const { getByTestId } = render(
      <ScrollToTopButton
        forceVisible
        scrollViewRef={scrollViewRef}
        flatListRef={flatListRef}
      />
    );

    const button = getByTestId('scroll-to-top-button');
    fireEvent.press(button!);

    expect(scrollViewRef.current.scrollTo).toHaveBeenCalled();
    expect(flatListRef.current.scrollToOffset).not.toHaveBeenCalled();
  });

  it('respects forceVisible overrides', () => {
    const { rerender, queryByTestId } = render(<ScrollToTopButton forceVisible={false} />);
    expect(queryByTestId('scroll-to-top-button')).toBeNull();

    rerender(<ScrollToTopButton forceVisible />);
    expect(queryByTestId('scroll-to-top-button')).toBeTruthy();
  });

  it('should have accessibility props', () => {
    const { getByTestId } = render(<ScrollToTopButton forceVisible />);

    const button = getByTestId('scroll-to-top-button');
    expect(button?.props.accessibilityRole).toBe('button');
    expect(button?.props.accessibilityLabel).toBe('Прокрутить наверх');
  });
});

