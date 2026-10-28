import { Platform } from 'react-native'

import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks'
import { pushInAppRoute } from '@/utils/travelCreateNavigation'

export const handleHeaderNavPress = (
  router: { push: (path: any) => void; setParams?: (params: Record<string, string | undefined>) => void },
  path: string,
  external?: boolean,
  pathname?: string,
) => {
  if (external) {
    if (Platform.OS === 'web') {
      openExternalUrlInNewTab(path)
    } else {
      openExternalUrl(path)
    }
    return
  }

  pushInAppRoute(router, path, pathname)
}
