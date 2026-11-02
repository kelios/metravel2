import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

/** Safari на iPhone/iPad/Mac — без Chrome/Firefox/Edge на WebKit и без Android. */
export const isAppleSafariUserAgent = (userAgent: string): boolean =>
  /Safari\//.test(userAgent)
  && !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|EdgA|Edg\/|OPR|Android)/.test(userAgent)

/**
 * #2898: первичная соц-кнопка по платформе — Apple на iOS и в Safari, Google
 * на Android и прочих браузерах. На web решение принимается после гидратации:
 * статический HTML не знает браузер, и одинаковый первый рендер не даёт
 * расхождения гидратации (на Safari кнопки меняются местами после монтирования).
 */
export function usePreferAppleSignIn(): boolean {
  const [preferApple, setPreferApple] = useState(Platform.OS === 'ios')
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return
    setPreferApple(isAppleSafariUserAgent(navigator.userAgent || ''))
  }, [])
  return preferApple
}
