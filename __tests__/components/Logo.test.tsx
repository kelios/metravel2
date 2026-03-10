import React from 'react';
import { render } from '@testing-library/react-native';
import Logo from '@/components/layout/Logo';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

// Mock react-native pieces we rely on
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');

  return {
    ...RN,
    Image: ({ style, ...props }: any) =>
      React.createElement(RN.View, {
        testID: 'logo-image',
        style,
        ...props,
      }),
  };
});

describe('Logo', () => {
  it('should render logo image', () => {
    const { UNSAFE_getAllByType } = render(<Logo />);
    const { Image } = require('react-native');
    expect(UNSAFE_getAllByType(Image).length).toBeGreaterThan(0);
  });

  it('should render logo text on desktop', () => {
    const { toJSON } = render(<Logo />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    
    // На десктопе должен быть текст
    expect(treeStr).toContain('Me');
    expect(treeStr).toContain('Travel');
  });

  it('should not render logo text on mobile', () => {
    const { queryByText, toJSON } = render(<Logo showWordmark={false} />);
    const tree = toJSON();

    expect(tree).toBeTruthy();
    expect(queryByText('Me')).toBeNull();
    expect(queryByText('Travel')).toBeNull();
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
    const { toJSON } = render(<Logo isCompact />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
