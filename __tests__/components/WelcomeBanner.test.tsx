import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import WelcomeBanner from '@/components/layout/WelcomeBanner';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

// expo-router мокается глобально в __tests__/setup.ts

// Mock design system
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    colors: {
      primary: '#6b8e7f',
      primarySoft: '#e8f5e9',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
    },
    radii: {
      md: 8,
      lg: 12,
    },
  },
}));

// Mock LinearGradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'linear-gradient', ...props }, children),
  };
});

describe('WelcomeBanner', () => {
  it('should render full banner by default', () => {
    const { toJSON } = render(<WelcomeBanner />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Откройте мир путешествий');
  });

  it('should render compact version when compact is true', () => {
    const { toJSON } = render(<WelcomeBanner compact={true} />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Откройте мир путешествий');
  });

  it('should render title and subtitle', () => {
    const { toJSON } = render(<WelcomeBanner />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Откройте мир путешествий');
    expect(treeStr).toContain('Исследуйте уникальные маршруты');
  });

  it('should render create travel button', () => {
    const { toJSON } = render(<WelcomeBanner />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Создать путешествие');
  });

  it('should render map button', () => {
    const { toJSON } = render(<WelcomeBanner />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('На карте');
  });

  it('should navigate to new travel page when create button is pressed', () => {
    const { router } = require('expo-router');
    router.push.mockClear();

    const { UNSAFE_getAllByType } = render(<WelcomeBanner />);
    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);

    // Находим кнопку создания путешествия
    const createButton = pressables.find((p: any) => {
      const children = p.props.children;
      if (Array.isArray(children)) {
        return children.some((child: any) =>
          child?.props?.children === 'Создать путешествие'
        );
      }
      return false;
    });

    if (createButton) {
      fireEvent.press(createButton);
      expect(router.push).toHaveBeenCalledWith('/travel/new');
    }
  });

  it('should navigate to map page when map button is pressed', () => {
    const { router } = require('expo-router');
    router.push.mockClear();

    const { UNSAFE_getAllByType } = render(<WelcomeBanner />);
    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);

    // Находим кнопку карты
    const mapButton = pressables.find((p: any) => {
      const children = p.props.children;
      if (Array.isArray(children)) {
        return children.some((child: any) =>
          child?.props?.children === 'На карте'
        );
      }
      return false;
    });

    if (mapButton) {
      fireEvent.press(mapButton);
      expect(router.push).toHaveBeenCalledWith('/map');
    }
  });

  it('should render icons for buttons', () => {
    const { getByTestId } = render(<WelcomeBanner />);
    expect(getByTestId('feather-plus')).toBeTruthy();
    expect(getByTestId('feather-map')).toBeTruthy();
  });

  it('should render LinearGradient in full mode', () => {
    const { getByTestId } = render(<WelcomeBanner />);
    expect(getByTestId('linear-gradient')).toBeTruthy();
  });

  it('should not render LinearGradient in compact mode', () => {
    const { queryByTestId } = render(<WelcomeBanner compact={true} />);
    expect(queryByTestId('linear-gradient')).toBeNull();
  });
});

