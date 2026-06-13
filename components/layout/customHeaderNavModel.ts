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

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const target = new URL(path, window.location.origin)
    if (target.pathname !== window.location.pathname || target.search !== window.location.search) {
      window.location.assign(target.pathname + target.search + target.hash)
      return
    }
  }

  router.push(path as any)
}
