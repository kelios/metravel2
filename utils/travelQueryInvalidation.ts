import { type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { invalidateTravelDetailMemoryCache } from '@/api/travelDetailsQueries';

// React-query инвалидации после сохранения путешествия. Чистые async-хелперы,
// извлечены из useTravelFormPersistence без изменения поведения.

export async function invalidateTravelCollections(
  queryClient: QueryClient | null | undefined,
  userId: string | null,
  { refreshProfile = true }: { refreshProfile?: boolean } = {},
) {
  if (!queryClient?.invalidateQueries) return;

  // The owner-profile counters refresh independently of the editor's save gate.
  if (userId && refreshProfile) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.userProfile(userId), exact: true }, { throwOnError: false });
  }

  // Start every affected read together. A failed GET belongs to that query's
  // retry state; it must not turn an already-confirmed write into a failed PUT.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.travels(), refetchType: 'all' }, { throwOnError: false }),
    ...(userId ? [
      queryClient.invalidateQueries({ queryKey: queryKeys.myTravelsCount(userId), refetchType: 'all' }, { throwOnError: false }),
      queryClient.invalidateQueries({ queryKey: queryKeys.exportMyTravelsCount(userId), refetchType: 'all' }, { throwOnError: false }),
    ] : []),
  ]);
}

export async function invalidateTravelDetails(
  queryClient: QueryClient | null | undefined,
  ...travelKeys: Array<string | number | null | undefined>
) {
  invalidateTravelDetailMemoryCache(...travelKeys);
  if (!queryClient?.invalidateQueries) return;

  const uniqueKeys = Array.from(
    new Set(
      travelKeys
        .map((key) => (key == null ? '' : String(key).trim()))
        .filter(Boolean),
    ),
  );

  await Promise.all(
    uniqueKeys.map((key) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.travel(Number.isFinite(Number(key)) ? Number(key) : key) }),
    ),
  );
}
