import {countRu, editionLabel, PAGES, PLACES, QUESTS} from '@/services/book/readyBooks/render/counts';

it('declines printed counts by the shared Russian plural rules (#2949)', () => {
  expect(countRu(31, PLACES)).toBe('31 место');
  expect(countRu(30, PLACES)).toBe('30 мест');
  expect(countRu(4, PAGES)).toBe('4 страницы');
  expect(countRu(108, PAGES)).toBe('108 страниц');
  expect(countRu(11, QUESTS)).toBe('11 квестов');
  expect(countRu(22, QUESTS)).toBe('22 квеста');
});

it('names the edition by month instead of a revision hash', () => {
  expect(editionLabel('2026-11')).toBe('Издание: ноябрь 2026');
  expect(() => editionLabel('7a7f22a5')).toThrow();
});
