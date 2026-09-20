import { QUEST_RATING_MIN_REVIEWS } from '@/api/questRating';
import {
  RATED_QUEST_MIN_MATCHES,
  canRankQuestsByRating,
  compareQuestRating,
  countRatedQuests,
  hasRankableRating,
  sortQuestsByRating,
} from '@/utils/questRatingOrder';
import { compareQuestPopularity, sortQuestsByPopularity } from '@/utils/questPopularity';

/**
 * #1988: порядок «По рейтингу» обязан считать ПУБЛИЧНЫЙ рейтинг, а не сырой
 * `rating_avg`. Агрегат из одного отзыва — вымысел (#1486), и поднимать им
 * квест наверх каталога нельзя тем же способом, каким нельзя рисовать «5.0»
 * на карточке.
 */

const quest = (id: number, ratingAvg: number, ratingCount: number) => ({
  id,
  rating_avg: ratingAvg,
  rating_count: ratingCount,
});

describe('порядок каталога квестов по рейтингу', () => {
  it('публичным считает рейтинг с порога, заданного доменом', () => {
    expect(hasRankableRating(quest(1, 5, QUEST_RATING_MIN_REVIEWS))).toBe(true);
    expect(hasRankableRating(quest(1, 5, QUEST_RATING_MIN_REVIEWS - 1))).toBe(false);
  });

  it('квест с одним отзывом на пятёрку не обгоняет квест с публичным рейтингом', () => {
    const single = quest(1, 5, 1);
    const public4 = quest(2, 4.2, QUEST_RATING_MIN_REVIEWS);
    expect(sortQuestsByRating([single, public4])).toEqual([public4, single]);
  });

  /**
   * Ключей ровно два — оценка и id, как у серверного `?ordering=-rating_avg`
   * (`quests/catalog.py`: `order_by('-qualified_rating', 'id')`). Числа отзывов
   * среди ключей НЕТ намеренно: расхождение с сервером дороже, чем выигрыш от
   * «4.9 из девяти выше 4.9 из трёх».
   */
  it('среди публично оценённых порядок — оценка, затем id, как на сервере', () => {
    const a = quest(10, 4.9, 5);
    const b = quest(11, 4.9, 9);
    const c = quest(12, 4.1, 40);
    const d = quest(13, 4.9, 3);
    expect(sortQuestsByRating([c, d, b, a]).map((q) => q.id)).toEqual([10, 11, 13, 12]);
  });

  it('квесты без публичного рейтинга держат хвост в порядке каталога по id', () => {
    const rated = quest(50, 4.5, 4);
    const tail = [quest(3, 0, 0), quest(1, 5, 1), quest(2, 0, 0)];
    expect(sortQuestsByRating([...tail, rated]).map((q) => q.id)).toEqual([50, 1, 2, 3]);
  });

  it('читает и camelCase-форму адаптированной меты', () => {
    const adapted = { id: 'minsk-cipher', numericId: 7, ratingAvg: 4.8, ratingCount: 6 };
    const raw = quest(9, 4.2, 4);
    expect(sortQuestsByRating([raw, adapted as never]).map((q) => q.id)).toEqual([
      'minsk-cipher',
      9,
    ]);
  });

  it('не предлагает сортировку, пока публично оценённых меньше двух', () => {
    const one = [quest(1, 5, QUEST_RATING_MIN_REVIEWS), quest(2, 5, 1)];
    expect(countRatedQuests(one)).toBe(1);
    expect(canRankQuestsByRating(one)).toBe(false);

    const two = [quest(1, 5, QUEST_RATING_MIN_REVIEWS), quest(2, 4, QUEST_RATING_MIN_REVIEWS)];
    expect(countRatedQuests(two)).toBe(RATED_QUEST_MIN_MATCHES);
    expect(canRankQuestsByRating(two)).toBe(true);
  });

  it('на прод-срезе 19.09.2026 сортировка недоступна: публичных рейтингов нет', () => {
    // Три квеста с одним отзывом каждый — весь рейтинговый сигнал каталога.
    const prodSlice = [quest(19, 5, 1), quest(30, 5, 1), quest(32, 5, 1)];
    expect(canRankQuestsByRating(prodSlice)).toBe(false);
  });

  it('не подменяет собой порядок популярности', () => {
    const quests = [
      { id: 1, completions_count: 0, views_count: 10, rating_avg: 5, rating_count: 9 },
      { id: 2, completions_count: 3, views_count: 1, rating_avg: 3, rating_count: 9 },
    ];
    expect(sortQuestsByPopularity(quests).map((q) => q.id)).toEqual([2, 1]);
    expect(sortQuestsByRating(quests).map((q) => q.id)).toEqual([1, 2]);
    expect(compareQuestRating(quests[0], quests[1])).toBeLessThan(0);
    expect(compareQuestPopularity(quests[0], quests[1])).toBeGreaterThan(0);
  });

  it('исходный массив не мутирует', () => {
    const quests = [quest(2, 4, 5), quest(1, 5, 5)];
    const snapshot = quests.map((q) => q.id);
    sortQuestsByRating(quests);
    expect(quests.map((q) => q.id)).toEqual(snapshot);
  });
});
