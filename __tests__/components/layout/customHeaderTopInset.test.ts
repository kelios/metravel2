/**
 * #2234 (MOBILE-INSETS-001, верхний край): верхний безопасный отступ шапки на native
 * принадлежит ОДНОМУ владельцу — контейнеру (`styles.container`), а не стилю строки.
 *
 * Прежде на Android отступ под статус-бар нёс стиль бренд-строки
 * (`inner.paddingTop = StatusBar.currentHeight + 6`), а #2100 перестал монтировать
 * бренд-строку на вложенных экранах телефона — строка «←» вставала под статус-бар
 * (Pixel 10 Pro: кнопки y=11–126 px при инсете 172 px, тапы не доходили).
 *
 * jest-сборка RN отдаёт из `Platform.select` всегда ветку `ios`, поэтому для Android
 * выбор ветки эмулируется по текущему `Platform.OS`.
 */
import { Platform, StatusBar, StyleSheet } from 'react-native'

import { createCustomHeaderStyles } from '@/components/layout/customHeaderStyles'

const colors = new Proxy({}, { get: () => '#000000' }) as any

type Os = 'ios' | 'android' | 'web'

const STATUS_BAR = 48

const build = (os: Os, safeAreaTop: number, hasBrandRow: boolean) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  const styles = createCustomHeaderStyles(colors, true, safeAreaTop, hasBrandRow)
  return {
    container: StyleSheet.flatten(styles.container),
    inner: StyleSheet.flatten(styles.inner),
  }
}

describe('шапка: верхний инсет принадлежит контейнеру (#2234)', () => {
  const originalOS = Platform.OS
  const originalCurrentHeight = StatusBar.currentHeight
  let selectSpy: jest.SpyInstance

  beforeEach(() => {
    // Ненулевая высота статус-бара: если стиль строки снова начнёт её прибавлять,
    // двойной отступ станет виден в проверке ниже.
    Object.defineProperty(StatusBar, 'currentHeight', { value: STATUS_BAR, configurable: true })
    selectSpy = jest
      .spyOn(Platform, 'select')
      .mockImplementation(((spec: Record<string, unknown>) =>
        Platform.OS in spec ? spec[Platform.OS] : 'native' in spec && Platform.OS !== 'web' ? spec.native : spec.default) as any)
  })

  afterEach(() => {
    selectSpy.mockRestore()
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    Object.defineProperty(StatusBar, 'currentHeight', { value: originalCurrentHeight, configurable: true })
  })

  it.each(['android', 'ios'] as const)(
    '%s: без бренд-строки (вложенный экран) контейнер держит инсет',
    (os) => {
      expect(build(os, STATUS_BAR, false).container.paddingTop).toBe(STATUS_BAR)
    },
  )

  it.each([
    ['android', 6],
    ['ios', 8],
  ] as const)('%s: с бренд-строкой отступ один — инсет у контейнера, у строки только свой зазор', (os, rowGap) => {
    const { container, inner } = build(os, STATUS_BAR, true)
    expect(container.paddingTop).toBe(STATUS_BAR)
    expect(inner.paddingTop).toBe(rowGap)
  })

  it('отрицательный и нечисловой инсет не дают отступа', () => {
    expect(build('android', -4, false).container.paddingTop).toBe(0)
    expect(build('android', Number.NaN, false).container.paddingTop).toBe(0)
  })

  it('web: инсет контейнер не берёт (статус-бара нет, шапка sticky)', () => {
    expect(build('web', STATUS_BAR, true).container.paddingTop).toBe(0)
    expect(build('web', STATUS_BAR, false).container.paddingTop).toBe(0)
  })
})
