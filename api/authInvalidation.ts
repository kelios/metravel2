type AuthInvalidationHandler = () => void

/**
 * Считает ли приложение себя залогиненным. Транспорту это нужно, чтобы
 * отличить ГОСТЯ — для которого анонимная запись легальна (телеметрия ответов и
 * карточка результата квеста принимаются бэкендом с `AllowAny`) — от сессии,
 * потерявшей токен, где такой же анонимный запрос теряет данные пользователя
 * и падает на CSRF (#1921).
 *
 * Отдельная регистрация, а не импорт стора: `stores/authStore` тянет за собой
 * api-слой, и обратный импорт замкнул бы цикл на инициализации модулей.
 */
type AuthSessionProbe = () => boolean

let authInvalidationHandler: AuthInvalidationHandler | null = null
let authSessionProbe: AuthSessionProbe | null = null

export const setAuthInvalidationHandler = (handler: AuthInvalidationHandler | null) => {
  authInvalidationHandler = handler
}

export const notifyAuthInvalidation = () => {
  authInvalidationHandler?.()
}

export const setAuthSessionProbe = (probe: AuthSessionProbe | null) => {
  authSessionProbe = probe
}

/**
 * Без зарегистрированной пробы отвечаем «гость»: неизвестность не должна
 * запрещать анонимную запись, которая работала и до #1921.
 */
export const appBelievesAuthenticated = (): boolean => authSessionProbe?.() ?? false
