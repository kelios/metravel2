import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import type { BookExportV2Job } from '@/api/bookExportApi'
import BookExportJobPage, { normalizeBookJobId } from '@/components/export/book-job/BookExportJobPage'

const JOB = '1b2f8c70-3c9e-4a65-8f44-6f8a8e1c0d11'
let mockJobId: string | string[] | undefined = JOB
let mockAuth = { authReady: true, isAuthenticated: true }
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockRouter = { push: mockPush, replace: mockReplace }
const mockSeo = jest.fn((_props: unknown) => null)
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ job_id: mockJobId }),
  useIsFocused: () => true,
  useRouter: () => mockRouter,
}))
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => 'owner-1' }))
jest.mock('@/hooks/useBookExportJob', () => ({ useBookExportJob: () => mockController }))
jest.mock('@/components/layout/ScreenHeaderContext', () => ({ useScreenHeader: (config: unknown) => config }))
jest.mock('@/components/layout/bottomChromeInset', () => ({
  ...jest.requireActual('@/components/layout/bottomChromeInset'),
  useScrollBottomPadding: () => 16,
}))
jest.mock('@/components/layout/ResponsiveContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/components/ui/ScreenHeader', () => ({
  __esModule: true,
  default: ({ header }: { header: { title: string } }) => {
    const { Text } = require('react-native')
    return <Text accessibilityRole="header">{header.title}</Text>
  },
}))
jest.mock('@/components/seo/LazyInstantSEO', () => ({ __esModule: true, default: (props: unknown) => mockSeo(props) }))
jest.mock('@/components/export/book-job/BookJobBackgroundHint', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text>background-email-hint</Text>
  },
}))
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

const makeJob = (overrides: Partial<BookExportV2Job> = {}): BookExportV2Job => ({
  job_id: JOB, status: 'running', stage: 'lambda_render',
  counters: { travels: { expected: 2, completed: 2 }, blocks: { expected: null, completed: 4 },
    mediaOccurrences: { expected: null, completed: 3 }, pages: { expected: 10, completed: 2 } },
  snapshot_hash: 'hash', settings_hash: 'hash', completeness: 'pending', error_code: '',
  retryable: false, expires_at: null, download: null, snapshot_state: 'frozen', artifact_url: null,
  ...overrides,
})
const makeController = () => ({
  job: makeJob() as BookExportV2Job | null,
  isJobMissing: false, isObservingJob: false, isReconnecting: false,
  refresh: jest.fn(), isCancelling: false, cancelError: null, cancel: jest.fn(),
  isRetrying: false, retryError: null, retry: jest.fn(),
  isDownloading: false, downloadError: null, download: jest.fn(),
})
let mockController = makeController()

beforeEach(() => {
  jest.clearAllMocks()
  Platform.OS = 'web'
  mockJobId = JOB
  mockAuth = { authReady: true, isAuthenticated: true }
  mockController = makeController()
})

it('keeps the exact email route through login rather than a build-pdf export intent', async () => {
  mockAuth.isAuthenticated = false
  render(<BookExportJobPage />)
  await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  const href = String(mockReplace.mock.calls[0][0])
  const parsed = new URL(href, 'https://metravel.by')
  expect(parsed.pathname).toBe('/login')
  expect(parsed.searchParams.get('redirect')).toBe(`/book-exports/${JOB}`)
  expect(parsed.searchParams.get('intent')).not.toBe('build-pdf')
})

it('does not redirect before authentication is ready', () => {
  mockAuth = { authReady: false, isAuthenticated: false }
  render(<BookExportJobPage />)
  expect(mockReplace).not.toHaveBeenCalled()
})

it('renders a private missing state without cached counters', () => {
  mockController.isJobMissing = true
  render(<BookExportJobPage />)
  expect(screen.getByText('Книга не найдена')).toBeTruthy()
  expect(screen.queryByText('Страницы: 2 из 10')).toBeNull()
})

it('shows background delivery and an active job using existing status rendering', () => {
  render(<BookExportJobPage />)
  expect(screen.getByText('Идёт сборка · Сборка страниц')).toBeTruthy()
  expect(screen.getByText('background-email-hint')).toBeTruthy()
  expect(screen.getByText('Страницы: 2 из 10')).toBeTruthy()
})

it('keeps incomplete done output unavailable and offers status refresh', () => {
  mockController.job = makeJob({ status: 'done', download: { available: false, checksum: null, size_bytes: null } })
  render(<BookExportJobPage />)
  expect(screen.queryByText('Скачать PDF')).toBeNull()
  fireEvent.press(screen.getByText('Обновить статус'))
  expect(mockController.refresh).toHaveBeenCalledTimes(1)
})

it('offers one refresh action when unavailable output also loses its server connection', () => {
  mockController.job = makeJob({ status: 'done', download: { available: false, checksum: null, size_bytes: null } })
  mockController.isReconnecting = true
  render(<BookExportJobPage />)
  expect(screen.getAllByText('Обновить статус')).toHaveLength(1)
  expect(screen.getByText('Файл пока недоступен. Обновите статус книги.')).toBeTruthy()
})

it('shows failed error code and the route to rebuilding without a retry for REBUILD_REQUIRED', () => {
  mockController.job = makeJob({ status: 'failed', error_code: 'REBUILD_REQUIRED', retryable: true })
  render(<BookExportJobPage />)
  expect(screen.getByText('Код ошибки: REBUILD_REQUIRED')).toBeTruthy()
  expect(screen.queryByText('Повторить')).toBeNull()
  fireEvent.press(screen.getByText('Перейти к экспорту'))
  expect(mockPush).toHaveBeenCalledWith('/export')
})

it('declares noindex metadata without private job ID or email', () => {
  render(<BookExportJobPage />)
  const props = mockSeo.mock.calls[0][0] as { robots: string; title: string; description: string }
  expect(props.robots).toBe('noindex, nofollow')
  expect(`${props.title} ${props.description}`).not.toContain(JOB)
})

it('accepts UUID route IDs and refuses repeated or malformed parameters', () => {
  expect(normalizeBookJobId(JOB.toUpperCase())).toBe(JOB)
  expect(normalizeBookJobId([JOB, JOB])).toBeNull()
  expect(normalizeBookJobId('../export')).toBeNull()
  expect(normalizeBookJobId(undefined)).toBeNull()
})
