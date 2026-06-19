// __tests__/components/export/ThemePreview.premium.test.tsx
// Paywall/lock-поведение премиум-тем (#296)

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ThemePreview from '@/components/export/ThemePreview';
import type { PdfThemeName } from '@/components/export/ThemePreview';

const mockRequireUnlock = jest.fn();
const mockTrackPaywallView = jest.fn();
let mockIsPremium = true;

jest.mock('@/hooks/usePdfPremium', () => ({
  usePdfPremium: () => ({
    isPremium: mockIsPremium,
    requireUnlock: mockRequireUnlock,
    trackPaywallView: mockTrackPaywallView,
  }),
}));

jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

describe('ThemePreview paywall (#296)', () => {
  const onThemeSelect = jest.fn();
  const baseProps = {
    selectedTheme: 'minimal' as PdfThemeName,
    onThemeSelect,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPremium = true;
  });

  describe('forced free user', () => {
    beforeEach(() => {
      mockIsPremium = false;
    });

    it('shows a lock on premium themes', () => {
      const { getAllByText } = render(<ThemePreview {...baseProps} />);
      // 12 премиум-тем → 12 замков
      expect(getAllByText('lock').length).toBeGreaterThan(0);
    });

    it('does not select a locked premium theme, opens paywall + tracks view', () => {
      const { getByText } = render(<ThemePreview {...baseProps} />);

      const oceanCard = getByText('Океан');
      fireEvent.press(oceanCard.parent!.parent!);

      expect(onThemeSelect).not.toHaveBeenCalled();
      expect(mockTrackPaywallView).toHaveBeenCalledWith('ocean');
      expect(getByText('Премиум-шаблон')).toBeTruthy();
    });

    it('free themes are still selectable', () => {
      const { getByText } = render(<ThemePreview {...baseProps} />);

      const minimalCard = getByText('Минимал');
      fireEvent.press(minimalCard.parent!.parent!);

      expect(onThemeSelect).toHaveBeenCalledWith('minimal');
      expect(mockTrackPaywallView).not.toHaveBeenCalled();
    });

    it('paywall CTA calls requireUnlock with the theme', () => {
      const { getByText } = render(<ThemePreview {...baseProps} />);

      fireEvent.press(getByText('Океан').parent!.parent!);
      fireEvent.press(getByText('Открыть премиум'));

      expect(mockRequireUnlock).toHaveBeenCalledWith('ocean');
    });
  });

  describe('premium user', () => {
    it('shows no locks', () => {
      const { queryAllByText } = render(<ThemePreview {...baseProps} />);
      expect(queryAllByText('lock')).toHaveLength(0);
    });

    it('renders the new premium themes in the catalog (#295)', () => {
      const { getByText } = render(<ThemePreview {...baseProps} />);
      expect(getByText('Люкс-журнал')).toBeTruthy();
      expect(getByText('Акварель')).toBeTruthy();
    });

    it.each(['editorial-luxe', 'watercolor'] as const)(
      'selects new premium theme %s without paywall',
      (themeId) => {
        const label = themeId === 'editorial-luxe' ? 'Люкс-журнал' : 'Акварель';
        const { getByText } = render(<ThemePreview {...baseProps} />);
        fireEvent.press(getByText(label).parent!.parent!);
        expect(onThemeSelect).toHaveBeenCalledWith(themeId);
        expect(mockTrackPaywallView).not.toHaveBeenCalled();
      },
    );

    it('selects premium themes directly without paywall', () => {
      const { getByText } = render(<ThemePreview {...baseProps} />);

      fireEvent.press(getByText('Океан').parent!.parent!);

      expect(onThemeSelect).toHaveBeenCalledWith('ocean');
      expect(mockTrackPaywallView).not.toHaveBeenCalled();
    });
  });
});
