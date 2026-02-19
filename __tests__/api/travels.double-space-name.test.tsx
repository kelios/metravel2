/**
 * @jest-environment jsdom
 *
 * Regression test for the "travel page doesn't open when title has double spaces" issue.
 *
 * Root cause:
 * - Titles with multiple consecutive spaces (e.g., "Модынь  - одна") caused rendering issues.
 * - The fix normalizes multiple spaces to a single space in normalizeTravelItem().
 *
 * This test ensures:
 * 1. normalizeTravelItem() collapses double spaces in the name field
 * 2. The travel page renders correctly with the normalized title
 */

import React from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import { normalizeTravelItem } from '@/api/travelsApi';
import { useTravelDetails } from '@/hooks/useTravelDetails';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/api/travelsApi', () => {
  const actual = jest.requireActual('@/api/travelsApi');
  return {
    ...actual,
    fetchTravel: jest.fn(),
    fetchTravelBySlug: jest.fn(),
  };
});

const useLocalSearchParams = jest.requireMock('expo-router').useLocalSearchParams as jest.Mock;
const { fetchTravel, fetchTravelBySlug } = jest.requireMock('@/api/travelsApi') as {
  fetchTravel: jest.Mock;
  fetchTravelBySlug: jest.Mock;
};

// Test data with double spaces in the name
const TRAVEL_WITH_DOUBLE_SPACES = {
  id: 2676,
  name: 'Модынь  - одна из самых высоких вершин Бескидов (1029)',
  url: '/travels/modyn-odna-iz-samykh-vysokikh-vershin-beskidov-1029',
  slug: 'modyn-odna-iz-samykh-vysokikh-vershin-beskidov-1029',
  description: '<p>Test description</p>',
  year: '2026',
  publish: true,
  moderation: true,
  userIds: [1],
  gallery: [],
  travel_image_thumb_url: 'https://metravel.by/travel-image/2676/test.webp',
};

// Test data with triple spaces
const TRAVEL_WITH_TRIPLE_SPACES = {
  id: 2677,
  name: 'Тест   с   тремя   пробелами',
  url: '/travels/test-s-tremya-probelami',
  slug: 'test-s-tremya-probelami',
  description: '<p>Test</p>',
  publish: true,
  moderation: true,
  userIds: [1],
  gallery: [],
};

const setPlatformOs = (os: string) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

describe('Travel with double spaces in name', () => {
  const originalPlatformOS = Platform.OS;
  const originalPreload = (window as any).__metravelTravelPreload;

  beforeEach(() => {
    jest.clearAllMocks();
    (window as any).__metravelTravelPreload = undefined;
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, configurable: true });
    (window as any).__metravelTravelPreload = originalPreload;
  });

  describe('normalizeTravelItem', () => {
    it('collapses double spaces in name to single space', () => {
      const normalized = normalizeTravelItem(TRAVEL_WITH_DOUBLE_SPACES);

      expect(normalized.name).toBe('Модынь - одна из самых высоких вершин Бескидов (1029)');
      expect(normalized.name).not.toContain('  ');
    });

    it('collapses triple spaces in name to single space', () => {
      const normalized = normalizeTravelItem(TRAVEL_WITH_TRIPLE_SPACES);

      expect(normalized.name).toBe('Тест с тремя пробелами');
      expect(normalized.name).not.toContain('  ');
      expect(normalized.name).not.toContain('   ');
    });

    it('trims leading and trailing spaces', () => {
      const travelWithLeadingTrailingSpaces = {
        ...TRAVEL_WITH_DOUBLE_SPACES,
        name: '  Название с пробелами в начале и конце  ',
      };

      const normalized = normalizeTravelItem(travelWithLeadingTrailingSpaces);

      expect(normalized.name).toBe('Название с пробелами в начале и конце');
      expect(normalized.name).not.toMatch(/^\s/);
      expect(normalized.name).not.toMatch(/\s$/);
    });

    it('handles mixed multiple spaces throughout the name', () => {
      const travelWithMixedSpaces = {
        ...TRAVEL_WITH_DOUBLE_SPACES,
        name: 'Первое  слово   второе    третье',
      };

      const normalized = normalizeTravelItem(travelWithMixedSpaces);

      expect(normalized.name).toBe('Первое слово второе третье');
    });

    it('preserves single spaces', () => {
      const travelWithSingleSpaces = {
        ...TRAVEL_WITH_DOUBLE_SPACES,
        name: 'Модынь - одна из самых высоких вершин Бескидов',
      };

      const normalized = normalizeTravelItem(travelWithSingleSpaces);

      expect(normalized.name).toBe('Модынь - одна из самых высоких вершин Бескидов');
    });

    it('handles empty name', () => {
      const travelWithEmptyName = {
        ...TRAVEL_WITH_DOUBLE_SPACES,
        name: '',
      };

      const normalized = normalizeTravelItem(travelWithEmptyName);

      expect(normalized.name).toBe('');
    });

    it('handles name with only spaces', () => {
      const travelWithOnlySpaces = {
        ...TRAVEL_WITH_DOUBLE_SPACES,
        name: '     ',
      };

      const normalized = normalizeTravelItem(travelWithOnlySpaces);

      expect(normalized.name).toBe('');
    });
  });

  describe('useTravelDetails hook with double-space name', () => {
    it('fetches and normalizes travel with double spaces in name', async () => {
      setPlatformOs('web');
      useLocalSearchParams.mockReturnValue({ param: '2676' });

      // Mock fetchTravel to return travel with double spaces
      const { normalizeTravelItem: realNormalize } = jest.requireActual('@/api/travelsApi');
      fetchTravel.mockResolvedValue(realNormalize(TRAVEL_WITH_DOUBLE_SPACES));

      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTravelDetails(), { wrapper });

      await waitFor(() => {
        expect(result.current.travel?.id).toBe(2676);
      });

      // Verify the name is normalized (no double spaces)
      expect(result.current.travel?.name).toBe('Модынь - одна из самых высоких вершин Бескидов (1029)');
      expect(result.current.travel?.name).not.toContain('  ');
      expect(result.current.isError).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('fetches travel by slug with double spaces in name', async () => {
      setPlatformOs('web');
      useLocalSearchParams.mockReturnValue({ param: 'modyn-odna-iz-samykh-vysokikh-vershin-beskidov-1029' });

      const { normalizeTravelItem: realNormalize } = jest.requireActual('@/api/travelsApi');
      fetchTravelBySlug.mockResolvedValue(realNormalize(TRAVEL_WITH_DOUBLE_SPACES));

      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTravelDetails(), { wrapper });

      await waitFor(() => {
        expect(result.current.travel?.id).toBe(2676);
      });

      // Verify the name is normalized
      expect(result.current.travel?.name).toBe('Модынь - одна из самых высоких вершин Бескидов (1029)');
      expect(result.current.travel?.name).not.toContain('  ');
    });

    it('uses preloaded travel with double spaces and normalizes name', async () => {
      setPlatformOs('web');
      useLocalSearchParams.mockReturnValue({ param: TRAVEL_WITH_DOUBLE_SPACES.slug });

      const { normalizeTravelItem: realNormalize } = jest.requireActual('@/api/travelsApi');

      // Set up preloaded data with double spaces
      (window as any).__metravelTravelPreload = {
        data: realNormalize(TRAVEL_WITH_DOUBLE_SPACES),
        slug: TRAVEL_WITH_DOUBLE_SPACES.slug,
        isId: false,
      };

      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTravelDetails(), { wrapper });

      await waitFor(() => {
        expect(result.current.travel?.id).toBe(2676);
      });

      // Verify the name is normalized from preload
      expect(result.current.travel?.name).toBe('Модынь - одна из самых высоких вершин Бескидов (1029)');
      expect(result.current.travel?.name).not.toContain('  ');

      // Preload should be consumed
      expect((window as any).__metravelTravelPreload).toBeUndefined();

      // No fetch should have been called since we used preload
      expect(fetchTravel).not.toHaveBeenCalled();
      expect(fetchTravelBySlug).not.toHaveBeenCalled();
    });
  });
});
