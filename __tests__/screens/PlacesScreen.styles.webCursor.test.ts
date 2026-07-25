// Регресс на web-only стили /places, которые раньше протекали через `as any`.
// Каст отключал проверку целиком: опечатка в имени CSS-свойства или случайно
// уехавший в native web-only стиль прошли бы молча. Теперь тот же объект идёт
// через типизированный мостик utils/webProps.ts, а тест фиксирует, что видимое
// поведение не изменилось: курсор-указатель на web есть, в native не протекает.
import { Platform } from 'react-native'

import { createStyles } from '@/screens/tabs/PlacesScreen.styles'
import { getThemedColors } from '@/hooks/useTheme'

const originalOS = Platform.OS

const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })
}

const stylesFor = (os: typeof Platform.OS) => {
  setPlatform(os)
  const colors = getThemedColors('light' as never)
  return createStyles(colors as never, true, false)
}

const flatten = (style: unknown): Record<string, unknown> =>
  require('react-native').StyleSheet.flatten(style) ?? {}

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS })
})

describe('PlacesScreen web-only styles', () => {
  it('ставит курсор-указатель на кнопке сброса в вебе', () => {
    const styles = stylesFor('web')

    expect(flatten(styles.compactResetBtn).cursor).toBe('pointer')
  })

  it('не тащит web-курсор в native', () => {
    const styles = stylesFor('android')

    expect(flatten(styles.compactResetBtn).cursor).toBeUndefined()
  })

  it('сохраняет остальную геометрию кнопки на обеих платформах', () => {
    const web = flatten(stylesFor('web').compactResetBtn)
    const native = flatten(stylesFor('android').compactResetBtn)

    // 46×46 — минимальный тач-таргет, ради которого кнопка icon-only.
    expect({ width: web.width, height: web.height }).toEqual({ width: 46, height: 46 })
    expect({ width: native.width, height: native.height }).toEqual({ width: 46, height: 46 })
  })
})
