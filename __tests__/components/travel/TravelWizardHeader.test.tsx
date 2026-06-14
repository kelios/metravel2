import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';

let mockResponsiveState = {
  isPhone: false,
  isLargePhone: false,
};

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#7a9d8f',
    success: '#527d66',
    danger: '#9a6363',
    dangerSoft: 'rgba(154, 99, 99, 0.08)',
    surface: '#ffffff',
    surfaceMuted: '#f4f1eb',
    text: '#3a3a3a',
    textMuted: '#6a6a6a',
    textOnPrimary: '#ffffff',
    primaryText: '#4f7768',
    primarySoft: 'rgba(122, 157, 143, 0.06)',
    primaryAlpha40: 'rgba(122, 157, 143, 0.4)',
    border: 'rgba(58, 58, 58, 0.08)',
  }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsiveState,
}));

describe('TravelWizardHeader', () => {
  beforeEach(() => {
    mockResponsiveState = {
      isPhone: false,
      isLargePhone: false,
    };
  });

  it('announces progress status and exposes errors without relying only on color', () => {
    const { getByTestId, getByText } = render(
      <TravelWizardHeader
        title="Маршрут"
        subtitle="Шаг 2 из 6"
        progressPercent={34}
        currentStep={2}
        totalSteps={6}
        errorCount={2}
      />
    );

    const progress = getByTestId('travel-wizard-progress');
    expect(progress.props.accessibilityRole).toBe('progressbar');
    expect(progress.props.accessibilityLabel).toBe('Шаг 2 из 6: 2 ошибки, 34%');
    expect(progress.props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 34,
      text: 'Шаг 2 из 6: 2 ошибки, 34%',
    });
    expect(getByText('Ошибки: 2')).toBeTruthy();
  });

  it('keeps the mobile more menu trigger at a 44px touch target', () => {
    mockResponsiveState = {
      isPhone: true,
      isLargePhone: false,
    };

    const { getByTestId } = render(
      <TravelWizardHeader
        title="Маршрут"
        subtitle="Шаг 2 из 6"
        progressPercent={34}
        currentStep={2}
        totalSteps={6}
        onSave={jest.fn()}
      />
    );

    const moreButton = getByTestId('travel-wizard-more');
    const styleValue =
      typeof moreButton.props.style === 'function'
        ? moreButton.props.style({ pressed: false, hovered: false, focused: false })
        : moreButton.props.style;
    const flattened = StyleSheet.flatten(styleValue);

    expect(flattened.width).toBeGreaterThanOrEqual(44);
    expect(flattened.height).toBeGreaterThanOrEqual(44);
    expect(flattened.minWidth).toBeGreaterThanOrEqual(44);
    expect(flattened.minHeight).toBeGreaterThanOrEqual(44);
  });
});
