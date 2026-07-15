import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  disconnectStrava,
  fetchStravaActivities,
  fetchStravaActivityDetail,
  fetchStravaStatus,
  startStravaConnect,
  type StravaActivitiesQuery,
  type StravaActivityDetail,
  type StravaActivitySummary,
} from '@/api/strava';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/context/AuthContext';
import { openExternalUrl } from '@/utils/externalLinks';
import { showToast } from '@/utils/toast';
import { translate as i18nT } from '@/i18n'


const DEFAULT_PER_PAGE = 10;

export type StravaActivityFilters = {
  after: string;
  before: string;
  type: string;
};

const buildActivitiesQuery = (
  filters: StravaActivityFilters,
  page: number,
): StravaActivitiesQuery => ({
  after: filters.after || undefined,
  before: filters.before || undefined,
  type: filters.type || undefined,
  page,
  perPage: DEFAULT_PER_PAGE,
});

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback;

export const mergeStravaActivities = (
  previous: StravaActivitySummary[],
  next: StravaActivitySummary[],
): StravaActivitySummary[] => {
  const byId = new Map<string, StravaActivitySummary>();
  for (const item of previous) byId.set(item.id, item);
  for (const item of next) byId.set(item.id, item);
  return Array.from(byId.values());
};

export function useStravaIntegration() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<StravaActivityFilters>({
    after: '',
    before: '',
    type: '',
  });
  const [page, setPage] = useState(1);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activityItems, setActivityItems] = useState<StravaActivitySummary[]>([]);

  const activitiesQueryParams = useMemo(
    () => buildActivitiesQuery(filters, page),
    [filters, page],
  );

  const statusQuery = useQuery({
    queryKey: queryKeys.stravaStatus(),
    queryFn: fetchStravaStatus,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && [401, 403, 404, 501, 503].includes(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const status = statusQuery.data;
  const canLoadActivities =
    isAuthenticated &&
    status?.connected === true &&
    status.status === 'connected';

  const activitiesQuery = useQuery({
    queryKey: queryKeys.stravaActivities(activitiesQueryParams as Record<string, unknown>),
    queryFn: () => fetchStravaActivities(activitiesQueryParams),
    enabled: canLoadActivities,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && [401, 403, 404, 429, 501, 503].includes(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const selectedActivityQuery = useQuery<StravaActivityDetail | null>({
    queryKey: queryKeys.stravaActivity(selectedActivityId),
    queryFn: () => fetchStravaActivityDetail(selectedActivityId as string),
    enabled: canLoadActivities && Boolean(selectedActivityId),
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && [401, 403, 404, 429, 501, 503].includes(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const invalidateStrava = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stravaStatus() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.stravaActivitiesRoot() });
    if (selectedActivityId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stravaActivity(selectedActivityId) });
    }
  }, [queryClient, selectedActivityId]);

  useEffect(() => {
    if (!activitiesQuery.data) return;
    setActivityItems((previous) =>
      page === 1
        ? activitiesQuery.data.data
        : mergeStravaActivities(previous, activitiesQuery.data.data),
    );
  }, [activitiesQuery.data, page]);

  const connectMutation = useMutation({
    mutationFn: startStravaConnect,
    onSuccess: async ({ authUrl }) => {
      const opened = await openExternalUrl(authUrl, {
        allowedProtocols: ['https:'],
      });
      if (!opened) {
        showToast({
          type: 'error',
          text1: i18nT('shared:hooks.useStravaIntegration.ne_udalos_otkryt_strava_92e1019d'),
          text2: i18nT('shared:hooks.useStravaIntegration.proverte_chto_backend_vernul_korrektnuyu_htt_558436ca'),
        });
      }
    },
    onError: (error) => {
      showToast({
        type: 'error',
        text1: i18nT('shared:hooks.useStravaIntegration.strava_poka_nedostupna_a0734257'),
        text2: getErrorMessage(error, i18nT('shared:hooks.useStravaIntegration.backend_oauth_endpoint_esche_ne_gotov_cf8c5f56')),
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectStrava,
    onSuccess: (response) => {
      setSelectedActivityId(null);
      setPage(1);
      setActivityItems([]);
      invalidateStrava();
      showToast({
        type: 'success',
        text1: i18nT('shared:hooks.useStravaIntegration.strava_otklyuchena_403aefef'),
        text2:
          response.message ||
          (response.queuedForDeletion
            ? i18nT('shared:hooks.useStravaIntegration.udalenie_lokalnogo_kesha_postavleno_v_ochere_0b1d88a7')
            : i18nT('shared:hooks.useStravaIntegration.lokalnye_tokeny_i_kesh_strava_udaleny_a6edaf10')),
      });
    },
    onError: (error) => {
      showToast({
        type: 'error',
        text1: i18nT('shared:hooks.useStravaIntegration.ne_udalos_otklyuchit_strava_8c6dd46c'),
        text2: getErrorMessage(error, i18nT('shared:hooks.useStravaIntegration.poprobuyte_pozzhe_ad217916')),
      });
    },
  });

  const updateFilters = useCallback((next: Partial<StravaActivityFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(1);
    setSelectedActivityId(null);
    setActivityItems([]);
  }, []);

  const loadNextPage = useCallback(() => {
    if (activitiesQuery.data?.hasMore && !activitiesQuery.isFetching) {
      setPage((prev) => prev + 1);
    }
  }, [activitiesQuery.data?.hasMore, activitiesQuery.isFetching]);

  return {
    status,
    statusQuery,
    activities: activityItems,
    activitiesQuery,
    selectedActivity: selectedActivityQuery.data ?? null,
    selectedActivityQuery,
    selectedActivityId,
    setSelectedActivityId,
    filters,
    updateFilters,
    page,
    loadNextPage,
    connect: () => connectMutation.mutate(),
    disconnect: () => disconnectMutation.mutate(),
    refetchAll: invalidateStrava,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    canLoadActivities,
  };
}
