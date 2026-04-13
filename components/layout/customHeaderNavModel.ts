import { Platform } from 'react-native'

import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'

export const handleHeaderNavPress = (
  router: { push: (path: any) => void },
  path: string,
  external?: boolean,
) => {
  if (external) {
    if (Platform.OS === 'web') {
      openExternalUrlInNewTab(path)
    } else {
      openExternalUrl(path)
    }
    return
  }

  router.push(path as any)
}
