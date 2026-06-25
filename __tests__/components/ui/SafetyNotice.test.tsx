import { render, fireEvent } from '@testing-library/react-native';
import SafetyNotice from '@/components/ui/SafetyNotice';

jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        warning: '#7d7250',
        warningLight: '#f5f3f0',
        textSecondary: '#374151',
        textMuted: '#6b7280',
    }),
}));

describe('SafetyNotice', () => {
    it('renders the default liability text', () => {
        const { getByTestId, getByText } = render(<SafetyNotice />);
        expect(getByTestId('safety-notice')).toBeTruthy();
        // AC: текст «MeTravel не несёт ответственности за личные договорённости»
        expect(getByText(/MeTravel не несёт ответственности за личные договорённости/)).toBeTruthy();
    });

    it('renders custom text when provided', () => {
        const { getByText, queryByText } = render(<SafetyNotice text="Особое предупреждение" />);
        expect(getByText('Особое предупреждение')).toBeTruthy();
        expect(queryByText(/MeTravel не несёт ответственности/)).toBeNull();
    });

    it('does not show a dismiss button without storageKey', () => {
        const { queryByTestId } = render(<SafetyNotice />);
        expect(queryByTestId('safety-notice-dismiss')).toBeNull();
    });

    it('shows a dismiss button when persisted and hides the notice on dismiss', () => {
        const { getByTestId, queryByTestId } = render(
            <SafetyNotice storageKey="test-key" />
        );
        expect(getByTestId('safety-notice')).toBeTruthy();
        const dismiss = getByTestId('safety-notice-dismiss');
        expect(dismiss).toBeTruthy();

        fireEvent.press(dismiss);

        // После закрытия плашка не рендерится
        expect(queryByTestId('safety-notice')).toBeNull();
    });

    it('can be made dismissible without persistence via dismissible prop', () => {
        const { getByTestId, queryByTestId } = render(
            <SafetyNotice dismissible testID="sn" />
        );
        fireEvent.press(getByTestId('sn-dismiss'));
        expect(queryByTestId('sn')).toBeNull();
    });
});
