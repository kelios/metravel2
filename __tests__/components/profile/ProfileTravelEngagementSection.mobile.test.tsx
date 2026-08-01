import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ProfileTravelEngagementSummary } from '@/components/profile/ProfileTravelEngagementSection';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: true,
    width: 390,
  }),
}));

describe('ProfileTravelEngagementSummary mobile layout', () => {
  it('keeps author stats compact on mobile by hiding helper copy in metric cards', () => {
    const { getByText, queryByText } = render(
      <ProfileTravelEngagementSummary
        summary={{
          favoritesCount: 4,
          wishlistCount: 0,
          visitedCount: 0,
          plannedCount: 0,
        }}
        travelsCount={289}
      />,
    );

    expect(getByText('Что делают пользователи с вашими маршрутами')).toBeTruthy();
    expect(getByText('Сохранили')).toBeTruthy();
    expect(getByText('Хотят')).toBeTruthy();
    expect(getByText('Планируют')).toBeTruthy();
    expect(queryByText('добавили в «Хочу поехать»')).toBeNull();
    expect(queryByText('собираются поехать')).toBeNull();
  });

  it('keeps the icon and value in one clickable row', () => {
    const onMetricPress = jest.fn();
    const { getByLabelText, getByTestId } = render(
      <ProfileTravelEngagementSummary
        summary={{
          favoritesCount: 4,
          wishlistCount: 0,
          visitedCount: 0,
          plannedCount: 0,
        }}
        travelsCount={289}
        onMetricPress={onMetricPress}
      />,
    );

    const primaryRow = getByTestId('profile-engagement-metric-primary-favoritesCount');
    expect(StyleSheet.flatten(primaryRow.props.style)).toEqual(
      expect.objectContaining({ flexDirection: 'row', alignItems: 'center' }),
    );

    fireEvent.press(getByLabelText('Сохранили: 4'));
    expect(onMetricPress).toHaveBeenCalledWith('favoritesCount');
  });
});
