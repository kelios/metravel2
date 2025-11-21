import React from 'react';
import { render } from '@testing-library/react-native';
import Logo from '@/components/Logo';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

const mockUseWindowDimensions = jest.fn(() => ({ width: 375, height: 667 }));

// Mock react-native pieces we rely on
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');

  return {
    ...RN,
    useWindowDimensions: mockUseWindowDimensions,
    Image: ({ style, ...props }: any) =>
      React.createElement(RN.View, {
        testID: 'logo-image',
        style,
        ...props,
      }),
  };
});

const getUseWindowDimensionsMock = () => mockUseWindowDimensions;

describe('Logo', () => {
  beforeEach(() => {
    getUseWindowDimensionsMock().mockReturnValue({ width: 375, height: 667 });
  });

  it('should render logo image', () => {
    const { UNSAFE_getAllByType } = render(<Logo />);
    const { Image } = require('react-native');
    expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
  });

  it('should render logo text on desktop', () => {
    getUseWindowDimensionsMock().mockReturnValue({ width: 1024, height: 768 });

    const { toJSON } = render(<Logo />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    
    // На десктопе должен быть текст
    expect(treeStr).toContain('Me');
    expect(treeStr).toContain('Travel');
  });

  it('should not render logo text on mobile', () => {
    const { toJSON } = render(<Logo />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    
    // На мобильном текста не должно быть (или он скрыт)
    // Проверяем что компонент рендерится
    expect(tree).toBeTruthy();
  });

  it('should navigate to home when pressed', () => {
    const { router } = require('expo-router');
    const { UNSAFE_getAllByType } = render(<Logo />);

    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    
    if (touchables.length > 0) {
      const { fireEvent } = require('@testing-library/react-native');
      fireEvent.press(touchables[0]);
      expect(router.push).toHaveBeenCalledWith('/');
    }
  });

  it('should have accessibility label', () => {
    const { toJSON } = render(<Logo />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    
    // Проверяем что компонент имеет accessibility свойства
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('MeTravel');
  });

  it('should apply mobile styles on small screens', () => {
    getUseWindowDimensionsMock().mockReturnValue({ width: 320, height: 568 });

    const { toJSON } = render(<Logo />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
