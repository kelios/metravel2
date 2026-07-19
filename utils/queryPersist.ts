// utils/queryPersist.ts
// FE-INFRA #1015 — prerequisite for #994 (миграция favorites/history/
// recommendations/travelStatus на чистый React Query без регресса offline).
//
// Подключает persistQueryClient поверх смонтированного QueryClient с УЗКИМ
// whitelist по domain-ключам. Цель — заменить ручной AsyncStorage-мирор внутри
// сторов (loadServerCached/SERVER_*_CACHE_KEY) единым persist-слоем RQ.
//
// Почему узкий whitelist, а не весь кэш:
//  - auth/user-profile — session-critical, staleTime 0, гидрируется в boot
//    authStore.checkAuthentication (getActiveQueryClient().fetchQuery) — НЕ
//    персистим, чтобы persist-restore не гонялся с boot-порядком и не подсовывал
//    протухший профиль;
//  - map/travels/quests — объёмные/волатильные (или у quest-bundle уже свой
//    офлайн-персист) — не раздуваем storage и не рискуем staleness на карте;
//  - gamification — session-scoped, дешевле перезапросить.
// Персистим ровно офлайн-домены серверного стейта из #994.

import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient, Query } from '@tanstack/react-query';

// Ключ и buster: bump buster при смене формы данных/whitelist — старый
// персист-снимок будет отброшен на restore, а не гидрирован в новую схему.
const PERSIST_STORAGE_KEY = 'metravel-rq-cache';
const PERSIST_BUSTER = 'v1';

// 7 дней — офлайн-домены должны переживать перезапуск, но не быть вечными.
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

// Троттлинг записи в AsyncStorage, чтобы не бить хранилище на каждый апдейт кэша.
const PERSIST_THROTTLE = 1000;

// Top-level query-key префиксы офлайн-доменов #994 (см. api/queryKeys.ts:
// favorites/recommendations/viewHistory/travelStatus). Ключи scoped по userId,
// но корневой сегмент общий — фильтруем по нему.
const PERSISTED_KEY_PREFIXES = new Set<string>([
  'favorites',
  'recommendations',
  'view-history',
  'travel-status',
]);

/** Персистим только успешные запросы из whitelist-доменов. */
export const shouldPersistQuery = (query: Query): boolean => {
  if (query.state.status !== 'success') return false;
  const root = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
  return typeof root === 'string' && PERSISTED_KEY_PREFIXES.has(root);
};

// Идемпотентность: один смонтированный QueryClient на жизнь приложения, но
// AppProviders может ре-рендериться и React StrictMode дважды вызывает эффекты.
// WeakSet не даёт повторно подписать один и тот же клиент (двойная подписка =
// двойная запись в storage), но разрешает подключить действительно новый клиент.
const wiredClients = new WeakSet<QueryClient>();

/**
 * Подключает persistQueryClient к переданному QueryClient. Безопасно вызывать
 * многократно — повторные вызовы для того же клиента игнорируются.
 * Restore выполняется асинхронно в фоне и НЕ блокирует boot: whitelist-домены
 * не нужны на первом кадре, а auth-профиль не персистится вовсе.
 */
export function setupQueryPersistence(queryClient: QueryClient): void {
  if (wiredClients.has(queryClient)) return;
  wiredClients.add(queryClient);

  const persister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: PERSIST_STORAGE_KEY,
    throttleTime: PERSIST_THROTTLE,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: PERSIST_MAX_AGE,
    buster: PERSIST_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistQuery,
    },
  });
}
