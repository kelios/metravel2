import { Alert, Platform } from 'react-native'

type ConfirmActionOptions = {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}

export async function confirmAction({
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
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
