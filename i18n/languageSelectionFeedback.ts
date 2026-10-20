import { translate } from '@/i18n'
import { showToast } from '@/utils/toast'

export const showProfileLanguageSyncError = (): void => {
  void showToast({
    type: 'error',
    text1: translate('common:language.syncErrorTitle'),
    text2: translate('common:language.syncErrorDescription'),
    visibilityTime: 6000,
  }).catch(() => {})
}

export const showLocaleSelectionError = (): void => {
  void showToast({
    type: 'error',
    text1: translate('common:feedback.actionError'),
    visibilityTime: 4000,
  }).catch(() => {})
}
