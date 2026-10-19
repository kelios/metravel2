import { APP_STORE_LISTING_URLS, type AppStorePlatform } from '@/constants/appStore'
import { openExternalUrl } from '@/utils/externalLinks'
import { trackAppDownloadClicked, type AppDownloadSource } from '@/utils/growthFunnelAnalytics'

/** Переход в витрину приложения: одна цель аналитики и один адрес на стор. */
export function openAppStoreListing({
  platform,
  source,
}: {
  platform: AppStorePlatform
  source: AppDownloadSource
}): Promise<boolean> {
  trackAppDownloadClicked({ source, platform })
  return openExternalUrl(APP_STORE_LISTING_URLS[platform], {
    onError: (error) => {
      if (__DEV__) console.warn(`[app-download:${source}] Ошибка открытия витрины ${platform}:`, error)
    },
  })
}
