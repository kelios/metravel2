// #2357 F2: панель статуса полной книги — реальные счётчики без выдуманного
// процента, действия только для допустимых состояний сервера.

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import type { BookExportV2Job } from '@/api/bookExportApi'
import { ApiError } from '@/api/clientErrors'
import FullBookJobStatus, { type FullBookJobStatusController } from '@/components/export/FullBookJobStatus'

jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => 'owner-1' }))

const makeJob = (overrides: Partial<BookExportV2Job> = {}): BookExportV2Job => ({
  job_id: 'job-1',
  status: 'running',
  stage: 'render',
  counters: {
    travels: { expected: 23, completed: 23 },
    blocks: { expected: 400, completed: 120 },
    mediaOccurrences: { expected: 596, completed: 200 },
    pages: { expected: 139, completed: 40 },
  },
  snapshot_hash: 'snap',
  settings_hash: 's',
  completeness: 'pending',
  error_code: '',
  retryable: false,
  expires_at: null,
  download: null,
  snapshot_state: 'frozen',
  artifact_url: null,
  ...overrides,
})

const makeController = (job: BookExportV2Job | null, overrides: Partial<FullBookJobStatusController> = {}): FullBookJobStatusController =>
  ({
    job,
    isJobMissing: false,
    isObservingJob: false,
    isReconnecting: false,
    isCancelling: false,
    cancelError: null,
    cancel: jest.fn(),
    isRetrying: false,
    retryError: null,
    retry: jest.fn(),
    isDownloading: false,
    downloadError: null,
    download: jest.fn(),
    dismiss: jest.fn(),
    ...overrides,
  })

describe('FullBookJobStatus', () => {
  it('keeps expired ticket output unavailable with an explicit route to rebuilding', async () => {
    const job = makeJob({ status: 'done', completeness: 'complete', download: { available: true, size_bytes: 100, checksum: 'c' } })
    const downloadError = new ApiError(410, 'expired', { error_code: 'JOB_EXPIRED' })
    await render(<FullBookJobStatus controller={makeController(job, { downloadError })} dismissLabel="Перейти к экспорту" />)
    expect(screen.queryByText('Скачать PDF')).toBeNull()
    expect(screen.getByText('Перейти к экспорту')).toBeTruthy()
  })

  it('does not offer retry when the job itself requires rebuilding', async () => {
    const job = makeJob({ status: 'failed', retryable: true, error_code: 'REBUILD_REQUIRED' })
    await render(<FullBookJobStatus controller={makeController(job)} showErrorCode />)
    expect(screen.getByText('Код ошибки: REBUILD_REQUIRED')).toBeTruthy()
    expect(screen.queryByText('Повторить')).toBeNull()
  })

  it('keeps a visible observation error before any job detail is available', async () => {
    await render(<FullBookJobStatus controller={makeController(null, { isObservingJob: true, isReconnecting: true })} />)
    expect(screen.getByText('Нет связи с сервером — проверяем последнее задание повторно.')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText('Скачать PDF')).toBeNull()
  })
  it('shows real page progress and only a cancel action while building', async () => {
    const controller = makeController(makeJob())
    await render(<FullBookJobStatus controller={controller} />)

    expect(screen.getByText('Идёт сборка · Сборка страниц')).toBeTruthy()
    expect(screen.getByText('Страницы: 40 из 139')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(screen.queryByText('Скачать PDF')).toBeNull()

    await fireEvent.press(screen.getByText('Отменить сборку'))
    expect(controller.cancel).toHaveBeenCalledTimes(1)
  })

  it('shows Lambda runtime stages as the same phases with page progress (#2391)', async () => {
    const { unmount } = await render(<FullBookJobStatus controller={makeController(makeJob({ stage: 'lambda_render' }))} />)
    expect(screen.getByText('Идёт сборка · Сборка страниц')).toBeTruthy()
    expect(screen.getByText('Страницы: 40 из 139')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    await unmount()

    await render(<FullBookJobStatus controller={makeController(makeJob({ stage: 'awaiting_lambda' }))} />)
    expect(screen.getByText('Идёт сборка · Ожидание сборки страниц')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('does not invent a percentage when the server does not know the total', async () => {
    const job = makeJob({
      stage: 'snapshot',
      counters: {
        travels: { expected: null, completed: 4 },
        blocks: { expected: null, completed: 0 },
        mediaOccurrences: { expected: null, completed: 31 },
        pages: { expected: null, completed: 0 },
      },
    })
    await render(<FullBookJobStatus controller={makeController(job)} />)

    expect(screen.getByText('Путешествия: 4')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/Страницы/)).toBeNull()
  })

  it('offers download only for a confirmed complete book', async () => {
    const job = makeJob({
      status: 'done',
      stage: 'done',
      completeness: 'complete',
      expires_at: '2026-10-17T10:00:00Z',
      download: { available: true, size_bytes: 128_717_117, checksum: 'c' },
    })
    const controller = makeController(job)
    await render(<FullBookJobStatus controller={controller} />)

    await fireEvent.press(screen.getByText('Скачать PDF'))
    expect(controller.download).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Отменить сборку')).toBeNull()
    expect(screen.getByText('Скрыть')).toBeTruthy()
  })

  it('offers retry for a retryable failure and explains the reconnect state', async () => {
    const failed = makeController(makeJob({ status: 'failed', retryable: true, error_code: 'RENDER_FAILED' }))
    await render(<FullBookJobStatus controller={failed} />)
    expect(screen.getByText('Сборка остановилась с ошибкой.')).toBeTruthy()
    await fireEvent.press(screen.getByText('Повторить'))
    expect(failed.retry).toHaveBeenCalledTimes(1)

    await screen.unmount()
    await render(<FullBookJobStatus controller={makeController(makeJob(), { isReconnecting: true })} />)
    expect(screen.getByText('Нет связи с сервером — переподключаемся. Сборка продолжается на сервере.')).toBeTruthy()
  })

  it('stops offering retry once the server answers REBUILD_REQUIRED', async () => {
    const retryError = new ApiError(409, 'Rebuild', { error_code: 'REBUILD_REQUIRED' })
    const failed = makeController(makeJob({ status: 'failed', retryable: true, error_code: 'RENDER_FAILED' }), { retryError })
    await render(<FullBookJobStatus controller={failed} />)
    expect(screen.getByText('Материалы книги больше не хранятся. Соберите книгу заново.')).toBeTruthy()
    expect(screen.queryByText('Повторить')).toBeNull()
    expect(screen.queryByText('Не удалось выполнить действие. Попробуйте ещё раз.')).toBeNull()
    expect(screen.getByText('Скрыть')).toBeTruthy()
  })
})
