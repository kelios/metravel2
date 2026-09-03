type BackCapableRouter = {
  back: () => void
  canGoBack?: () => boolean
  replace: (href: never) => void
}

/**
 * Единственный способ увести пользователя «назад».
 *
 * Сначала пробуем настоящую историю переходов — #573: «Назад» обязан вернуть на
 * экран, откуда пришли (список, поиск, лента), а не на закреплённый экран
 * раздела. На прямом входе по ссылке или в свежей вкладке истории нет, и голый
 * `router.back()` на web уводит с сайта — тогда идём на запасной экран (#1725).
 */
export function goBackOrReplace(router: BackCapableRouter, fallbackPath: string = '/'): void {
  if (typeof router.canGoBack === 'function' && router.canGoBack()) {
    router.back()
    return
  }

  router.replace(fallbackPath as never)
}
