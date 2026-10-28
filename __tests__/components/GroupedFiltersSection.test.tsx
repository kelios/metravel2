import { render, fireEvent } from '@testing-library/react-native';
import GroupedFiltersSection from '@/components/travel/GroupedFiltersSection';
import { Text } from 'react-native';

// Mock hooks
jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        primary: '#7a9d8f',
        primarySoft: 'rgba(122, 157, 143, 0.06)',
        surface: '#ffffff',
        border: 'rgba(58, 58, 58, 0.06)',
        borderLight: 'rgba(58, 58, 58, 0.03)',
        text: '#3a3a3a',
        textMuted: '#6a6a6a',
        surfaceMuted: 'rgba(255, 255, 255, 0.75)',
    }),
}));

describe('GroupedFiltersSection', () => {
    const mockGroup = {
        id: 'test-group',
        title: 'Test Group',
        iconName: 'sliders' as const,
        description: 'Test description',
        defaultExpanded: false,
    };

    it('renders correctly with collapsed state', async () => {
        const { getByText, queryByText } = await render(
            <GroupedFiltersSection group={mockGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('Test Group')).toBeTruthy();
        expect(queryByText('Child content')).toBeNull();
    });

    it('renders correctly with expanded state', async () => {
        const expandedGroup = { ...mockGroup, defaultExpanded: true };
        const { getByText } = await render(
            <GroupedFiltersSection group={expandedGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('Test Group')).toBeTruthy();
        expect(getByText('Child content')).toBeTruthy();
    });

    it('toggles expansion on press', async () => {
        const { getByLabelText, getByText, queryByText } = await render(
            <GroupedFiltersSection group={mockGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        // Initially collapsed
        expect(queryByText('Child content')).toBeNull();

        // Press to expand
        await fireEvent.press(getByLabelText('Развернуть: Test Group'));

        // Now expanded
        expect(getByText('Child content')).toBeTruthy();

        // Press to collapse
        await fireEvent.press(getByLabelText('Свернуть: Test Group'));

        // Collapsed again
        expect(queryByText('Child content')).toBeNull();
    });

    it('displays progress badge when filledCount and totalCount are provided', async () => {
        const { getByText } = await render(
            <GroupedFiltersSection group={mockGroup} filledCount={2} totalCount={5}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('2/5')).toBeTruthy();
    });

    it('does not display progress badge when counts are missing', async () => {
        const { queryByText } = await render(
            <GroupedFiltersSection group={mockGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(queryByText(/\/\d+/)).toBeNull();
    });

    it('shows description when collapsed', async () => {
        const { getByText } = await render(
            <GroupedFiltersSection group={mockGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('Test description')).toBeTruthy();
    });

    it('shows full description when expanded', async () => {
        const expandedGroup = { ...mockGroup, defaultExpanded: true };
        const { getByText } = await render(
            <GroupedFiltersSection group={expandedGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('Test description')).toBeTruthy();
    });
});
