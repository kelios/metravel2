type BackCapableRouter = {
  back: () => void
  canGoBack?: () => boolean
  replace: (href: never) => void
  push?: (href: never) => void
}

type GoBackOptions = {
  /**
   * Как открывать запасной экран, когда истории нет. По умолчанию `replace`:
   * пустая история значит, что текущий экран — первый, и «Назад» с него не
   * должен оставлять его в стеке. `push` — для экранов, где запасной путь
   * сознательно кладётся поверх (каталог поездок, #1727).
   */
  fallbackMode?: 'replace' | 'push'
}

/**
 * Единственный способ увести пользователя «назад».
 *
 * Сначала пробуем настоящую историю переходов — #573: «Назад» обязан вернуть на
 * экран, откуда пришли (список, поиск, лента), а не на закреплённый экран
 * раздела. На прямом входе по ссылке или в свежей вкладке истории нет, и голый
 * `router.back()` на web уводит с сайта — тогда идём на запасной экран (#1725).
 *
 * Рукописная копия `canGoBack() ? back() : replace(...)` вне этого файла
 * запрещена — её ловит `scripts/guard-no-inline-back-navigation.js` (#1727).
 */
export function goBackOrReplace(
  router: BackCapableRouter,
  fallbackPath: string = '/',
  options: GoBackOptions = {},
): void {
  if (typeof router.canGoBack === 'function' && router.canGoBack()) {
    router.back()
    return
  }

  if (options.fallbackMode === 'push' && typeof router.push === 'function') {
    router.push(fallbackPath as never)
    return
  }
  router.replace(fallbackPath as never)
}
