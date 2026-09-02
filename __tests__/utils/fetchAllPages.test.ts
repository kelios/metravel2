import { fetchAllPages } from '@/utils/fetchAllPages';
import { devWarn } from '@/utils/logger';

jest.mock('@/utils/logger', () => ({ devWarn: jest.fn() }));

/**
 * #1706 / класс `API-PAGE-SIZE-CAP-001`: сервер режет страницу
 * своим потолком, поэтому число страниц обязано считаться по фактически
 * отданному размеру, а не по запрошенному `perPage`.
 */
describe('fetchAllPages', () => {
  beforeEach(() => {
    (devWarn as jest.Mock).mockClear();
  });

  const makeItems = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: from + i }));

  it('дочитывает хвост по total и склеивает страницы по порядку', async () => {
    const loadPage = jest.fn(async (page: number) => ({
      items: makeItems((page - 1) * 200 + 1, page === 3 ? 50 : 200),
      total: 450,
    }));

    const items = await fetchAllPages(loadPage);

    expect(items).toHaveLength(450);
    expect(items[0]).toEqual({ id: 1 });
    expect(items[449]).toEqual({ id: 450 });
    expect(loadPage.mock.calls.map(([p]) => p)).toEqual([1, 2, 3]);
  });

  it('не делает лишнего запроса, если всё поместилось в первую страницу', async () => {
    const loadPage = jest.fn(async () => ({ items: makeItems(1, 12), total: 12 }));

    const items = await fetchAllPages(loadPage);

    expect(items).toHaveLength(12);
    expect(loadPage).toHaveBeenCalledTimes(1);
  });

  it('считает страницы по отданному размеру, а не по запрошенному perPage', async () => {
    // Клиент просит 1000, сервер отдаёт 200 — деление 2656/1000 дало бы 3 страницы
    // и потеряло бы хвост; правильный ответ — 2656/200 = 14 страниц.
    const loadPage = jest.fn(async (page: number) => ({
      items: makeItems((page - 1) * 200 + 1, page === 14 ? 56 : 200),
      total: 2656,
    }));

    const items = await fetchAllPages(loadPage);

    expect(items).toHaveLength(2656);
    expect(loadPage).toHaveBeenCalledTimes(14);
  });

  it('пустая первая страница не уходит в бесконечную догрузку', async () => {
    const loadPage = jest.fn(async () => ({ items: [], total: 900 }));

    await expect(fetchAllPages(loadPage)).resolves.toEqual([]);
    expect(loadPage).toHaveBeenCalledTimes(1);
  });

  it('ограничивает число страниц предохранителем maxPages и делает это громко', async () => {
    const loadPage = jest.fn(async () => ({ items: makeItems(1, 10), total: 1_000_000 }));

    const items = await fetchAllPages(loadPage, { maxPages: 3 });

    expect(loadPage).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(30);
    // Молча урезанная коллекция — тот самый дефект, который хелпер закрывает.
    expect(devWarn).toHaveBeenCalledWith(expect.stringContaining('maxPages=3'));
  });

  it('не мутирует массив первой страницы', async () => {
    const firstPageItems = makeItems(1, 2);
    const loadPage = jest.fn(async (page: number) => ({
      items: page === 1 ? firstPageItems : makeItems(3, 2),
      total: 4,
    }));

    await fetchAllPages(loadPage);

    expect(firstPageItems).toHaveLength(2);
  });
});
