import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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

  it('keeps the mobile save button at a 44px touch target', () => {
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

    const saveButton = getByTestId('travel-wizard-save');
    const styleValue =
      typeof saveButton.props.style === 'function'
        ? saveButton.props.style({ pressed: false, hovered: false, focused: false })
        : saveButton.props.style;
    const flattened = StyleSheet.flatten(styleValue);

    expect(flattened.width).toBeGreaterThanOrEqual(44);
    expect(flattened.height).toBeGreaterThanOrEqual(44);
    expect(flattened.minWidth).toBeGreaterThanOrEqual(44);
    expect(flattened.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('lets mobile users jump directly to another wizard step from the step selector', () => {
    mockResponsiveState = {
      isPhone: true,
      isLargePhone: false,
    };
    const onStepSelect = jest.fn();

    const { getByTestId, getByText, queryByTestId } = render(
      <TravelWizardHeader
        title="Основная информация"
        subtitle="Название и описание путешествия"
        progressPercent={17}
        currentStep={1}
        totalSteps={6}
        onStepSelect={onStepSelect}
      />
    );

    fireEvent.press(getByTestId('travel-wizard-step-select'));

    expect(getByTestId('travel-wizard-step-select-menu')).toBeTruthy();
    expect(getByText('Шаг 5 из 6')).toBeTruthy();
    expect(getByText('дополнительные параметры')).toBeTruthy();

    fireEvent.press(getByTestId('travel-wizard-step-select-option-5'));

    expect(onStepSelect).toHaveBeenCalledTimes(1);
    expect(onStepSelect).toHaveBeenCalledWith(5);
    expect(queryByTestId('travel-wizard-step-select-menu')).toBeNull();
  });

  it('exposes a visible Save button in the toolbar (no menu needed) that calls onSave', () => {
    const onSave = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <TravelWizardHeader
        title="Маршрут"
        subtitle="Шаг 2 из 6"
        progressPercent={34}
        currentStep={2}
        totalSteps={6}
        onSave={onSave}
      />
    );

    // visible toolbar button with the label, not hidden behind the kebab menu
    expect(getByText('Сохранить')).toBeTruthy();
    // with only onSave there is no overflow menu to open
    expect(queryByTestId('travel-wizard-more')).toBeNull();

    fireEvent.press(getByTestId('travel-wizard-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('marks the current milestone as selected and completed milestones with a check', () => {
    const { getByLabelText } = render(
      <TravelWizardHeader
        title="Медиа"
        subtitle="Шаг 3 из 6"
        progressPercent={50}
        currentStep={3}
        totalSteps={6}
        onStepSelect={jest.fn()}
      />
    );

    const completedStep = getByLabelText(/Перейти к шагу 1/);
    const currentStep = getByLabelText(/Перейти к шагу 3/);

    expect(completedStep.props.accessibilityState).toEqual({ selected: false, disabled: false });
    expect(completedStep.findByType(Feather).props.name).toBe('check');
    expect(currentStep.props.accessibilityState).toEqual({ selected: true, disabled: false });
  });

  it('shows an in-progress save state and blocks duplicate save presses', () => {
    const onSave = jest.fn();
    const { getByTestId, getByText } = render(
      <TravelWizardHeader
        title="Маршрут"
        subtitle="Шаг 2 из 6"
        progressPercent={34}
        currentStep={2}
        totalSteps={6}
        onSave={onSave}
        isSaveInFlight
      />
    );

    expect(getByText('Сохраняем...')).toBeTruthy();
    expect(getByText('Сохраняем изменения...')).toBeTruthy();

    const saveButton = getByTestId('travel-wizard-save');
    expect(saveButton.props.accessibilityLabel).toBe('Сохраняем изменения');
    expect(saveButton.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });

    fireEvent.press(saveButton);
    expect(onSave).not.toHaveBeenCalled();
  });
});
