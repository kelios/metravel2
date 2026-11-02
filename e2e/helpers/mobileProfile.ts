import { devices, type BrowserContextOptions } from '@playwright/test'

// #2928: единственный источник мобильного профиля e2e. Проект `chromium`
// наследует `Desktop Chrome` со `screen` 1920×1080; профиль, задающий только
// `viewport`, — «телефон» с десктопным экраном: HTML-парсер качает десктопный
// `<img src>` из `<picture>` и тут же отменяет его (ложные ERR_ABORTED, #2923).
// У реального телефона `screen` не меньше viewport, поэтому по умолчанию
// `screen` = viewport. Новые мобильные профили собираются только через этот
// хелпер — `__tests__/e2e/mobileProfileGuard.test.ts`.
// UA по умолчанию — Android Chrome: движок прогона Chromium, а iPhone-UA
// включает в приложении iOS WebKit-обходы (`ImageCardMediaWebHelpers`);
// iPhone-UA передаётся явно там, где сценарий проверяет именно его.

export const IPHONE_SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

type Size = { width: number; height: number }

// Дескрипторы `devices` несут `screen` в рантайме, но тип `DeviceDescriptor`
// его не объявляет — прямое `devices['iPhone 13'].screen` не проходит typecheck:e2e.
export const deviceScreen = (device: object): Size | undefined =>
  (device as { screen?: Size }).screen

export type MobileProfile = Required<
  Pick<BrowserContextOptions, 'viewport' | 'screen' | 'isMobile' | 'hasTouch' | 'deviceScaleFactor' | 'userAgent'>
>

export function mobileProfile(options: {
  viewport?: Size
  screen?: Size
  deviceScaleFactor?: number
  userAgent?: string
} = {}): MobileProfile {
  const viewport = options.viewport ?? { width: 390, height: 844 }
  return {
    viewport,
    screen: options.screen ?? viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: options.deviceScaleFactor ?? 3,
    userAgent: options.userAgent ?? devices['Pixel 7'].userAgent,
  }
}
