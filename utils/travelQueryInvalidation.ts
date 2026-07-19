import { type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';

// React-query инвалидации после сохранения путешествия. Чистые async-хелперы,
// извлечены из useTravelFormPersistence без изменения поведения.

export async function invalidateTravelCollections(
  queryClient: QueryClient | null | undefined,
  userId: string | null,
) {
  if (!queryClient?.invalidateQueries) return;

  await queryClient.invalidateQueries({ queryKey: queryKeys.travels(), refetchType: 'all' });

  if (!userId) return;

  await queryClient.invalidateQueries({ queryKey: queryKeys.myTravelsCount(userId), refetchType: 'all' });
  await queryClient.invalidateQueries({ queryKey: queryKeys.exportMyTravelsCount(userId), refetchType: 'all' });
}

export async function invalidateTravelDetails(
  queryClient: QueryClient | null | undefined,
  ...travelKeys: Array<string | number | null | undefined>
) {
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
