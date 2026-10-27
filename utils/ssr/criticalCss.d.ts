export const SHARED_CSS_URL_DIR: string
export const SSR_CRITICAL_CSS_ENV: string
export function isSharedCriticalCssFile(fileName: unknown): fileName is string
export function resolveSsrCriticalCssHref(env?: Record<string, string | undefined>): string | null
