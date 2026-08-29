import { fetchAllCountries, fetchFilters, fetchFiltersCountry } from './misc';
import { devWarn } from '@/utils/logger';
import type { FilterCountryOption, FilterDictionaries, Filters } from '@/types/types';

// Кэш для хранения результатов запросов
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  sequence: number;
  forced: boolean;
  startedAt: number;
}
const filtersCache = new Map<string, CacheEntry<unknown>>();
const cacheTimeout = 10 * 60 * 1000; // 10 минут

// Порядковый номер запроса. Нужен, когда по одному ключу летят двое (обычный и
// forced): TTL-кэш должен остаться за тем, кто СТАРТОВАЛ позже, а не за тем, кто
// случайно финишировал последним — иначе ответ из HTTP-кэша браузера ложится
// поверх свежего.
let requestSequence = 0;

// In-flight promise cache для дедупликации параллельных запросов.
// `forced` помечает запрос, который идёт мимо HTTP-кэша браузера: обычный вызов
// вправе присоединиться к любому летящему запросу, а forced — только к такому же
// forced, иначе «обновить словарь» вернуло бы тот самый устаревший ответ.
interface InFlightEntry<T> {
  promise: Promise<T>;
  forced: boolean;
  sequence: number;
  startedAt: number;
}
const inFlightRequests = new Map<string, InFlightEntry<unknown>>();

interface DictionaryLoadOptions {
  signal?: AbortSignal;
  force?: boolean;
  // A return must observe a forced request started after this snapshot.
  afterRequestSequence?: number;
  onRequestStart?: (startedAt: number) => void;
}

export const captureFiltersRefreshBoundary = (): number => requestSequence;

/** Ошибка отмены в формате, который проверяют потребители (`error.name === 'AbortError'`). */
const createAbortError = (): Error => {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
};

/**
 * Отвязывает вызывающего от общего запроса по его signal, НЕ отменяя сам запрос:
 * иначе размонтирование одного экрана рвало бы загрузку справочника у всех
 * остальных, кто ждёт тот же in-flight промис.
 */
const detachOnAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort);
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
};

/**
 * Общий слой словарей: TTL-кэш плюс дедупликация in-flight на один ключ.
 *
 * Это единственная точка сети для справочников — через неё ходят и queryFn
 * React Query, и императивные потребители (`useTravelFilters`,
 * `useVisitedCountries`, `useProfileCountriesData`, стартовый idle-префетч).
 * Пока запрос по ключу летит, все остальные ждут ТОТ ЖЕ промис, поэтому один
 * справочник не может уехать по сети дважды за загрузку страницы — раньше
 * `/roulette` тянул и `getFiltersTravel`, и `countries` по два раза.
 *
 * Signal вызывающего намеренно не доходит до сети: промис общий, и отмена
 * одного экрана оборвала бы справочник всем остальным (см. `detachOnAbort`).
 * Словари маленькие и кэшируются, поэтому дешевле дать запросу дойти до конца.
 */
const loadCachedDictionary = <T>(
  cacheKey: string,
  loader: (loaderOptions: { forceRefresh: boolean }) => Promise<T>,
  options?: DictionaryLoadOptions,
): Promise<T> => {
  if (options?.signal?.aborted) return Promise.reject(createAbortError());

  const afterRequestSequence = options?.afterRequestSequence;
  const requiresFreshResponse = afterRequestSequence !== undefined;
  const force = options?.force === true || requiresFreshResponse;
  const cached = filtersCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (cached && (Date.now() - cached.timestamp) < cacheTimeout && (
    !force || (requiresFreshResponse && cached.forced && cached.sequence > afterRequestSequence)
  )) {
    options?.onRequestStart?.(cached.startedAt);
    return Promise.resolve(cached.data);
  }

  const subscribe = (promise: Promise<T>): Promise<T> =>
    detachOnAbort(promise, options?.signal).catch((error: unknown) => {
      if (!requiresFreshResponse && cached && !options?.signal?.aborted) {
        devWarn(`Using cached ${cacheKey} due to error:`, error);
        return cached.data;
      }
      throw error;
    });

  const inFlight = inFlightRequests.get(cacheKey) as InFlightEntry<T> | undefined;
  if (inFlight && (requiresFreshResponse || !force || inFlight.forced)) {
    if (requiresFreshResponse && (!inFlight.forced || inFlight.sequence <= afterRequestSequence)) {
      // Re-enter after the shared request; the first surviving caller starts the next one.
      return detachOnAbort(inFlight.promise.catch(() => undefined), options?.signal)
        .then(() => loadCachedDictionary(cacheKey, loader, options));
    }
    options?.onRequestStart?.(inFlight.startedAt);
    return subscribe(inFlight.promise);
  }

  const sequence = ++requestSequence;
  const entry: InFlightEntry<T> = {
    promise: undefined as unknown as Promise<T>,
    forced: force,
    sequence,
    startedAt: Date.now(),
  };
  inFlightRequests.set(cacheKey, entry as InFlightEntry<unknown>);

  entry.promise = (async () => {
    try {
      const data = await loader({ forceRefresh: force });
      const current = filtersCache.get(cacheKey);
      if (!current || current.sequence < sequence) {
        filtersCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          sequence,
          forced: force,
          startedAt: entry.startedAt,
        });
      }
      return data;
    } finally {
      // Снимаем только СВОЮ запись: forced-запрос мог перезаписать чужую.
      if (inFlightRequests.get(cacheKey) === (entry as InFlightEntry<unknown>)) {
        inFlightRequests.delete(cacheKey);
      }
    }
  })();

  options?.onRequestStart?.(entry.startedAt);
  return subscribe(entry.promise);
};

/**
 * Словарь фильтров путешествия (`/getFiltersTravel/`).
 *
 * `force` нужен визарду: категории точек заводятся в админке во время работы
 * автора, а без обхода TTL-кэша и HTTP-кэша браузера новая категория не видна
 * до получаса (см. `fetchFilters` и BE-задачу #1436).
 */
export const fetchFiltersOptimized = (
  options?: DictionaryLoadOptions,
): Promise<FilterDictionaries> =>
  loadCachedDictionary(
    'filters',
    ({ forceRefresh }) =>
      fetchFilters({ throwOnError: true, ...(forceRefresh ? { forceRefresh: true } : null) }),
    options,
  );

/**
 * Страны для фильтра поиска (`/countriesforsearch/`) — только те, по которым
 * реально есть маршруты (32 записи против 234). Не путать с
 * {@link fetchAllCountriesOptimized}: это словарь фильтра, а не справочник.
 */
export const fetchFiltersCountryOptimized = (
  options?: { signal?: AbortSignal },
): Promise<FilterCountryOption[]> =>
  loadCachedDictionary(
    'countries-for-search',
    () => fetchFiltersCountry({ throwOnError: true }),
    options,
  );

/**
 * Полный справочник стран (`/countries/`, 234 записи). Нужен там, где страну
 * выбирают, а не фильтруют по ней: визард путешествия и статистика профиля.
 */
export const fetchAllCountriesOptimized = (
  options?: { signal?: AbortSignal },
): Promise<FilterCountryOption[]> =>
  loadCachedDictionary('all-countries', () => fetchAllCountries({ throwOnError: true }), options);

/** Фильтры вместе со странами поиска — один вызов для каталога и рулетки. */
export const fetchAllFiltersOptimized = (options?: { signal?: AbortSignal }): Promise<Filters> =>
  loadCachedDictionary(
    'all-filters',
    async () => {
      const [base, countries] = await Promise.all([
        fetchFiltersOptimized(),
        fetchFiltersCountryOptimized(),
      ]);
      return { ...base, countries };
    },
    options,
  );

// Функция для очистки кэша (полезна для отладки)
export const clearFiltersCache = () => {
  filtersCache.clear();
};
