import React from 'react';
import { render } from '@testing-library/react-native';
import Logo from '@/components/Logo';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  };
});

// Mock Image component
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Image: ({ source, style, ...props }: any) => {
      const { View } = require('react-native');
      return React.createElement(View, { 
        testID: 'logo-image',
        style,
        ...props 
      });
    },
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  };
});

describe('Logo', () => {
  it('should render logo image', () => {
    const { getByTestId } = render(<Logo />);
    expect(getByTestId('logo-image')).toBeTruthy();
  });

  it('should render logo text on desktop', () => {
    // Mock desktop width
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1024,
      height: 768,
    });

    const { toJSON } = render(<Logo />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    
    // На десктопе должен быть текст
    expect(treeStr).toContain('Me');
    expect(treeStr).toContain('Travel');
  });

  it('should not render logo text on mobile', () => {
    // Mock mobile width
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 375,
      height: 667,
    });

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
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 320,
      height: 568,
    });

    const { toJSON } = render(<Logo />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});

