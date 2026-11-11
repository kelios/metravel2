// Путь экрана, с которого пользователь перешёл на текущий. Нужен форме
// контактов (#3284): по письму «присоедините нас к квесту» не было видно, с
// какой страницы человек пришёл. Хранится только pathname — без query и hash,
// чтобы в письмо не попадали поисковые запросы и токены из ссылок.

let currentPath: string | null = null
let previousPath: string | null = null

const MAX_PATH_LENGTH = 300

function normalizePath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value.split(/[?#]/)[0].trim()
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return path.slice(0, MAX_PATH_LENGTH)
}

export function recordVisitedPath(pathname: unknown): void {
  const path = normalizePath(pathname)
  if (!path || path === currentPath) return
  previousPath = currentPath
  currentPath = path
}

/** Экран, открытый перед текущим, или `null`, если текущий — первый в сессии. */
export function getPreviousVisitedPath(): string | null {
  return previousPath
}

/**
 * Откуда пользователь пришёл на текущий экран: предыдущий экран приложения, а
 * при прямой загрузке страницы на web — путь `document.referrer` того же сайта.
 * Внешний реферер (поисковик, соцсеть) не возвращается.
 */
export function resolveSourcePath(): string | null {
  if (previousPath) return previousPath
  if (typeof document === 'undefined' || typeof window === 'undefined') return null
  try {
    const referrer = document.referrer
    if (!referrer) return null
    const url = new URL(referrer)
    if (url.origin !== window.location.origin) return null
    const path = normalizePath(url.pathname)
    return path && path !== currentPath ? path : null
  } catch {
    return null
  }
}

export function resetNavigationTrailForTests(): void {
  currentPath = null
  previousPath = null
}
