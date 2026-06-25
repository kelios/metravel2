import { render } from '@testing-library/react-native';

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
    expect(queryByText('добавили в избранное')).toBeNull();
    expect(queryByText('собираются поехать')).toBeNull();
  });
});
