import { Platform } from 'react-native'

export const isIos = Platform.OS === 'ios'
export const isAndroid = Platform.OS === 'android'
export const isWeb = Platform.OS === 'web'

export const webTouchScrollStyle = Platform.OS === 'web'
  ? ({
      flex: 1,
      minHeight: 0,
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      overscrollBehaviorY: 'contain',
    } as any)
  : undefined
