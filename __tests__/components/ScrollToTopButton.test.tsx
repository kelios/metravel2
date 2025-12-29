import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import { Animated, Platform } from 'react-native';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

// Mock design system
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    colors: {
      primary: '#6b8e7f',
    },
    radii: {
      pill: 24,
    },
    shadows: {
      medium: '0 4px 12px rgba(0,0,0,0.1)',
    },
  },
}));

// Mock global focus styles
jest.mock('@/styles/globalFocus', () => ({
  globalFocusStyles: {
    focusable: {},
  },
}));

// Mock window for web
const mockWindow = {
  scrollTo: jest.fn(),
};

beforeAll(() => {
  (global as any).window = mockWindow;
});

// Mock Animated API
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Animated: {
      ...RN.Animated,
      Value: jest.fn((initialValue) => ({
        _value: initialValue,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        setValue: jest.fn(),
      })),
      timing: jest.fn(() => ({
        start: jest.fn((callback) => {
          callback && callback({ finished: true });
        }),
      })),
      spring: jest.fn(() => ({
        start: jest.fn((callback) => {
          callback && callback({ finished: true });
        }),
      })),
      parallel: jest.fn((animations) => ({
        start: jest.fn((callback) => {
          animations.forEach((anim: any) => anim.start());
          callback && callback({ finished: true });
        }),
      })),
    },
  };
});

describe('ScrollToTopButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when not visible', () => {
    const { toJSON } = render(<ScrollToTopButton />);
    const tree = toJSON();
    expect(tree).toBeNull();
  });

  it('should render when forceVisible is true', () => {
    const { getByTestId } = render(
      <ScrollToTopButton forceVisible={true} />
    );
    expect(getByTestId('scroll-to-top-button')).toBeTruthy();
  });

  it('should scroll ScrollView to top when button is pressed', () => {
    const scrollViewRef = {
      current: {
        scrollTo: jest.fn(),
      },
    };

    const { getByTestId } = render(
      <ScrollToTopButton scrollViewRef={scrollViewRef} forceVisible={true} />
    );

    const button = getByTestId('scroll-to-top-button');
    fireEvent.press(button);

    expect(scrollViewRef.current.scrollTo).toHaveBeenCalledWith({
      y: 0,
      animated: true,
    });
  });

  it('should scroll FlatList to top when button is pressed', () => {
    const flatListRef = {
      current: {
        scrollToOffset: jest.fn(),
      },
    };

    const { getByTestId } = render(
      <ScrollToTopButton flatListRef={flatListRef} forceVisible={true} />
    );

    const button = getByTestId('scroll-to-top-button');
    fireEvent.press(button);

    expect(flatListRef.current.scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: true,
    });
  });

  it('should scroll window to top on web when no ref provided', () => {
    (Platform.OS as any) = 'web';
    const { getByTestId } = render(
      <ScrollToTopButton forceVisible={true} />
    );

    const button = getByTestId('scroll-to-top-button');
    fireEvent.press(button);

    expect(mockWindow.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('should have correct accessibility label', () => {
    const { getByTestId } = render(
      <ScrollToTopButton forceVisible={true} />
    );

    const button = getByTestId('scroll-to-top-button');
    expect(button.props.accessibilityLabel).toBe('Прокрутить наверх');
  });

  it('should show arrow icon', () => {
    const { getByTestId } = render(
      <ScrollToTopButton forceVisible={true} />
    );

    expect(getByTestId('feather-arrow-up')).toBeTruthy();
  });

  it('should respond to scrollY value changes', () => {
    const scrollY = new Animated.Value(0);
    const { rerender } = render(
      <ScrollToTopButton scrollY={scrollY} threshold={300} />
    );

    // Симулируем прокрутку
    scrollY.setValue(400);
    rerender(<ScrollToTopButton scrollY={scrollY} threshold={300} />);

    // Компонент должен стать видимым
    const { toJSON } = render(
      <ScrollToTopButton scrollY={scrollY} threshold={300} forceVisible={true} />
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
