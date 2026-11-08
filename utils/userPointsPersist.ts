// utils/userPointsPersist.ts
// #3130 — персист коллекции «Моих точек» (`userPointsAll` + отметка докачки)
// ОТДЕЛЬНЫМ ключом storage, а не в общем снимке `metravel-rq-cache`.
//
// Почему не общий whitelist (`utils/queryPersist.ts`): общий персистер
// пересохраняет весь снимок на любое событие любого запроса (раз в секунду),
// а коллекция владельца — ~1,2 МБ (2656 точек × ~440 байт). В общем снимке это
// синхронный `localStorage.setItem` мегабайта на каждый чих кэша и риск
// упереться в лимит строки (Android AsyncStorage ~2 МБ на запись, web ~5 МБ) —
// тогда молча пропал бы офлайн-слой favorites/history/travel-status (#994).
// Здесь: свой ключ, запись только на события самой коллекции, потолок размера.

import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient, Query, QueryKey } from '@tanstack/react-query';

export const USER_POINTS_PERSIST_STORAGE_KEY = 'metravel-rq-userpoints';
const USER_POINTS_PERSIST_BUSTER = 'v1';
// Как у общего персиста: переживает перезапуск, но не вечный.
const USER_POINTS_PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7;
const USER_POINTS_PERSIST_THROTTLE = 1000;
/**
 * Потолок коллекции для персиста: выше — экран качает заново, зато запись не
 * упирается в лимит строки хранилища (3000 × ~440 байт ≈ 1,3 МБ).
 */
export const USER_POINTS_PERSIST_MAX_POINTS = 3000;

const COLLECTION_ROOT = 'userPointsAll';

const keyRoot = (queryKey: QueryKey): unknown =>
  Array.isArray(queryKey) ? queryKey[0] : queryKey;

/** Запрос относится к коллекции «Моих точек» (сама коллекция или отметка докачки). */
export const isUserPointsPersistKey = (queryKey: QueryKey): boolean =>
  keyRoot(queryKey) === COLLECTION_ROOT;

const isCollectionKey = (queryKey: QueryKey): boolean =>
  Array.isArray(queryKey) && queryKey.length === 2 && queryKey[0] === COLLECTION_ROOT;

/**
 * Предикат дегидрации: успешные запросы коллекции и её отметки, пока коллекция
 * не превышает потолок. Отметка без коллекции бессмысленна — пропускается вместе
 * с ней (замыкание на клиент нужно, чтобы отметка «видела» размер коллекции).
 */
export const makeShouldPersistUserPointsQuery =
  (queryClient: QueryClient) =>
  (query: Query): boolean => {
    if (query.state.status !== 'success') return false;
    if (!isUserPointsPersistKey(query.queryKey)) return false;
    const owner = Array.isArray(query.queryKey) ? query.queryKey[1] : null;
    const collection = isCollectionKey(query.queryKey)
      ? query.state.data
      : queryClient.getQueryData([COLLECTION_ROOT, owner]);
    return Array.isArray(collection) && collection.length <= USER_POINTS_PERSIST_MAX_POINTS;
  };

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: USER_POINTS_PERSIST_STORAGE_KEY,
  throttleTime: USER_POINTS_PERSIST_THROTTLE,
});

const optionsFor = (queryClient: QueryClient) => ({
  queryClient,
  persister,
  maxAge: USER_POINTS_PERSIST_MAX_AGE,
  buster: USER_POINTS_PERSIST_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: makeShouldPersistUserPointsQuery(queryClient) },
});

/** Дополнительный персист для провайдера: restore до монтирования, subscribe после. */
export type SecondaryQueryPersistence = {
  restore: (queryClient: QueryClient) => Promise<void>;
  subscribe: (queryClient: QueryClient) => () => void;
};

export const userPointsPersistence: SecondaryQueryPersistence = {
  restore: (queryClient) => persistQueryClientRestore(optionsFor(queryClient)),
  /**
   * Пишем только на события коллекции (в том числе `removed` при смене
   * владельца — снимок очищается), а не на каждое обновление любого запроса.
   */
  subscribe: (queryClient) => {
    const options = optionsFor(queryClient);
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'added' && event.type !== 'removed' && event.type !== 'updated') return;
      if (!isUserPointsPersistKey(event.query.queryKey)) return;
      void persistQueryClientSave(options);
    });
  },
};
