import { Alert, Platform } from 'react-native'
import { translate as i18nT } from '@/i18n'

import { requestConfirmDialog } from '@/components/ui/confirmDialogStore'


type ConfirmActionOptions = {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}

export async function confirmAction({
  title,
  message,
  confirmText = i18nT('shared:utils.confirmAction.podtverdit_bceede58'),
  cancelText = i18nT('shared:utils.confirmAction.otmena_719687da'),
}: ConfirmActionOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    // #1556: на web подтверждение идёт через дизайн-системный `ConfirmDialog`
    // (`ConfirmDialogHost`), а не через нативный `window.confirm`: тот синхронно
    // морозил JS-поток вкладки до закрытия окна. Если корневой хост ещё не
    // подписался во время initial commit, `requestConfirmDialog` дождётся его
    // или безопасно резолвит `false`; прежний дефолт `true` выполнял действие
    // без спроса.
    return requestConfirmDialog({ title, message, confirmText, cancelText })
  }

  return await new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}
