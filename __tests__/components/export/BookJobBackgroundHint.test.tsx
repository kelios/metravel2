import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import BookJobBackgroundHint from '@/components/export/book-job/BookJobBackgroundHint'

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn() } }))
let mockOwner: string | null = 'owner-1'
const mockPush = jest.fn()
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => mockOwner }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
const mockedGet = apiClient.get as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockOwner = 'owner-1'
})

it('uses the account email for delivery even without a newsletter subscription', async () => {
  mockedGet.mockResolvedValue({ subscribed: false, email: 'reader@example.test' })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(<QueryClientProvider client={client}><BookJobBackgroundHint jobId="job-1" showLink /></QueryClientProvider>)
  await waitFor(() => expect(screen.getByText(/reader@example.test/)).toBeTruthy())
  expect(mockedGet).toHaveBeenCalledWith('/subscribe/status/')
  fireEvent.press(screen.getByText('Открыть страницу книги'))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/book-exports/[job_id]', params: { job_id: 'job-1' } })
})

it('does not retain the previous owner email after an account switch', async () => {
  mockedGet.mockResolvedValueOnce({ subscribed: true, email: 'old@example.test' })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const view = () => <QueryClientProvider client={client}><BookJobBackgroundHint jobId="job-1" /></QueryClientProvider>
  const { rerender } = render(view())
  await waitFor(() => expect(screen.getByText(/old@example.test/)).toBeTruthy())
  mockedGet.mockReturnValue(new Promise(() => undefined))
  mockOwner = 'owner-2'
  rerender(view())
  expect(screen.queryByText(/old@example.test/)).toBeNull()
  expect(screen.getByText(/на почту аккаунта/)).toBeTruthy()
})

it('does not promise background delivery or fetch an address for a terminal panel link', () => {
  const client = new QueryClient()
  render(<QueryClientProvider client={client}><BookJobBackgroundHint jobId="job-1" showLink showBackground={false} /></QueryClientProvider>)
  expect(screen.getByText('Открыть страницу книги')).toBeTruthy()
  expect(screen.queryByText(/Сборка идёт в фоне/)).toBeNull()
  expect(mockedGet).not.toHaveBeenCalled()
})
