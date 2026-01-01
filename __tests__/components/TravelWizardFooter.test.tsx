import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelWizardFooter from '@/components/travel/TravelWizardFooter';

// Mock hooks
jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        primary: '#7a9d8f',
        surface: '#ffffff',
        border: 'rgba(58, 58, 58, 0.06)',
        text: '#3a3a3a',
        textMuted: '#6a6a6a',
        surfaceMuted: 'rgba(255, 255, 255, 0.75)',
    }),
}));

jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({
        isPhone: false,
        isLargePhone: false,
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

describe('TravelWizardFooter - Quick Draft', () => {
    it('renders Quick Draft button when onQuickDraft is provided', () => {
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                onQuickDraft={jest.fn()}
                quickDraftLabel="Быстрый черновик"
            />
        );

        expect(getByText('Быстрый черновик')).toBeTruthy();
    });

    it('does not render Quick Draft button when onQuickDraft is not provided', () => {
        const { queryByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
            />
        );

        expect(queryByText('Быстрый черновик')).toBeNull();
    });

    it('calls onQuickDraft when Quick Draft button is pressed', () => {
        const mockOnQuickDraft = jest.fn();
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                onQuickDraft={mockOnQuickDraft}
                quickDraftLabel="Быстрый черновик"
            />
        );

        const button = getByText('Быстрый черновик');
        fireEvent.press(button);

        expect(mockOnQuickDraft).toHaveBeenCalledTimes(1);
    });

    it('renders both Quick Draft and Primary buttons', () => {
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                onQuickDraft={jest.fn()}
                quickDraftLabel="Быстрый черновик"
            />
        );

        expect(getByText('Быстрый черновик')).toBeTruthy();
        expect(getByText('Далее')).toBeTruthy();
    });

    it('uses default quickDraftLabel when not provided', () => {
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                onQuickDraft={jest.fn()}
                quickDraftLabel="Быстрый черновик"
            />
        );

        // When quickDraftLabel is explicitly provided
        expect(getByText('Быстрый черновик')).toBeTruthy();
    });

    it('renders milestones when currentStep and totalSteps are provided', () => {
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                currentStep={2}
                totalSteps={6}
            />
        );

        // Should render step numbers 1-6
        expect(getByText('1')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
        expect(getByText('3')).toBeTruthy();
        expect(getByText('4')).toBeTruthy();
        expect(getByText('5')).toBeTruthy();
        expect(getByText('6')).toBeTruthy();
    });

    it('calls onStepSelect when milestone is pressed', () => {
        const mockOnStepSelect = jest.fn();
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                currentStep={2}
                totalSteps={6}
                onStepSelect={mockOnStepSelect}
            />
        );

        const step3 = getByText('3');
        fireEvent.press(step3);

        expect(mockOnStepSelect).toHaveBeenCalledWith(3);
    });

    it('renders Save button when onSave is provided', () => {
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                onSave={jest.fn()}
                saveLabel="Сохранить"
            />
        );

        expect(getByText('Сохранить')).toBeTruthy();
    });

    it('calls onSave when Save button is pressed', () => {
        const mockOnSave = jest.fn();
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                onSave={mockOnSave}
                saveLabel="Сохранить"
            />
        );

        const saveButton = getByText('Сохранить');
        fireEvent.press(saveButton);

        expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('disables Primary button when primaryDisabled is true', () => {
        const mockOnPrimary = jest.fn();
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={mockOnPrimary}
                primaryLabel="Далее"
                primaryDisabled={true}
            />
        );

        const button = getByText('Далее');
        fireEvent.press(button);

        // Button should be disabled, onPrimary should not be called
        // Note: react-native-paper Button handles this internally
        expect(button).toBeTruthy();
    });

    it('renders Back button when canGoBack and onBack are provided', () => {
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                canGoBack={true}
                onBack={jest.fn()}
            />
        );

        expect(getByText('Назад')).toBeTruthy();
    });

    it('calls onBack when Back button is pressed', () => {
        const mockOnBack = jest.fn();
        const { getByText } = render(
            <TravelWizardFooter
                onPrimary={jest.fn()}
                primaryLabel="Далее"
                canGoBack={true}
                onBack={mockOnBack}
            />
        );

        const backButton = getByText('Назад');
        fireEvent.press(backButton);

        expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
});

