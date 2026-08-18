import { translate as i18nT } from '@/i18n'
import { showToast } from '@/utils/toast'

/**
 * INV2-07: when an authenticated auth flow returns the visitor to the exact
 * place they came from (a saved intent/redirect), reassure them that whatever
 * they were doing is kept. Only fired for flows that actually establish a
 * session on success — social sign-in and email login — never for email
 * registration, which still needs email confirmation before a session exists.
 */
export const notifyAuthProgressSaved = (hasReturnContext: boolean): void => {
  if (!hasReturnContext) return
  void showToast({
    text1: i18nT('authStatic:authScreen.progressSaved'),
    type: 'success',
  })
}
