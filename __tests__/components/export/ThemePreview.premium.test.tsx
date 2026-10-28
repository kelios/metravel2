// __tests__/components/export/ThemePreview.premium.test.tsx
// Paywall/lock-поведение премиум-тем (#296)

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ThemePreview, { THEME_CATALOG } from '@/components/export/ThemePreview';
import type { PdfThemeName } from '@/components/export/ThemePreview';

import { PDF_THEMES } from '@/services/pdf-export/themes/PdfThemeConfig';

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

  it('covers every registered theme exactly once (#1821)', () => {
    const ids = Object.values(THEME_CATALOG).map((theme) => theme.id);
    expect(ids.sort()).toEqual(Object.keys(PDF_THEMES).sort());
    for (const [id, theme] of Object.entries(THEME_CATALOG)) {
      expect(theme.id).toBe(id);
    }
  });

  it.each([true, false])('preserves illustrated access for premium=%s (#1821)', async (premium) => {
    mockIsPremium = premium;
    const { getByText } = await render(<ThemePreview {...baseProps} />);
    await fireEvent.press(getByText(PDF_THEMES.illustrated.displayName));
    if (premium) {
      expect(onThemeSelect).toHaveBeenCalledWith('illustrated');
      expect(mockTrackPaywallView).not.toHaveBeenCalled();
    } else {
      expect(onThemeSelect).not.toHaveBeenCalled();
      expect(mockTrackPaywallView).toHaveBeenCalledWith('illustrated');
      expect(getByText('Премиум-шаблон')).toBeTruthy();
    }
  });

  describe('forced free user', () => {
    beforeEach(() => {
      mockIsPremium = false;
    });

    it('shows a lock on premium themes', async () => {
      const { getAllByText } = await render(<ThemePreview {...baseProps} />);
      // 12 премиум-тем → 12 замков
      expect(getAllByText('lock').length).toBeGreaterThan(0);
    });

    it('does not select a locked premium theme, opens paywall + tracks view', async () => {
      const { getByText } = await render(<ThemePreview {...baseProps} />);

      const oceanCard = getByText('Океан');
      await fireEvent.press(oceanCard.parent!.parent!);

      expect(onThemeSelect).not.toHaveBeenCalled();
      expect(mockTrackPaywallView).toHaveBeenCalledWith('ocean');
      expect(getByText('Премиум-шаблон')).toBeTruthy();
    });

    it('free themes are still selectable', async () => {
      const { getByText } = await render(<ThemePreview {...baseProps} />);

      const minimalCard = getByText('Минимал');
      await fireEvent.press(minimalCard.parent!.parent!);

      expect(onThemeSelect).toHaveBeenCalledWith('minimal');
      expect(mockTrackPaywallView).not.toHaveBeenCalled();
    });

    it('paywall CTA calls requireUnlock with the theme', async () => {
      const { getByText } = await render(<ThemePreview {...baseProps} />);

      await fireEvent.press(getByText('Океан').parent!.parent!);
      await fireEvent.press(getByText('Открыть премиум'));

      expect(mockRequireUnlock).toHaveBeenCalledWith('ocean');
    });

    it('keeps premium actions outside the accessible backdrop (#2434)', async () => {
      const { getByText, getByTestId, getByRole, queryByTestId } = await render(<ThemePreview {...baseProps} />);
      await fireEvent.press(getByText('Океан'));
      const panel = getByTestId('theme-paywall-panel');
      const backdrop = getByTestId('theme-paywall-backdrop');
      for (let ancestor = panel.parent; ancestor; ancestor = ancestor.parent) {
        expect(ancestor.props.onPress).toBeUndefined();
      }
      expect(backdrop.queryAll(node => node.props.accessibilityRole === 'button' || typeof node.props.onPress === 'function')).toHaveLength(0);
      expect(getByRole('button', { name: 'Открыть премиум' })).toBeTruthy();
      await fireEvent.press(panel);
      expect(getByTestId('theme-paywall-panel')).toBeTruthy();
      await fireEvent.press(backdrop);
      expect(queryByTestId('theme-paywall-panel')).toBeNull();
      expect(mockRequireUnlock).not.toHaveBeenCalled();
    });
  });

  describe('premium user', () => {
    it('shows no locks', async () => {
      const { queryAllByText } = await render(<ThemePreview {...baseProps} />);
      expect(queryAllByText('lock')).toHaveLength(0);
    });

    it('renders the new premium themes in the catalog (#295)', async () => {
      const { getByText } = await render(<ThemePreview {...baseProps} />);
      expect(getByText('Люкс-журнал')).toBeTruthy();
      expect(getByText('Акварель')).toBeTruthy();
    });

    it.each(['editorial-luxe', 'watercolor'] as const)(
      'selects new premium theme %s without paywall',
      async (themeId) => {
        const label = themeId === 'editorial-luxe' ? 'Люкс-журнал' : 'Акварель';
        const { getByText } = await render(<ThemePreview {...baseProps} />);
        await fireEvent.press(getByText(label).parent!.parent!);
        expect(onThemeSelect).toHaveBeenCalledWith(themeId);
        expect(mockTrackPaywallView).not.toHaveBeenCalled();
      },
    );

    it('selects premium themes directly without paywall', async () => {
      const { getByText } = await render(<ThemePreview {...baseProps} />);

      await fireEvent.press(getByText('Океан').parent!.parent!);

      expect(onThemeSelect).toHaveBeenCalledWith('ocean');
      expect(mockTrackPaywallView).not.toHaveBeenCalled();
    });
  });
});
