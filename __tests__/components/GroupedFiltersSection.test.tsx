import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
        iconName: 'star' as const,
        description: 'Test description',
        defaultExpanded: false,
    };

    it('renders correctly with collapsed state', () => {
        const { getByText, queryByText } = render(
            <GroupedFiltersSection group={mockGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('Test Group')).toBeTruthy();
        expect(queryByText('Child content')).toBeNull();
    });

    it('renders correctly with expanded state', () => {
        const expandedGroup = { ...mockGroup, defaultExpanded: true };
        const { getByText } = render(
            <GroupedFiltersSection group={expandedGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('Test Group')).toBeTruthy();
        expect(getByText('Child content')).toBeTruthy();
    });

    it('toggles expansion on press', () => {
        const { getByText, queryByText } = render(
            <GroupedFiltersSection group={mockGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        // Initially collapsed
        expect(queryByText('Child content')).toBeNull();

        // Press to expand
        const header = getByText('Test Group');
        fireEvent.press(header.parent!);

        // Now expanded
        expect(getByText('Child content')).toBeTruthy();

        // Press to collapse
        fireEvent.press(header.parent!);

        // Collapsed again
        expect(queryByText('Child content')).toBeNull();
    });

    it('displays progress badge when filledCount and totalCount are provided', () => {
        const { getByText } = render(
            <GroupedFiltersSection group={mockGroup} filledCount={2} totalCount={5}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('2/5')).toBeTruthy();
    });

    it('does not display progress badge when counts are missing', () => {
        const { queryByText } = render(
            <GroupedFiltersSection group={mockGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(queryByText(/\/\d+/)).toBeNull();
    });

    it('shows description when collapsed', () => {
        const { getByText } = render(
            <GroupedFiltersSection group={mockGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('Test description')).toBeTruthy();
    });

    it('shows full description when expanded', () => {
        const expandedGroup = { ...mockGroup, defaultExpanded: true };
        const { getByText } = render(
            <GroupedFiltersSection group={expandedGroup}>
                <Text>Child content</Text>
            </GroupedFiltersSection>
        );

        expect(getByText('Test description')).toBeTruthy();
    });
});

