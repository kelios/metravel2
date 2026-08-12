import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import TripsPageSeo, { buildTripsPageTitle } from '@/components/trips/TripsPageSeo';

const mockUseIsFocused = jest.fn(() => true);

jest.mock('expo-router', () => ({
  useIsFocused: () => mockUseIsFocused(),
}));

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: () => null,
}));

const originalOS = Platform.OS;

describe('TripsPageSeo', () => {
  beforeEach(() => {
    mockUseIsFocused.mockReturnValue(true);
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
    document.head.innerHTML = '<title>Загружаем квест…</title>';
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  });

  it('replaces a title inherited from another route', () => {
    render(
      <TripsPageSeo
        canonicalPath="/trips/plan/31"
        fallbackTitle="plan"
        label="test"
      />,
    );

    expect(document.title).toBe('test | Metravel');
    expect(document.head.querySelectorAll('title')).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://metravel.by/trips/plan/31',
    );
  });

  it('uses the brand alone for an empty label', () => {
    expect(buildTripsPageTitle('   ')).toBe('Metravel');
  });

  it('does not compete for the title while its route is unfocused', () => {
    mockUseIsFocused.mockReturnValue(false);

    render(
      <TripsPageSeo
        canonicalPath="/trips/plan/31"
        fallbackTitle="plan"
        label="test"
      />,
    );

    expect(document.title).toBe('Загружаем квест…');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
