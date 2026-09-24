// #2107: nginx отдаёт на /quests/<неизвестный алиас> один статический
// `+not-found.html` (error_page 404). Пока чанк города ещё не в кэше вкладки,
// роутер на кадре гидратации этот экран не рисует и расхождения нет. В тёплой
// вкладке чанк уже скачан, первый кадр — лендинг города (шапка, «No Such
// City X»), и React кидает #418, потому что в HTML — экран «Страница не
// найдена».
//
// Скрипт срабатывает до entry-бандла. Холодный заход не трогаем: он и так
// совпадает с HTML, а подмена адреса мигала бы в строке. Флаг в sessionStorage
// ставит предыдущий документ той же вкладки — ровно тот случай, когда HTTP-кэш
// чанков уже тёплый. На этот кадр адрес становится путём без своего маршрута,
// который рисует тот же экран, что и статический HTML.

export const UNKNOWN_CITY_HYDRATION_STASH = '__metravelHydrateAsNotFound'
export const UNKNOWN_CITY_HYDRATION_PATH = '/__ssr_not_found'
export const UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID = 'static-not-found'
export const UNKNOWN_CITY_HYDRATION_BOOT_KEY = 'mt:ssr-doc-booted'

export function normalizeCityHydrationPath(pathname: string): string {
  let path = String(pathname || '')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  return path || '/'
}

/** Один сегмент под /quests/: известный город имеет свой HTML и этого маркера не несёт. */
export function isUnknownCityDocumentPath(pathname: string): boolean {
  return /^\/quests\/[^/]+$/.test(normalizeCityHydrationPath(pathname))
}

type StashWindow = Record<string, unknown> | null | undefined

export function takeUnknownCityHydrationPath(win: StashWindow): string | null {
  if (!win) return null
  const value = win[UNKNOWN_CITY_HYDRATION_STASH]
  try {
    delete win[UNKNOWN_CITY_HYDRATION_STASH]
  } catch {
    win[UNKNOWN_CITY_HYDRATION_STASH] = ''
  }
  if (typeof value !== 'string' || !value.startsWith('/quests/')) return null
  const pathname = value.split('#')[0]?.split('?')[0] ?? ''
  if (!isUnknownCityDocumentPath(pathname)) return null
  return value
}

export function buildUnknownCityNotFoundHydrationScript(): string {
  const elementId = JSON.stringify(UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID)
  const stashKey = JSON.stringify(UNKNOWN_CITY_HYDRATION_STASH)
  const hydrationPath = JSON.stringify(UNKNOWN_CITY_HYDRATION_PATH)
  const bootKey = JSON.stringify(UNKNOWN_CITY_HYDRATION_BOOT_KEY)
  return `(function(){
try {
  var booted = false;
  try { booted = window.sessionStorage.getItem(${bootKey}) === '1'; } catch (e) {}
  try { window.sessionStorage.setItem(${bootKey}, '1'); } catch (e) {}
  if (!booted) return;
  if (!window.history || typeof window.history.replaceState !== 'function') return;
  if (!document.getElementById(${elementId})) return;
  var path = String(window.location && window.location.pathname || '');
  if (path.length > 1) path = path.replace(/\\/+$/, '');
  if (!/^\\/quests\\/[^/]+$/.test(path)) return;
  window[${stashKey}] = path + String(window.location.search || '') + String(window.location.hash || '');
  window.history.replaceState(window.history.state, '', ${hydrationPath});
} catch (e) {}
})();`
}
