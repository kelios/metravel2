// #2357 F2: состояние серверной полной книги владельца.
//
// Источник правды — сервер: последнее задание берётся из owner job list, так что
// после перезагрузки, офлайна или ожидания дольше любого таймаута панель видит
// то же задание и не создаёт второе. Локально хранятся только период и скрытое
// задание (stores/fullBookExportStore.ts). Ошибка наблюдения — это «нет связи»,
// а не провал сборки: задание продолжается на сервере.

import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  cancelBookExportV2Job,
  getBookExportCapabilities,
  getBookExportV2Job,
  isFullBookExportAvailable,
  listBookExportV2Jobs,
  retryBookExportV2Job,
  type BookExportV2Job,
  type BookExportV2JobStatus,
} from '@/api/bookExportApi'
import { ApiError } from '@/api/clientErrors'
import { queryKeys } from '@/api/queryKeys'
import { useQueryOwner } from '@/hooks/useQueryOwner'
import { getActiveLocale } from '@/i18n/format'
import { downloadFullBookFile } from '@/services/book/fullBookDownload'
import {
  createFullBookOperationKey,
  createFullBookPeriodDraft,
  submitFullBookExport,
  isUncertainSubmitError,
  type FullBookPeriod,
  type FullBookPeriodDraft,
  type SubmitFullBookOptions,
} from '@/services/book/fullBookExportSubmission'
import { useFullBookExportStore } from '@/stores/fullBookExportStore'
import { readRetryOnce, readRetryTwice } from '@/utils/queryRetryPolicy'
import type { BookSettings, BookSettingsLocale } from '@/types/bookSettings'

const ACTIVE_STATUSES: readonly BookExportV2JobStatus[] = ['queued', 'running', 'retry_wait', 'cancel_requested']
export const FULL_BOOK_POLL_INTERVAL_MS = 3000
// Порядок по умолчанию для книги за период — хронология; «ручной» порядок для
// серверного выбора по годам означал бы порядок id, который автор не задавал.
export const FULL_BOOK_DEFAULT_SORT_ORDER: BookSettings['sortOrder'] = 'date-asc'

export function isFullBookJobActive(job: BookExportV2Job | null | undefined): boolean {
  return Boolean(job && ACTIVE_STATUSES.includes(job.status))
}

// Готовность к скачиванию — только полное подтверждение сервера: done, полнота,
// замороженный снимок и доступный файл. Любое расхождение — не готово.
export function isFullBookJobDownloadable(job: BookExportV2Job | null | undefined): boolean {
  return Boolean(
    job &&
      job.status === 'done' &&
      job.completeness === 'complete' &&
      job.snapshot_state === 'frozen' &&
      job.download?.available,
  )
}

// Код контракта из тела ответа (`{error_code}`), если он есть.
export const fullBookErrorCode = (error: unknown): string | null => {
  if (!(error instanceof ApiError)) return null
  const code = (error.data as { error_code?: unknown } | undefined)?.error_code
  return typeof code === 'string' ? code : null
}

const isMissingJobError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 403 || error.status === 404)

const toBookLocale = (): BookSettingsLocale => getActiveLocale().toUpperCase() as BookSettingsLocale

export interface UseFullBookExportOptions {
  enabled: boolean
}

export function useFullBookExport({ enabled }: UseFullBookExportOptions) {
  const owner = useQueryOwner()
  const ownerRef = useRef(owner)
  ownerRef.current = owner
  const queryClient = useQueryClient()
  const prefs = useFullBookExportStore((state) => (owner ? state.byOwner[owner] : undefined))
  const setPeriodPref = useFullBookExportStore((state) => state.setPeriod)
  const dismissJobPref = useFullBookExportStore((state) => state.dismissJob)
  const canQuery = enabled && Boolean(owner)

  // Задание и черновик выбора принадлежат владельцу: при смене аккаунта
  // значения другого владельца не читаются.
  const [submitted, setSubmitted] = useState<{ owner: string; jobId: string } | null>(null)
  const [draftState, setDraftState] = useState<{ owner: string; draft: FullBookPeriodDraft } | null>(null)
  const submitLockRef = useRef(false)
  const submissionRef = useRef<{ owner: string; signature: string; options: SubmitFullBookOptions } | null>(null)

  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.fullBookExportCapabilities(owner),
    queryFn: getBookExportCapabilities,
    enabled: canQuery,
    staleTime: 5 * 60_000,
    retry: readRetryOnce,
  })
  const isAvailable = isFullBookExportAvailable(capabilitiesQuery.data)

  const latestJobQuery = useQuery({
    queryKey: queryKeys.fullBookExportLatestJob(owner),
    queryFn: async () => (await listBookExportV2Jobs({ page_size: 1 })).results[0] ?? null,
    enabled: canQuery && isAvailable,
    staleTime: 30_000,
    refetchInterval: (query) => query.state.data === undefined && query.state.error
      ? FULL_BOOK_POLL_INTERVAL_MS : false,
  })

  const submittedJobId = submitted && submitted.owner === owner ? submitted.jobId : null
  const candidateJobId = submittedJobId ?? latestJobQuery.data?.job_id ?? null
  const jobId = candidateJobId && candidateJobId !== prefs?.dismissedJobId ? candidateJobId : null

  const jobQuery = useQuery({
    queryKey: queryKeys.fullBookExportJob(owner, jobId ?? ''),
    queryFn: () => getBookExportV2Job(jobId as string),
    enabled: canQuery && isAvailable && Boolean(jobId),
    initialData: () => {
      const latest = latestJobQuery.data
      return latest && latest.job_id === jobId ? latest : undefined
    },
    initialDataUpdatedAt: () => latestJobQuery.dataUpdatedAt,
    refetchInterval: (query) => (
      isFullBookJobActive(query.state.data) || (!query.state.data && !isMissingJobError(query.state.error))
        ? FULL_BOOK_POLL_INTERVAL_MS : false
    ),
    // 403/404 не повторяются (задания нет), сеть и 502/503 — дважды.
    retry: readRetryTwice,
  })

  const job = jobId ? jobQuery.data ?? null : null
  const isJobMissing = Boolean(jobId) && isMissingJobError(jobQuery.error)
  const awaitingLatest = canQuery && isAvailable && latestJobQuery.data === undefined
  const isObservingJob = awaitingLatest || Boolean(jobId && !job && !isJobMissing)
  const isReconnecting =
    (Boolean(job) && isFullBookJobActive(job) && (jobQuery.fetchStatus === 'paused' || (jobQuery.isError && !isJobMissing))) ||
    (isObservingJob && (awaitingLatest
      ? latestJobQuery.fetchStatus === 'paused' || latestJobQuery.isError
      : jobQuery.fetchStatus === 'paused' || jobQuery.isError))

  const storeJob = useCallback(
    (next: BookExportV2Job, variables: { owner: string; jobId: string }) => {
      queryClient.setQueryData(queryKeys.fullBookExportJob(variables.owner, next.job_id), next)
    },
    [queryClient],
  )

  const findPeriodMutation = useMutation({
    mutationFn: ({ period }: { owner: string; period: FullBookPeriod }) => createFullBookPeriodDraft(period, FULL_BOOK_DEFAULT_SORT_ORDER),
    onSuccess: (draft, variables) => {
      setPeriodPref(variables.owner, draft.yearFrom, draft.yearTo)
      setDraftState({ owner: variables.owner, draft })
    },
  })

  const submitMutation = useMutation({
    mutationFn: ({ options }: { owner: string; options: SubmitFullBookOptions }) => submitFullBookExport(options),
    onSuccess: ({ jobId: createdJobId }, variables) => {
      setSubmitted({ owner: variables.owner, jobId: createdJobId })
      setDraftState((current) => current?.owner === variables.owner ? null : current)
      void queryClient.invalidateQueries({ queryKey: queryKeys.fullBookExportLatestJob(variables.owner) })
    },
    // Потерянный ответ мог уже создать задание: перечитываем owner job list,
    // чтобы панель увидела его и не дала начать вторую сборку другим ключом.
    onError: (error, variables) => {
      if (isUncertainSubmitError(error)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.fullBookExportLatestJob(variables.owner) })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: ({ jobId }: { owner: string; jobId: string }) => cancelBookExportV2Job(jobId),
    onSuccess: storeJob,
  })
  const retryMutation = useMutation({
    mutationFn: ({ jobId }: { owner: string; jobId: string }) => retryBookExportV2Job(jobId),
    onSuccess: storeJob,
  })
  const downloadMutation = useMutation({
    mutationFn: ({ jobId }: { owner: string; jobId: string }) => downloadFullBookFile(jobId),
  })

  // Ошибка действия принадлежит заданию, над которым оно выполнялось: после
  // «Скрыть» и нового задания ошибка прежнего не показывается и не прячет кнопки.
  const scopedActionError = (mutation: { error: unknown; variables?: { jobId: string } }): unknown =>
    mutation.error && job && mutation.variables?.jobId === job.job_id ? mutation.error : null
  const cancelError = scopedActionError(cancelMutation)
  const retryError = scopedActionError(retryMutation)
  const downloadError = scopedActionError(downloadMutation)

  const { mutate: findPeriodMutate } = findPeriodMutation
  const { mutateAsync: submitMutateAsync } = submitMutation
  const { mutate: cancelMutate } = cancelMutation
  const { mutate: retryMutate } = retryMutation
  const { mutate: downloadMutate } = downloadMutation
  const draft = draftState && draftState.owner === owner ? draftState.draft : null

  const findPeriod = useCallback(
    (period: FullBookPeriod) => {
      setDraftState(null)
      if (owner) findPeriodMutate({ owner, period })
    },
    [findPeriodMutate, owner],
  )

  // Двойной клик и повторный вызов до ответа не создают второе задание:
  // сам запрос защищён ключом идемпотентности, а здесь — от второй операции.
  const submit = useCallback(
    async (settings: BookSettings) => {
      if (!owner || !draft || submitLockRef.current || isFullBookJobActive(job)) return
      submitLockRef.current = true
      const locale = toBookLocale()
      const signature = JSON.stringify({ draft, settings, locale })
      if (submissionRef.current?.owner !== owner || submissionRef.current.signature !== signature) {
        submissionRef.current = { owner, signature,
          options: { draft, settings: structuredClone(settings), locale,
            operationKey: createFullBookOperationKey(), checkpoint: {},
            assertOwner: () => {
              if (ownerRef.current !== owner) throw new ApiError(403, 'BOOK_EXPORT_OWNER_CHANGED')
            } } }
      }
      const operation = submissionRef.current
      try {
        await submitMutateAsync({ owner, options: operation.options })
        if (submissionRef.current === operation) submissionRef.current = null
      } catch (error) {
        // A lost response can already have created the job. Manual retries must
        // keep both its idempotency key and the exact frozen selection/body.
        if (!isUncertainSubmitError(error) && submissionRef.current === operation) submissionRef.current = null
        throw error
      } finally {
        submitLockRef.current = false
      }
    },
    [draft, job, owner, submitMutateAsync],
  )

  const cancel = useCallback(() => {
    if (owner && job && isFullBookJobActive(job) && job.status !== 'cancel_requested') cancelMutate({ owner, jobId: job.job_id })
  }, [cancelMutate, job, owner])

  const retry = useCallback(() => {
    if (owner && job && job.status === 'failed' && job.retryable) retryMutate({ owner, jobId: job.job_id })
  }, [job, owner, retryMutate])

  const download = useCallback(() => {
    if (owner && job && isFullBookJobDownloadable(job)) downloadMutate({ owner, jobId: job.job_id })
  }, [downloadMutate, job, owner])

  // Скрыть можно завершённое задание и задание, которого больше нет на сервере.
  const dismiss = useCallback(() => {
    if (owner && jobId && (isJobMissing || !isFullBookJobActive(job))) dismissJobPref(owner, jobId)
  }, [dismissJobPref, isJobMissing, job, jobId, owner])

  const clearDraft = useCallback(() => setDraftState(null), [])

  return useMemo(
    () => ({
      capabilityState: !canQuery
        ? ('unavailable' as const)
        : capabilitiesQuery.isPending
          ? ('loading' as const)
          : isAvailable
            ? ('available' as const)
            : ('unavailable' as const),
      isAvailable: canQuery && isAvailable,
      savedPeriod: prefs?.yearFrom && prefs?.yearTo ? { yearFrom: prefs.yearFrom, yearTo: prefs.yearTo } : null,
      draft,
      isFindingPeriod: findPeriodMutation.isPending,
      findPeriodError: findPeriodMutation.error,
      findPeriod,
      clearDraft,
      isSubmitting: submitMutation.isPending,
      submitError: submitMutation.error,
      submit,
      job,
      isObservingJob,
      isJobMissing,
      isReconnecting,
      isCancelling: cancelMutation.isPending,
      cancelError,
      cancel,
      isRetrying: retryMutation.isPending,
      retryError,
      retry,
      isDownloading: downloadMutation.isPending,
      downloadError,
      download,
      dismiss,
    }),
    [
      canQuery,
      capabilitiesQuery.isPending,
      isAvailable,
      prefs?.yearFrom,
      prefs?.yearTo,
      draft,
      findPeriodMutation.isPending,
      findPeriodMutation.error,
      findPeriod,
      clearDraft,
      submitMutation.isPending,
      submitMutation.error,
      submit,
      job,
      isObservingJob,
      isJobMissing,
      isReconnecting,
      cancelMutation.isPending,
      cancelError,
      cancel,
      retryMutation.isPending,
      retryError,
      retry,
      downloadMutation.isPending,
      downloadError,
      download,
      dismiss,
    ],
  )
}

export type FullBookExportController = ReturnType<typeof useFullBookExport>
