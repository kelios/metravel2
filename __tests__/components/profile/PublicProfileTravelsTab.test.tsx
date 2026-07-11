import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { PublicProfileTravelsTab } from '@/components/screens/profile/PublicProfileTravelsTab';
import type { Travel } from '@/types/types';

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: () => '#334455' }),
}));

jest.mock('@/components/ui/UnifiedTravelCard', () => () => null);

describe('PublicProfileTravelsTab', () => {
  it('loads more routes inside the profile instead of navigating away', () => {
    const onLoadMore = jest.fn();
    const travel = { id: 1, name: 'Маршрут' } as Travel;
    const { getByRole, queryByText } = render(
      <PublicProfileTravelsTab
        travels={[travel]}
        total={13}
        isLoading={false}
        isError={false}
        isMobile={false}
        onOpenTravel={jest.fn()}
        onLoadMore={onLoadMore}
      />
    );

    fireEvent.press(getByRole('button', { name: 'Показать ещё путешествия автора' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(queryByText('Смотреть все (13)')).toBeNull();
  });
});
