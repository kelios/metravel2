import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { i18n } from '@/i18n';
import { useTheme } from '@/hooks/useTheme';
import { getSeasonalCalendar } from '@/constants/seasonalThemes';
import SeasonalThemeStatus from '@/components/layout/SeasonalThemeStatus';

jest.mock('@/hooks/useTheme', () => ({
  useTheme: jest.fn(),
  useThemedColors: () => ({ textMuted: '#555555' }),
}));

const install = (date: Date, preference = 'auto') => {
  (useTheme as jest.Mock).mockReturnValue({ seasonalTheme: preference, seasonalCalendar: getSeasonalCalendar(date) });
};

describe('localized automatic seasonal status', () => {
  beforeEach(async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    await i18n.changeLanguage('ru');
  });

  afterEach(async () => { await i18n.changeLanguage('ru'); });

  it('describes the active Christmas range across the year boundary', () => {
    install(new Date(2027, 0, 7, 12));
    const text = render(<SeasonalThemeStatus />).getByTestId('seasonal-theme-status').props.children;
    expect(text).toContain('Сейчас: Рождество и Новый год');
    expect(text).toContain('2026');
    expect(text).toContain('2027');
  });

  it('describes the nearest upcoming window outside a holiday', () => {
    install(new Date(2026, 6, 1, 12));
    const text = render(<SeasonalThemeStatus />).getByTestId('seasonal-theme-status').props.children;
    expect(text).toContain('Обычный вид. Далее: Золотая осень');
    expect(text).toContain('15');
  });

  it('does not imply Easter remains active in the gap between its two windows', () => {
    install(new Date(2024, 3, 10, 12));
    const text = render(<SeasonalThemeStatus />).getByTestId('seasonal-theme-status').props.children;
    expect(text).toContain('Обычный вид. Далее: Пасха');
    expect(text).not.toContain('Сейчас:');
    expect(text).toContain('28');
    expect(text).toContain('7');
  });

  it.each(['off', 'halloween', 'spring'])('hides automatic status for %s', preference => {
    install(new Date(2026, 9, 20, 12), preference);
    expect(render(<SeasonalThemeStatus />).queryByTestId('seasonal-theme-status')).toBeNull();
  });

  it('hides before preferences hydrate and on native', () => {
    (useTheme as jest.Mock).mockReturnValue({ seasonalTheme: 'auto', seasonalCalendar: null });
    const view = render(<SeasonalThemeStatus />);
    expect(view.queryByTestId('seasonal-theme-status')).toBeNull();
    install(new Date(2026, 9, 20, 12));
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    view.rerender(<SeasonalThemeStatus />);
    expect(view.queryByTestId('seasonal-theme-status')).toBeNull();
  });

  it('updates labels and dates when language changes without remounting', async () => {
    install(new Date(2026, 2, 8, 12));
    const view = render(<SeasonalThemeStatus />);
    expect(view.getByTestId('seasonal-theme-status').props.children).toContain('Весна и 8 Марта');
    await act(async () => { await i18n.changeLanguage('pl'); });
    const text = view.getByTestId('seasonal-theme-status').props.children;
    expect(text).toContain('Teraz: Wiosna i 8 marca');
    expect(text).not.toContain('Сейчас:');
  });
});
