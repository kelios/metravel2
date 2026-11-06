import { fireEvent, render } from '@testing-library/react-native';

import type { UserBadge } from '@/api/achievements';
import PublicationMedals from '@/components/achievements/PublicationMedals';

jest.mock('@/components/achievements/BadgeDetailSheet', () => {
  const { Text, View } = jest.requireActual('react-native');
  return ({ detail, onClose }: { detail: { badge: { description: string } }; onClose: () => void }) => (
    <View testID="publication-medal-sheet">
      <Text>{detail.badge.description}</Text>
      <Text onPress={onClose}>Закрыть</Text>
    </View>
  );
});

const author: UserBadge = {
  id: 5,
  earnedAt: '2026-11-06T09:00:00Z',
  badge: {
    id: 15,
    slug: 'first-travel',
    name: 'Автор MeTravel',
    description: 'Опубликуйте первую статью или заметку.',
    categorySlug: 'onboarding',
    categoryName: 'Начало',
    tier: 'bronze',
    imageUrl: null,
    points: 15,
  },
};
const contributor: UserBadge = {
  ...author,
  id: 6,
  badge: {
    ...author.badge,
    id: 16,
    slug: 'belarus-map-contributor',
    name: 'Сердце карты',
    description: 'Опубликуйте историю о месте из акции «Допишем Беларусь вместе».',
    tier: 'gold',
    points: 0,
  },
};
const unrelated: UserBadge = {
  ...author,
  id: 7,
  badge: { ...author.badge, id: 17, slug: 'hiker-bronze', name: 'Хайкер' },
};

describe('PublicationMedals', () => {
  it('renders no actions for a user without either earned badge', async () => {
    const view = await render(<PublicationMedals earned={[unrelated]} />);
    expect(view.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders only the earned author medal with its full accessible name', async () => {
    const view = await render(<PublicationMedals earned={[unrelated, author]} />);
    expect(view.getByRole('button', { name: 'Открыть награду «Автор MeTravel»' })).toBeTruthy();
    expect(view.getByText('Автор')).toBeTruthy();
    expect(view.getAllByRole('button')).toHaveLength(1);
  });

  it('keeps a stable order and opens the selected badge criterion', async () => {
    const view = await render(<PublicationMedals earned={[contributor, unrelated, author, author]} />);
    const [authorButton, contributorButton] = view.getAllByRole('button');
    expect(authorButton).toBe(view.getByRole('button', { name: 'Открыть награду «Автор MeTravel»' }));
    expect(contributorButton).toBe(view.getByRole('button', { name: 'Открыть награду «Сердце карты»' }));

    await fireEvent.press(contributorButton);
    expect(view.getByText(contributor.badge.description)).toBeTruthy();
    expect(view.queryByText(author.badge.description)).toBeNull();
    await fireEvent.press(view.getByText('Закрыть'));
    expect(view.queryByTestId('publication-medal-sheet')).toBeNull();
  });
});
