import { useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { cancelBookExportV2Job, getBookExportV2Job, retryBookExportV2Job, type BookExportV2Job } from '@/api/bookExportApi'
import { ApiError } from '@/api/clientErrors'
import { queryKeys } from '@/api/queryKeys'
import { FULL_BOOK_POLL_INTERVAL_MS, fullBookErrorCode, isFullBookJobActive, isFullBookJobDownloadable } from '@/hooks/useFullBookExport'
import { useQueryOwner } from '@/hooks/useQueryOwner'
import { downloadFullBookFile } from '@/services/book/fullBookDownload'
import { readRetryOnce } from '@/utils/queryRetryPolicy'

type Operation = { owner: string; jobId: string; action: 'cancel' | 'retry' | 'download' }
const isMissing = (error: unknown) => error instanceof ApiError && [403, 404].includes(error.status)
const requiresRefresh = (error: unknown) => ['JOB_EXPIRED', 'REBUILD_REQUIRED'].includes(fullBookErrorCode(error) ?? '')

export function useBookExportJob(jobId: string | null, enabled: boolean) {
  const owner = useQueryOwner()
  const queryClient = useQueryClient()
  const identity = useRef({ owner, jobId })
  identity.current = { owner, jobId }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const operationLock = useRef<Operation | null>(null)
  const canQuery = enabled && Boolean(owner && jobId)
  const jobQuery = useQuery({
    queryKey: queryKeys.fullBookExportJob(owner, jobId ?? ''),
    queryFn: async () => {
      const next = await getBookExportV2Job(jobId as string)
      if (next.job_id !== jobId) throw new ApiError(409, 'BOOK_EXPORT_JOB_MISMATCH')
      return next
    },
    enabled: canQuery,
    retry: readRetryOnce,
    staleTime: 0,
    refetchInterval: (query) => isMissing(query.state.error) ? false
      : isFullBookJobActive(query.state.data) || query.state.error ? FULL_BOOK_POLL_INTERVAL_MS : false,
  })
  const assertIdentity = useCallback((operation: Operation) => {
    if (!mounted.current || identity.current.owner !== operation.owner || identity.current.jobId !== operation.jobId) {
      throw new ApiError(403, 'BOOK_EXPORT_OWNER_CHANGED')
    }
  }, [])
  const mutation = useMutation({
    retry: false,
    mutationFn: async (operation: Operation): Promise<BookExportV2Job | null> => {
      try {
        assertIdentity(operation)
        if (operation.action === 'download') {
          await downloadFullBookFile(operation.jobId, Date.now, () => assertIdentity(operation))
          return null
        }
        const next = await (operation.action === 'cancel' ? cancelBookExportV2Job : retryBookExportV2Job)(operation.jobId)
        assertIdentity(operation)
        if (next.job_id !== operation.jobId) throw new ApiError(409, 'BOOK_EXPORT_JOB_MISMATCH')
        return next
      } finally {
        if (operationLock.current === operation) operationLock.current = null
      }
    },
    onSuccess: (next, operation) => {
      if (identity.current.owner !== operation.owner || identity.current.jobId !== operation.jobId) return
      if (next) queryClient.setQueryData(queryKeys.fullBookExportJob(operation.owner, operation.jobId), next)
      void queryClient.invalidateQueries({ queryKey: queryKeys.fullBookExportLatestJob(operation.owner) })
    },
    onError: (error, operation) => {
      if (identity.current.owner !== operation.owner || identity.current.jobId !== operation.jobId) return
      if (requiresRefresh(error) || isMissing(error)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.fullBookExportJob(operation.owner, operation.jobId) })
      }
    },
  })
  const currentOperation = mutation.variables?.owner === owner && mutation.variables.jobId === jobId ? mutation.variables : null
  const actionError = currentOperation ? mutation.error : null
  const isJobMissing = canQuery && (isMissing(jobQuery.error) || isMissing(actionError))
  const job = canQuery && !isJobMissing && jobQuery.data?.job_id === jobId ? jobQuery.data : null
  const run = (action: Operation['action']) => {
    if (!owner || !job || !canQuery || isJobMissing) return
    if (operationLock.current?.owner === owner && operationLock.current.jobId === jobId) return
    if (action === 'cancel' && (!isFullBookJobActive(job) || job.status === 'cancel_requested')) return
    if (action === 'retry' && (job.status !== 'failed' || !job.retryable || fullBookErrorCode(actionError) === 'REBUILD_REQUIRED')) return
    if (action === 'download' && (!isFullBookJobDownloadable(job) || requiresRefresh(actionError))) return
    const operation = { owner, jobId: job.job_id, action }
    operationLock.current = operation
    mutation.mutate(operation)
  }
  return {
    job,
    isJobMissing,
    isObservingJob: canQuery && !job && !isJobMissing,
    isReconnecting: canQuery && !isJobMissing && (jobQuery.fetchStatus === 'paused' || Boolean(jobQuery.error)),
    refresh: () => { if (canQuery) void jobQuery.refetch() },
    isCancelling: mutation.isPending && currentOperation?.action === 'cancel',
    cancelError: currentOperation?.action === 'cancel' ? actionError : null,
    cancel: () => run('cancel'),
    isRetrying: mutation.isPending && currentOperation?.action === 'retry',
    retryError: currentOperation?.action === 'retry' ? actionError : null,
    retry: () => run('retry'),
    isDownloading: mutation.isPending && currentOperation?.action === 'download',
    downloadError: currentOperation?.action === 'download' ? actionError : null,
    download: () => run('download'),
  }
}
