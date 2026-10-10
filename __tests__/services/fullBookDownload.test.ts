// #2357 F2: скачивание полной книги — только точный адрес билета на origin API,
// свежий билет на клик, без Blob и печатного окна.

import { apiClient } from '@/api/client'
import { startBrowserFileDownload } from '@/utils/externalLinks'
import {
  BookDownloadTicketError,
  downloadFullBookFile,
  resolveBookDownloadUrl,
} from '@/services/book/fullBookDownload'

jest.mock('@/api/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}))

jest.mock('@/api/apiConfig', () => ({
  API_BASE_URL: 'https://metravel.by/api',
}))

jest.mock('@/utils/externalLinks', () => ({
  startBrowserFileDownload: jest.fn(() => true),
}))

const mockedPost = apiClient.post as jest.Mock
const mockedStart = startBrowserFileDownload as jest.Mock

const JOB = '1b2f8c70-3c9e-4a65-8f44-6f8a8e1c0d11'
const API = 'https://metravel.by/api'
const ORIGIN = 'https://metravel.by'
const ticketUrl = `https://metravel.by/api/exports/books/${JOB}/download/?ticket=signed.value`

describe('resolveBookDownloadUrl', () => {
  it('accepts the exact absolute or relative ticket address of the same job', () => {
    expect(resolveBookDownloadUrl(ticketUrl, JOB, API, ORIGIN)).toBe(ticketUrl)
    expect(resolveBookDownloadUrl(`/api/exports/books/${JOB}/download/?ticket=t`, JOB, API, ORIGIN)).toBe(
      `https://metravel.by/api/exports/books/${JOB}/download/?ticket=t`,
    )
    expect(resolveBookDownloadUrl(`exports/books/${JOB}/download/?ticket=t`, JOB, API, ORIGIN)).toBe(
      `https://metravel.by/api/exports/books/${JOB}/download/?ticket=t`,
    )
  })

  it('allows plain http only for the local development API', () => {
    expect(
      resolveBookDownloadUrl(
        `http://localhost:8000/api/exports/books/${JOB}/download/?ticket=t`,
        JOB,
        'http://localhost:8000/api',
        'http://localhost:8081',
      ),
    ).toBe(`http://localhost:8000/api/exports/books/${JOB}/download/?ticket=t`)
    expect(resolveBookDownloadUrl(`http://metravel.by/api/exports/books/${JOB}/download/?ticket=t`, JOB, API, ORIGIN)).toBeNull()
  })

  it.each([
    ['foreign origin', `https://evil.example/api/exports/books/${JOB}/download/?ticket=t`],
    ['another job', `https://metravel.by/api/exports/books/other/download/?ticket=t`],
    ['missing ticket', `https://metravel.by/api/exports/books/${JOB}/download/`],
    ['empty ticket', `https://metravel.by/api/exports/books/${JOB}/download/?ticket=`],
    ['extra parameter', `https://metravel.by/api/exports/books/${JOB}/download/?ticket=t&token=x`],
    ['repeated ticket', `https://metravel.by/api/exports/books/${JOB}/download/?ticket=a&ticket=b`],
    ['credentials', `https://user:pass@metravel.by/api/exports/books/${JOB}/download/?ticket=t`],
    ['fragment', `https://metravel.by/api/exports/books/${JOB}/download/?ticket=t#x`],
    ['other path', `https://metravel.by/api/exports/books/${JOB}/?ticket=t`],
    ['script scheme', 'javascript:alert(1)'],
  ])('rejects %s', (_label, raw) => {
    expect(resolveBookDownloadUrl(raw, JOB, API, ORIGIN)).toBeNull()
  })
})

describe('downloadFullBookFile', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedStart.mockReset().mockReturnValue(true)
  })

  it('requests a fresh ticket and hands the validated address to the browser', async () => {
    mockedPost.mockResolvedValueOnce({ download_url: ticketUrl, expires_at: '2026-10-10T12:05:00Z' })

    await downloadFullBookFile(JOB, () => Date.parse('2026-10-10T12:00:00Z'))

    expect(mockedPost).toHaveBeenCalledWith(`/exports/books/${JOB}/download-ticket/`, {})
    expect(mockedStart).toHaveBeenCalledWith(ticketUrl)
  })

  it('replaces an already expired ticket once instead of using it', async () => {
    mockedPost
      .mockResolvedValueOnce({ download_url: ticketUrl, expires_at: '2026-10-10T11:59:00Z' })
      .mockResolvedValueOnce({ download_url: ticketUrl, expires_at: '2026-10-10T12:05:00Z' })

    await downloadFullBookFile(JOB, () => Date.parse('2026-10-10T12:00:00Z'))

    expect(mockedPost).toHaveBeenCalledTimes(2)
    expect(mockedStart).toHaveBeenCalledTimes(1)
  })

  it('fails closed on an unexpected address without starting a download', async () => {
    mockedPost.mockResolvedValueOnce({
      download_url: `https://evil.example/api/exports/books/${JOB}/download/?ticket=t`,
      expires_at: '2026-10-10T12:05:00Z',
    })

    await expect(downloadFullBookFile(JOB, () => Date.parse('2026-10-10T12:00:00Z'))).rejects.toBeInstanceOf(
      BookDownloadTicketError,
    )
    expect(mockedStart).not.toHaveBeenCalled()
  })
})
