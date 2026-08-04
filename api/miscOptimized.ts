import { fetchAllCountries, fetchFilters, fetchFiltersCountry } from './misc';
import { devWarn } from '@/utils/logger';
import type { FilterCountryOption, FilterDictionaries, Filters } from '@/types/types';

// Кэш для хранения результатов запросов
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const filtersCache = new Map<string, CacheEntry<unknown>>();
const cacheTimeout = 10 * 60 * 1000; // 10 минут

// In-flight promise cache для дедупликации параллельных запросов
const inFlightRequests = new Map<string, Promise<unknown>>();

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
  loader: () => Promise<T>,
  options?: { signal?: AbortSignal },
): Promise<T> => {
  const cached = filtersCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (cached && (Date.now() - cached.timestamp) < cacheTimeout) {
    return Promise.resolve(cached.data);
  }

  const inFlight = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
  if (inFlight) {
    return detachOnAbort(inFlight, options?.signal);
  }

  const request = (async () => {
    try {
      const data = await loader();
      filtersCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
      return data;
    } catch (error) {
      // Протухший кэш лучше пустого ответа: словари меняются раз в месяцы.
      if (cached) {
        devWarn(`Using cached ${cacheKey} due to error:`, error);
        return cached.data;
      }
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, request);
  return detachOnAbort(request, options?.signal);
};

/** Словарь фильтров путешествия (`/getFiltersTravel/`). */
export const fetchFiltersOptimized = (
  options?: { signal?: AbortSignal },
): Promise<FilterDictionaries> =>
  loadCachedDictionary('filters', () => fetchFilters({ throwOnError: true }), options);

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
