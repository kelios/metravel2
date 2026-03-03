// __tests__/components/travel/FullscreenGallery.test.tsx
// AND-28: Tests for FullscreenGallery component

import React from 'react';
import { render } from '@testing-library/react-native';

// Mock expo-image
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: any) => React.createElement(View, { testID: 'expo-image', ...props }),
  };
});

// Mock expo-navigation-bar
jest.mock('expo-navigation-bar', () => ({
  setVisibilityAsync: jest.fn(),
}), { virtual: true });

import FullscreenGallery from '@/components/travel/FullscreenGallery';

const mockImages = [
  { url: 'https://example.com/1.jpg' },
  { url: 'https://example.com/2.jpg' },
  { url: 'https://example.com/3.jpg' },
];

describe('FullscreenGallery', () => {
  it('renders when visible is true', () => {
    const { getByText } = render(
      <FullscreenGallery
        visible={true}
        images={mockImages}
        initialIndex={0}
        onClose={jest.fn()}
      />
    );
    // Counter should show
    expect(getByText('1 / 3')).toBeTruthy();
  });

  it('renders close button with accessibility label', () => {
    const { getByLabelText } = render(
      <FullscreenGallery
        visible={true}
        images={mockImages}
        initialIndex={0}
        onClose={jest.fn()}
      />
    );
    expect(getByLabelText('Закрыть галерею')).toBeTruthy();
  });

  it('does not show counter for single image', () => {
    const { queryByText } = render(
      <FullscreenGallery
        visible={true}
        images={[{ url: 'https://example.com/1.jpg' }]}
        initialIndex={0}
        onClose={jest.fn()}
      />
    );
    expect(queryByText(/\//)).toBeNull();
  });
});

