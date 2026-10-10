// #2357 F2: скачивание готовой полной книги по билету #2356.
//
// Билет короткоживущий и привязан к одному заданию владельца. Файл забирает сам
// браузер прямым GET — без Blob всей книги в памяти страницы, без печатного окна
// и без токена аккаунта в адресе. Адрес из ответа сервера принимается только в
// точной форме `<API>/exports/books/<job_id>/download/?ticket=…` на origin API.

import { API_BASE_URL } from '@/api/apiConfig'
import { requestBookExportDownloadTicket } from '@/api/bookExportApi'
import { startBrowserFileDownload } from '@/utils/externalLinks'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const resolveDefaultOrigin = (): string =>
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://metravel.by'

export function resolveBookDownloadUrl(
  rawUrl: string,
  jobId: string,
  apiBaseUrl: string = API_BASE_URL,
  pageOrigin: string = resolveDefaultOrigin(),
): string | null {
  try {
    const base = new URL(apiBaseUrl, pageOrigin)
    const url = new URL(String(rawUrl ?? '').trim(), `${base.origin}${base.pathname.replace(/\/*$/, '/')}`)
    if (url.origin !== base.origin) return null
    const secure = url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
    if (!secure || url.username || url.password || url.hash) return null
    const expectedPath = `${base.pathname.replace(/\/+$/, '')}/exports/books/${encodeURIComponent(jobId)}/download/`
    if (url.pathname !== expectedPath) return null
    const keys = Array.from(url.searchParams.keys())
    if (keys.length !== 1 || keys[0] !== 'ticket' || !url.searchParams.get('ticket')) return null
    return url.toString()
  } catch {
    return null
  }
}

export class BookDownloadTicketError extends Error {
  constructor() {
    super('BOOK_DOWNLOAD_TICKET_INVALID')
    this.name = 'BookDownloadTicketError'
  }
}

const isExpired = (expiresAt: string, now: number): boolean => {
  const time = Date.parse(expiresAt)
  return !Number.isFinite(time) || time <= now
}

// Новый билет на каждый клик: просроченный билет повторно не используется.
// Уже истёкший к моменту ответа билет (часы клиента/сервера) запрашивается ещё
// один раз; дальше — явная ошибка, а не тихий обходной путь.
export async function downloadFullBookFile(jobId: string, now: () => number = Date.now): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const ticket = await requestBookExportDownloadTicket(jobId)
    const url = resolveBookDownloadUrl(ticket.download_url, jobId)
    if (!url) throw new BookDownloadTicketError()
    if (isExpired(ticket.expires_at, now())) continue
    if (!startBrowserFileDownload(url)) throw new BookDownloadTicketError()
    return
  }
  throw new BookDownloadTicketError()
}
