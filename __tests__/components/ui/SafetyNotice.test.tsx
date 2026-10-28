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
    it('renders the default liability text', async () => {
        const { getByTestId, getByText } = await render(<SafetyNotice />);
        expect(getByTestId('safety-notice')).toBeTruthy();
        // AC: текст «MeTravel не несёт ответственности за личные договорённости»
        expect(getByText(/MeTravel не несёт ответственности за личные договорённости/)).toBeTruthy();
    });

    it('renders custom text when provided', async () => {
        const { getByText, queryByText } = await render(<SafetyNotice text="Особое предупреждение" />);
        expect(getByText('Особое предупреждение')).toBeTruthy();
        expect(queryByText(/MeTravel не несёт ответственности/)).toBeNull();
    });

    it('does not show a dismiss button without storageKey', async () => {
        const { queryByTestId } = await render(<SafetyNotice />);
        expect(queryByTestId('safety-notice-dismiss')).toBeNull();
    });

    it('shows a dismiss button when persisted and hides the notice on dismiss', async () => {
        const { getByTestId, queryByTestId } = await render(
            <SafetyNotice storageKey="test-key" />
        );
        expect(getByTestId('safety-notice')).toBeTruthy();
        const dismiss = getByTestId('safety-notice-dismiss');
        expect(dismiss).toBeTruthy();

        await fireEvent.press(dismiss);

        // После закрытия плашка не рендерится
        expect(queryByTestId('safety-notice')).toBeNull();
    });

    it('can be made dismissible without persistence via dismissible prop', async () => {
        const { getByTestId, queryByTestId } = await render(
            <SafetyNotice dismissible testID="sn" />
        );
        await fireEvent.press(getByTestId('sn-dismiss'));
        expect(queryByTestId('sn')).toBeNull();
    });
});
