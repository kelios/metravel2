// __tests__/components/ui/StarRating.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import StarRating from '@/components/ui/StarRating';

// Mock useThemedColors
jest.mock('@/hooks/useTheme', () => ({
    useThemedColors: () => ({
        text: '#1f2937',
        textMuted: '#6b7280',
        warning: '#f59e0b',
        textOnPrimary: '#ffffff',
    }),
}));

describe('StarRating', () => {
    it('renders correctly with rating', () => {
        const { getByTestId, getByText } = render(
            <StarRating rating={4.5} ratingCount={120} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
        expect(getByTestId('star-rating-value')).toBeTruthy();
        expect(getByText('4.5')).toBeTruthy();
        expect(getByText('(120)')).toBeTruthy();
    });

    it('renders compact mode with single star', () => {
        const { getByTestId, getByText, queryByTestId } = render(
            <StarRating rating={4.2} compact testID="star-rating-compact" />
        );

        expect(getByTestId('star-rating-compact')).toBeTruthy();
        expect(getByText('4.2')).toBeTruthy();
        // Compact mode should not show count by default
        expect(queryByTestId('star-rating-compact-count')).toBeNull();
    });

    it('does not render compact mode when rating is 0', () => {
        const { queryByTestId } = render(
            <StarRating rating={0} compact testID="star-rating-zero" />
        );

        expect(queryByTestId('star-rating-zero')).toBeNull();
    });

    it('does not render compact mode when rating is null', () => {
        const { queryByTestId } = render(
            <StarRating rating={null} compact testID="star-rating-null" />
        );

        expect(queryByTestId('star-rating-null')).toBeNull();
    });

    it('renders all 5 stars in non-compact mode', () => {
        const { getByTestId } = render(
            <StarRating rating={3} testID="star-rating" />
        );

        // Should have 5 star elements
        expect(getByTestId('star-rating-star-1')).toBeTruthy();
        expect(getByTestId('star-rating-star-2')).toBeTruthy();
        expect(getByTestId('star-rating-star-3')).toBeTruthy();
        expect(getByTestId('star-rating-star-4')).toBeTruthy();
        expect(getByTestId('star-rating-star-5')).toBeTruthy();
    });

    it('calls onRate when interactive and star is pressed', () => {
        const onRate = jest.fn();
        const { getByTestId } = render(
            <StarRating
                rating={3}
                interactive
                onRate={onRate}
                testID="star-rating-interactive"
            />
        );

        fireEvent.press(getByTestId('star-rating-interactive-star-4'));
        expect(onRate).toHaveBeenCalledWith(4);
    });

    it('does not call onRate when not interactive', () => {
        const onRate = jest.fn();
        const { getByTestId } = render(
            <StarRating
                rating={3}
                interactive={false}
                onRate={onRate}
                testID="star-rating"
            />
        );

        // Try pressing star - should not trigger onRate since not interactive
        fireEvent.press(getByTestId('star-rating-star-4'));
        expect(onRate).not.toHaveBeenCalled();
    });

    it('shows dash when rating is 0', () => {
        const { getByText } = render(
            <StarRating rating={0} showValue testID="star-rating" />
        );

        expect(getByText('—')).toBeTruthy();
    });

    it('formats rating count correctly', () => {
        const { getByText, rerender } = render(
            <StarRating rating={4} ratingCount={999} showCount testID="star-rating" />
        );
        expect(getByText('(999)')).toBeTruthy();

        rerender(
            <StarRating rating={4} ratingCount={1500} showCount testID="star-rating" />
        );
        expect(getByText('(1.5k)')).toBeTruthy();
    });

    it('hides count when showCount is false', () => {
        const { queryByTestId } = render(
            <StarRating
                rating={4}
                ratingCount={100}
                showCount={false}
                testID="star-rating"
            />
        );

        expect(queryByTestId('star-rating-count')).toBeNull();
    });

    it('hides value when showValue is false', () => {
        const { queryByTestId } = render(
            <StarRating
                rating={4}
                showValue={false}
                testID="star-rating"
            />
        );

        expect(queryByTestId('star-rating-value')).toBeNull();
    });

    it('supports different sizes', () => {
        const { rerender, getByTestId } = render(
            <StarRating rating={4} size="small" testID="star-rating" />
        );
        expect(getByTestId('star-rating')).toBeTruthy();

        rerender(<StarRating rating={4} size="medium" testID="star-rating" />);
        expect(getByTestId('star-rating')).toBeTruthy();

        rerender(<StarRating rating={4} size="large" testID="star-rating" />);
        expect(getByTestId('star-rating')).toBeTruthy();
    });

    it('shows previously set userRating as selected when interactive (integer)', () => {
        const { getByTestId } = render(
            <StarRating
                rating={5}
                userRating={4}
                interactive
                onRate={jest.fn()}
                showValue={false}
                showCount={false}
                testID="star-rating-user"
            />
        );

        const star4 = getByTestId('star-rating-user-star-4');
        const star3 = getByTestId('star-rating-user-star-3');

        expect(star4.props.style).toEqual(
            expect.arrayContaining([expect.objectContaining({ opacity: 1 })])
        );
        expect(star3.props.style).toEqual(
            expect.arrayContaining([expect.not.objectContaining({ opacity: 1 })])
        );
    });

    it('shows previously set userRating as selected when interactive (float like 5.0)', () => {
        const { getByTestId } = render(
            <StarRating
                rating={5}
                userRating={5.0}
                interactive
                onRate={jest.fn()}
                showValue={false}
                showCount={false}
                testID="star-rating-user-float"
            />
        );

        const star5 = getByTestId('star-rating-user-float-star-5');
        expect(star5.props.style).toEqual(
            expect.arrayContaining([expect.objectContaining({ opacity: 1 })])
        );
    });
});

