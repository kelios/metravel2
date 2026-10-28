// #1871: сбой общего списка автора обнулял `travelsCount`, и профиль начинал
// утверждать, что маршрутов нет: вкладка «Уровень» показывала карточку «С чего
// начать» и невыполненный пункт чек-листа, вкладка «Статистика» — чип
// «Маршрутов: 0». Теперь потерянный счётчик приходит как `null`, и каждый
// потребитель обязан отличить его от честного нуля.

import { render } from '@testing-library/react-native';

import { ProfileCompleteness } from '@/components/profile/ProfileCompleteness';
import ProfileFirstStepsCard from '@/components/profile/ProfileFirstStepsCard';
import { ProfileTravelEngagementSummary } from '@/components/profile/ProfileTravelEngagementSection';

const user = {
  name: 'Юля',
  email: 'author@example.com',
  avatar: null,
  hasDisplayName: true,
};

describe('Профиль при потерянном счётчике маршрутов (#1871)', () => {
  describe('карточка «С чего начать»', () => {
    it('не показывается, пока счётчик недоступен', async () => {
      const { queryByTestId } = await render(
        <ProfileFirstStepsCard
          travelsCount={null}
          rank={null}
          onCreateRoute={jest.fn()}
          onStartQuest={jest.fn()}
        />,
      );

      expect(queryByTestId('profile-first-steps-card')).toBeNull();
    });

    it('по-прежнему показывается на доказанном нуле', async () => {
      const { getByTestId } = await render(
        <ProfileFirstStepsCard
          travelsCount={0}
          rank={null}
          onCreateRoute={jest.fn()}
          onStartQuest={jest.fn()}
        />,
      );

      expect(getByTestId('profile-first-steps-card')).toBeTruthy();
    });
  });

  describe('чек-лист заполненности профиля', () => {
    it('не отмечает пункт про маршрут невыполненным, пока счётчик недоступен', async () => {
      const { queryByText } = await render(
        <ProfileCompleteness user={user} profile={null} travelsCount={null} />,
      );

      expect(queryByText('Маршрут')).toBeNull();
      expect(queryByText('Добавьте маршрут')).toBeNull();
    });

    it('по-прежнему просит добавить маршрут на доказанном нуле', async () => {
      const { getByText } = await render(
        <ProfileCompleteness user={user} profile={null} travelsCount={0} />,
      );

      expect(getByText('Маршрут')).toBeTruthy();
    });
  });

  describe('статистика автора', () => {
    it('прячет чип «Маршрутов» и не зовёт публиковать первое путешествие', async () => {
      const { queryByText } = await render(
        <ProfileTravelEngagementSummary summary={null} travelsCount={null} />,
      );

      expect(queryByText(/Маршрутов:/)).toBeNull();
      expect(
        queryByText(
          'Опубликуйте первое путешествие — здесь появится общая статистика интереса аудитории.',
        ),
      ).toBeNull();
    });

    it('по-прежнему показывает нулевой чип и зовёт публиковать на пустом профиле', async () => {
      const { getByText } = await render(
        <ProfileTravelEngagementSummary summary={null} travelsCount={0} />,
      );

      expect(getByText(/Маршрутов:\s*0/)).toBeTruthy();
      expect(
        getByText(
          'Опубликуйте первое путешествие — здесь появится общая статистика интереса аудитории.',
        ),
      ).toBeTruthy();
    });
  });
});
