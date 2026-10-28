import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { showToastMessage } from '@/utils/toast';

jest.mock('@/utils/toast', () => ({
  showToastMessage: jest.fn().mockResolvedValue(undefined),
}));

let mockResponsiveState = {
  isHydrated: true,
  isMobile: false,
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
    jest.clearAllMocks();
    mockResponsiveState = {
      isHydrated: true,
      isMobile: false,
    };
  });

  it('announces progress status and exposes errors without relying only on color', async () => {
    const { getByTestId, getByText } = await render(
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

  it('keeps autosave status in a polite live region', async () => {
    const { getByTestId } = await render(
      <TravelWizardHeader
        title="Маршрут"
        subtitle="Шаг 2 из 6"
        progressPercent={34}
        autosaveBadge="Есть несохранённые изменения"
      />
    );

    const status = getByTestId('travel-autosave-status');
    expect(status.props.accessibilityLiveRegion).toBe('polite');
    expect(status.props.role).toBe('status');
    expect(status.props['aria-live']).toBe('polite');
    expect(status.props.children).toBe('Есть несохранённые изменения');
  });

  it('keeps the mobile save button at a 44px touch target', async () => {
    mockResponsiveState = {
      isHydrated: true,
      isMobile: true,
    };

    const { getByTestId } = await render(
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

  it('lets mobile users jump directly to another wizard step from the step selector', async () => {
    mockResponsiveState = {
      isHydrated: true,
      isMobile: true,
    };
    const onStepSelect = jest.fn();

    const { getByTestId, getByLabelText, queryByLabelText, container: _hostContainer } = await render(
      <TravelWizardHeader
        title="Основная информация"
        subtitle="Название и описание путешествия"
        progressPercent={17}
        currentStep={1}
        totalSteps={6}
        onStepSelect={onStepSelect}
      />
    );

    await fireEvent.press(getByTestId('travel-wizard-step-select'));

    const stepFive = getByLabelText('Перейти к шагу 5: дополнительные параметры');
    expect(stepFive).toBeTruthy();

    const modalHosts = _hostContainer.queryAll(node => typeof node.props.onRequestClose === 'function');
    expect(modalHosts).toHaveLength(1);
    const openModal = modalHosts[0];
    expect(openModal).toBeTruthy();
    await fireEvent(openModal, 'requestClose');
    expect(queryByLabelText('Перейти к шагу 5: дополнительные параметры')).toBeNull();

    await fireEvent.press(getByTestId('travel-wizard-step-select'));

    await fireEvent.press(getByLabelText('Перейти к шагу 5: дополнительные параметры'));

    // На iOS пункт листа выполняется после закрытия листа (onDismiss / таймер, #2115).
    await waitFor(() => expect(onStepSelect).toHaveBeenCalledTimes(1));
    expect(onStepSelect).toHaveBeenCalledWith(5);
    expect(queryByLabelText('Перейти к шагу 5: дополнительные параметры')).toBeNull();
  });

  it('exposes a visible Save button in the toolbar (no menu needed) that calls onSave', async () => {
    const onSave = jest.fn();
    const { getByTestId, getByText, queryByTestId } = await render(
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

    await fireEvent.press(getByTestId('travel-wizard-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('marks the current milestone as selected and completed milestones with a check', async () => {
    const { getByLabelText } = await render(
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
    expect(within(completedStep).getByTestId('feather-check')).toBeTruthy();
    expect(currentStep.props.accessibilityState).toEqual({ selected: true, disabled: false });
  });

  it('shows an in-progress save state and blocks duplicate save presses', async () => {
    const onSave = jest.fn();
    const { getByTestId, getByText } = await render(
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

    await fireEvent.press(saveButton);
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([false, true])('consumes an already-reported save rejection and permits retry (mobile: %s)', async (isMobile) => {
    mockResponsiveState = { isHydrated: true, isMobile };
    const error = Object.assign(new Error('Controlled save failure'), { toastShown: true });
    let rejectedSave!: Promise<unknown>;
    const onSave = jest.fn()
      .mockImplementationOnce(() => { rejectedSave = Promise.reject(error); return rejectedSave; })
      .mockResolvedValueOnce({ id: 844, publication_status: 'pending_review' });
    const screen = await render(<TravelWizardHeader title="Маршрут" subtitle="Шаг 1 из 6"
      progressPercent={17} onSave={onSave} autosaveBadge="Есть несохранённые изменения" />);

    await act(async () => {
      await expect(fireEvent.press(screen.getByTestId('travel-wizard-save'))).resolves.toBeUndefined();
    });
    // Only the Pressable event is handled. Programmatic/command callers retain the rejection.
    await expect(rejectedSave).rejects.toBe(error);
    expect(onSave).toHaveBeenNthCalledWith(1);
    expect(showToastMessage).not.toHaveBeenCalled();
    expect(screen.getByTestId('travel-autosave-status').props.children).toBe('Есть несохранённые изменения');

    await act(async () => {
      await expect(fireEvent.press(screen.getByTestId('travel-wizard-save'))).resolves.toBeUndefined();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenNthCalledWith(2);
    expect(showToastMessage).not.toHaveBeenCalled();
  });

  it.each(['sync', 'async'] as const)('reports an otherwise unreported %s save failure at the event boundary', async (failureType) => {
    const error = new Error('Unexpected save failure');
    const onSave = jest.fn(() => {
      if (failureType === 'sync') throw error;
      return Promise.reject(error);
    });
    const screen = await render(<TravelWizardHeader title="Маршрут" subtitle="Шаг 1 из 6"
      progressPercent={17} onSave={onSave} />);

    await act(async () => {
      await expect(fireEvent.press(screen.getByTestId('travel-wizard-save'))).resolves.toBeUndefined();
    });
    expect(showToastMessage).toHaveBeenCalledTimes(1);
    expect(showToastMessage).toHaveBeenCalledWith({
      type: 'error', text1: 'Ошибка сохранения', text2: 'Unexpected save failure',
    });
  });

});
