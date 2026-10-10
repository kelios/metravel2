// #2357 F2: панель статуса полной книги — реальные счётчики без выдуманного
// процента, действия только для допустимых состояний сервера.

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import type { BookExportV2Job } from '@/api/bookExportApi'
import { ApiError } from '@/api/clientErrors'
import FullBookJobStatus from '@/components/export/FullBookJobStatus'
import type { FullBookExportController } from '@/hooks/useFullBookExport'

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

const makeController = (job: BookExportV2Job | null, overrides: Partial<FullBookExportController> = {}) =>
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
  }) as unknown as FullBookExportController

describe('FullBookJobStatus', () => {
  it('keeps a visible observation error before any job detail is available', () => {
    render(<FullBookJobStatus controller={makeController(null, { isObservingJob: true, isReconnecting: true })} />)
    expect(screen.getByText('Нет связи с сервером — проверяем последнее задание повторно.')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText('Скачать PDF')).toBeNull()
  })
  it('shows real page progress and only a cancel action while building', () => {
    const controller = makeController(makeJob())
    render(<FullBookJobStatus controller={controller} />)

    expect(screen.getByText('Идёт сборка · Сборка страниц')).toBeTruthy()
    expect(screen.getByText('Страницы: 40 из 139')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(screen.queryByText('Скачать PDF')).toBeNull()

    fireEvent.press(screen.getByText('Отменить сборку'))
    expect(controller.cancel).toHaveBeenCalledTimes(1)
  })

  it('does not invent a percentage when the server does not know the total', () => {
    const job = makeJob({
      stage: 'snapshot',
      counters: {
        travels: { expected: null, completed: 4 },
        blocks: { expected: null, completed: 0 },
        mediaOccurrences: { expected: null, completed: 31 },
        pages: { expected: null, completed: 0 },
      },
    })
    render(<FullBookJobStatus controller={makeController(job)} />)

    expect(screen.getByText('Путешествия: 4')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/Страницы/)).toBeNull()
  })

  it('offers download only for a confirmed complete book', () => {
    const job = makeJob({
      status: 'done',
      stage: 'done',
      completeness: 'complete',
      expires_at: '2026-10-17T10:00:00Z',
      download: { available: true, size_bytes: 128_717_117, checksum: 'c' },
    })
    const controller = makeController(job)
    render(<FullBookJobStatus controller={controller} />)

    fireEvent.press(screen.getByText('Скачать PDF'))
    expect(controller.download).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Отменить сборку')).toBeNull()
    expect(screen.getByText('Скрыть')).toBeTruthy()
  })

  it('offers retry for a retryable failure and explains the reconnect state', () => {
    const failed = makeController(makeJob({ status: 'failed', retryable: true, error_code: 'REBUILD_REQUIRED' }))
    render(<FullBookJobStatus controller={failed} />)
    expect(screen.getByText('Материалы книги больше не хранятся. Соберите книгу заново.')).toBeTruthy()
    fireEvent.press(screen.getByText('Повторить'))
    expect(failed.retry).toHaveBeenCalledTimes(1)

    screen.unmount()
    render(<FullBookJobStatus controller={makeController(makeJob(), { isReconnecting: true })} />)
    expect(screen.getByText('Нет связи с сервером — переподключаемся. Сборка продолжается на сервере.')).toBeTruthy()
  })

  it('stops offering retry once the server answers REBUILD_REQUIRED', () => {
    const retryError = new ApiError(409, 'Rebuild', { error_code: 'REBUILD_REQUIRED' })
    const failed = makeController(makeJob({ status: 'failed', retryable: true, error_code: 'RENDER_FAILED' }), { retryError })
    render(<FullBookJobStatus controller={failed} />)
    expect(screen.getByText('Материалы книги больше не хранятся. Соберите книгу заново.')).toBeTruthy()
    expect(screen.queryByText('Повторить')).toBeNull()
    expect(screen.queryByText('Не удалось выполнить действие. Попробуйте ещё раз.')).toBeNull()
    expect(screen.getByText('Скрыть')).toBeTruthy()
  })
})
