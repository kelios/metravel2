const {
  SCREEN_HEADER_OWNERS,
  HEADER_INSET_OWNER,
  scanOwnerSource,
  scanScreenHeaders,
  scanHeaderInsetSource,
  scanHeaderInsets,
} = require('@/scripts/guard-screen-header')

describe('guard-screen-header (#2099)', () => {
  it('репозиторий зелёный', () => {
    expect(scanScreenHeaders(process.cwd())).toEqual([])
  })

  it('экран прохождения квеста в списке владельцев шапки (#2148)', () => {
    expect(SCREEN_HEADER_OWNERS).toContain('components/quests/useQuestScreenHeader.ts')
  })

  it('негативная проба: владелец без useScreenHeader падает', () => {
    const findings = scanOwnerSource('components/quests/useQuestScreenHeader.ts', 'export function useQuestScreenHeader() {}')
    expect(findings).toEqual([expect.stringContaining('обязан вызвать useScreenHeader')])
  })

  it('негативная проба: заголовок первого уровня в теле экрана падает', () => {
    const source = `
      useScreenHeader({ title: 'Квест' })
      const h = <Text accessibilityRole="header">Квест</Text>
    `
    expect(scanOwnerSource('components/quests/useQuestScreenHeader.ts', source)).toEqual([
      expect.stringContaining('прямой заголовок'),
    ])
  })

  it('декларация без заголовка в теле проходит', () => {
    expect(scanOwnerSource('components/quests/useQuestScreenHeader.ts', "useScreenHeader({ title: 'Квест' })")).toEqual([])
  })
})

describe('guard-screen-header: верхний инсет у контейнера шапки (#2234)', () => {
  it('оболочка шапки в репозитории зелёная', () => {
    expect(scanHeaderInsets(process.cwd())).toEqual([])
  })

  it('негативная проба: StatusBar.currentHeight в стиле строки падает (исходный дефект Android)', () => {
    const source = "inner: { android: { paddingTop: (StatusBar.currentHeight || 0) + 6 } }"
    expect(scanHeaderInsetSource('components/layout/customHeaderStyles.ts', source)).toEqual([
      expect.stringContaining('StatusBar.currentHeight'),
    ])
  })

  it('упоминание в комментарии не считается', () => {
    const source = '// прежде `StatusBar.currentHeight + 6`\nconst a = 1'
    expect(scanHeaderInsetSource('components/layout/customHeaderStyles.ts', source)).toEqual([])
  })

  it('негативная проба: строка «←» сама берёт safe-area', () => {
    const source = 'const insets = useSafeAreaInsetsSafe()'
    expect(scanHeaderInsetSource('components/layout/HeaderContextBar.tsx', source)).toEqual([
      expect.stringContaining('строка шапки не берёт safe-area сама'),
    ])
  })

  it('негативная проба: контейнер не передаёт инсет в стили', () => {
    const source = 'const styles = createCustomHeaderStyles(colors, rowIsMobile, 0, renderBrandRow)'
    expect(scanHeaderInsetSource(HEADER_INSET_OWNER, source)).toEqual([
      expect.stringContaining('обязан передать верхний инсет'),
    ])
  })
})
