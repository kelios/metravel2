import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import GallerySection from '@/components/travel/GallerySection';

jest.mock('@/components/travel/ImageGalleryComponent', () => jest.requireActual('@/components/travel/ImageGalleryComponent.ios'));

const originalOS = Platform.OS;
afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS }));

it.each(['ios', 'android'])('%s: the real native gallery owns a single empty-state message', (os) => {
  Object.defineProperty(Platform, 'OS', { value: os });
  const screen = render(<GallerySection images={[]} travelId={42} />);
  expect(screen.getAllByText('Нет загруженных изображений')).toHaveLength(1);
});
