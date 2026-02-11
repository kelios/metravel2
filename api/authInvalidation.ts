type AuthInvalidationHandler = () => void

let authInvalidationHandler: AuthInvalidationHandler | null = null

export const setAuthInvalidationHandler = (handler: AuthInvalidationHandler | null) => {
  authInvalidationHandler = handler
}

export const notifyAuthInvalidation = () => {
  authInvalidationHandler?.()
}

