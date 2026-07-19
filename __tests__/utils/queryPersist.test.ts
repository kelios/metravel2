import { shouldPersistQuery } from '@/utils/queryPersist';
import type { Query } from '@tanstack/react-query';

// #1015 — whitelist-предикат persist: персистим ТОЛЬКО успешные запросы
// офлайн-доменов #994 и ничего лишнего (auth/map/gamification и т.п.).
const makeQuery = (queryKey: unknown, status: string): Query =>
  ({ queryKey, state: { status } } as unknown as Query);

describe('shouldPersistQuery (#1015 persist whitelist)', () => {
  it.each([
    ['favorites', ['favorites', '42']],
    ['recommendations', ['recommendations', null]],
    ['view-history', ['view-history', '7']],
    ['travel-status', ['travel-status', '7']],
    ['travel-status authored suffix', ['travel-status', '7', 'authored']],
  ])('персистит офлайн-домен %s', (_label, key) => {
    expect(shouldPersistQuery(makeQuery(key, 'success'))).toBe(true);
  });

  it.each([
    ['user-profile', ['user-profile', '1']],
    ['auth token', ['auth']],
    ['mapClusters', ['mapClusters', {}]],
    ['travels list', ['travels']],
    ['travel detail', ['travel', 5]],
    ['quest-bundle', ['quest-bundle', 'minsk']],
    ['gamification', ['gamification', 'progress', 'me']],
    ['achievements', ['achievements', 'me']],
  ])('НЕ персистит несписочный домен %s', (_label, key) => {
    expect(shouldPersistQuery(makeQuery(key, 'success'))).toBe(false);
  });

  it('НЕ персистит whitelist-домен, пока запрос не success (pending/error)', () => {
    expect(shouldPersistQuery(makeQuery(['favorites', '1'], 'pending'))).toBe(false);
    expect(shouldPersistQuery(makeQuery(['favorites', '1'], 'error'))).toBe(false);
  });

  it('НЕ падает на нестроковом/пустом корне ключа', () => {
    expect(shouldPersistQuery(makeQuery([], 'success'))).toBe(false);
    expect(shouldPersistQuery(makeQuery([123], 'success'))).toBe(false);
  });
});
