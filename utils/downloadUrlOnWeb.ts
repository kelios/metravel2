import { getSafeExternalUrl } from '@/utils/safeExternalUrl'

type DownloadUrlOnWebOptions = {
  allowRelative?: boolean
  baseUrl?: string
  filename?: string
}

export function downloadUrlOnWeb(rawUrl: string, options: DownloadUrlOnWebOptions = {}): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false

  const normalized = getSafeExternalUrl(rawUrl, {
    allowRelative: options.allowRelative ?? false,
    baseUrl: options.baseUrl ?? window.location.origin,
  })

  if (!normalized) return false

  const anchor = document.createElement('a')
  anchor.href = normalized
  anchor.rel = 'noopener'
  anchor.download = options.filename ?? ''
  anchor.style.display = 'none'

  document.body.appendChild(anchor)
  try {
    anchor.click()
    return true
  } finally {
    document.body.removeChild(anchor)
  }
}
