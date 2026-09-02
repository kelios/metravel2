/**
 * Догрузка всех страниц пагинированного эндпоинта по возвращаемому `total`.
 *
 * Проблема, которую закрывает хелпер (класс `API-PAGE-SIZE-CAP-001`):
 * клиент просит завышенный `perPage` в расчёте «получить всё одним запросом»,
 * сервер молча режет страницу своим `max_page_size`, а клиент считает первую
 * страницу полным списком — хвост данных исчезает без единой ошибки. Так уже
 * терялись авторские путешествия календаря (#1705) и сохранённые точки (#1706).
 *
 * Ключевой момент: число страниц считается по фактически отданным записям, а НЕ
 * по запрошенному `perPage`. Деление `total` на запрошенное значение снова тихо
 * потеряло бы хвост, если сервер урезал страницу своим потолком.
 */

import { devWarn } from '@/utils/logger';

export type PaginatedPage<T> = {
  items: T[];
  /** Общее число записей на сервере (`count`/`total` из ответа). */
  total: number;
};

export type FetchAllPagesOptions = {
  /** Предохранитель от бесконечного цикла, если сервер вернёт неадекватный `total`. */
  maxPages?: number;
};

const DEFAULT_MAX_PAGES = 50;

export type ResolveTotalPagesInput = {
  /** Общее число записей на сервере (`count`/`total` из ответа). */
  total: number;
  /** Фактическая длина первой страницы — НЕ запрошенный `perPage`. */
  pageSize: number;
  maxPages?: number;
};

/**
 * Сколько страниц надо прочитать, чтобы собрать `total` записей.
 *
 * Правило вынесено отдельной функцией, потому что именно оно — а не обвязка
 * вокруг него — ломалось в #1705 и #1706: делить `total` надо на фактически
 * отданный размер страницы и обязательно шуметь, когда предохранитель
 * `maxPages` обрезает коллекцию. Собственную обвязку докачки имеет право иметь
 * тот, кому мало `fetchAllPages` (каталог квестов с eager-страницами и
 * 404-как-концом каталога), но правило у всех обязано быть одно.
 */
export function resolveTotalPages({
  total,
  pageSize,
  maxPages = DEFAULT_MAX_PAGES,
}: ResolveTotalPagesInput): number {
  if (pageSize <= 0) return 1;
  if (total <= pageSize) return 1;

  const neededPages = Math.ceil(total / pageSize);
  if (neededPages > maxPages) {
    // Предохранитель обязан быть громким: молча урезанная коллекция — ровно тот
    // дефект, который хелпер и закрывает.
    devWarn(
      `fetchAllPages: предохранитель maxPages=${maxPages} обрезал коллекцию — ` +
        `нужно ${neededPages} страниц по ${pageSize} записей (total=${total}).`,
    );
    return maxPages;
  }
  return neededPages;
}

/**
 * Читает первую страницу, по её размеру и `total` вычисляет остаток и дочитывает
 * его. Хвост уходит одним заходом: последовательное чтение сложило бы RTT страниц.
 *
 * Ответ, который целиком помещается в первую страницу (в том числе
 * непагинированный массив с `total === items.length`), остаётся одним запросом.
 */
export async function fetchAllPages<T>(
  loadPage: (page: number) => Promise<PaginatedPage<T>>,
  { maxPages = DEFAULT_MAX_PAGES }: FetchAllPagesOptions = {},
): Promise<T[]> {
  const firstPage = await loadPage(1);
  // Копия обязательна: `loadPage` вправе отдать сам массив из ответа, и push
  // дописывал бы записи следующих страниц прямо в объект первого ответа.
  const items = [...firstPage.items];

  const totalPages = resolveTotalPages({
    total: firstPage.total,
    pageSize: items.length,
    maxPages,
  });
  if (totalPages <= 1) return items;

  const restPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => loadPage(index + 2)),
  );
  restPages.forEach((page) => items.push(...page.items));

  return items;
}
