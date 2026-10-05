const { SCREEN_HEADER_OWNERS, scanOwnerSource, scanScreenHeaders } = require('@/scripts/guard-screen-header')

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
