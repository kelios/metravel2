import { Alert, Platform } from 'react-native'
import { translate as i18nT } from '@/i18n'


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
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message)
    }
    return true
  }

  return await new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ])
  })
}
