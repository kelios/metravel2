const {
  SCREEN_HEADER_OWNERS,
  HEADER_INSET_OWNER,
  scanOwnerSource,
  scanScreenHeaders,
  scanHeaderInsetSource,
  scanHeaderInsets,
  STANDALONE_SCREEN_OWNER,
  STANDALONE_SCREEN_EXCEPTIONS,
  listStandaloneRouteFiles,
  scanStandaloneScreenSource,
  scanStandaloneScreenOwnerSource,
  scanStandaloneScreens,
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

// #2272: экраны `app/` вне `(tabs)` лежат без общей шапки. Верхний отступ у них
// держит контейнер `StandaloneScreen` или собственный `CustomHeader`; шаблон
// `SafeAreaView edges` без `top` разошёлся копированием по трём экранам.
describe('guard-screen-header: верхний отступ экранов вне оболочки шапки (#2272)', () => {
  const screen = (body: string) => `
import { Redirect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import StandaloneScreen from '@/components/layout/StandaloneScreen'
import CustomHeader from '@/components/layout/CustomHeader'
${body}
`

  it('репозиторий зелёный, исключений нет', () => {
    expect(scanStandaloneScreens(process.cwd())).toEqual([])
    expect(STANDALONE_SCREEN_EXCEPTIONS).toEqual({})
  })

  it('видит все экраны вне оболочки шапки и не заходит в (tabs), layout и +html', () => {
    const routes = listStandaloneRouteFiles(process.cwd())
    expect(routes).toEqual(
      expect.arrayContaining([
        'app/security-journal.tsx',
        'app/privacy-settings.tsx',
        'app/blocked-users.tsx',
        'app/error.tsx',
        'app/[...missing].tsx',
        'app/contact.tsx',
        'app/app.tsx',
        'app/register.tsx',
      ]),
    )
    expect(routes.some((rel: string) => rel.includes('(tabs)') || /\/[_+]/.test(rel))).toBe(false)
  })

  it('негативная проба: исходный дефект — SafeAreaView без top в обеих ветках экрана', () => {
    const source = screen(`
export default function SecurityJournalScreen() {
  if (guest) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <EmptyState />
      </SafeAreaView>
    )
  }
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView />
    </SafeAreaView>
  )
}`)
    const findings = scanStandaloneScreenSource('app/security-journal.tsx', source)
    expect(findings.filter((item: string) => item.includes('прямой SafeAreaView'))).toHaveLength(2)
    expect(findings.filter((item: string) => item.includes('без владельца верхнего отступа'))).toHaveLength(2)
  })

  it('негативная проба: SafeAreaView с top тоже не проходит — край держит только контейнер', () => {
    const source = screen(`
export default function Screen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView />
    </SafeAreaView>
  )
}`)
    expect(scanStandaloneScreenSource('app/privacy-settings.tsx', source)).toEqual([
      expect.stringContaining('прямой SafeAreaView'),
      expect.stringContaining('без владельца верхнего отступа'),
    ])
  })

  it('негативная проба: одна ветка в контейнере, вторая — нет', () => {
    const source = screen(`
export default function Screen() {
  if (guest) return <EmptyState />
  return (
    <StandaloneScreen>
      <ScrollView />
    </StandaloneScreen>
  )
}`)
    expect(scanStandaloneScreenSource('app/blocked-users.tsx', source)).toEqual([
      expect.stringMatching(/^app\/blocked-users\.tsx:\d+: ветка экрана вне оболочки шапки без владельца верхнего отступа/),
    ])
  })

  it('негативная проба: тернарник с веткой без владельца и возврат не-разметки', () => {
    const ternary = screen(`
export default function Screen() {
  return guest ? <EmptyState /> : <StandaloneScreen><ScrollView /></StandaloneScreen>
}`)
    expect(scanStandaloneScreenSource('app/x.tsx', ternary)).toHaveLength(1)
    const opaque = screen(`
export default function Screen() {
  return renderBody()
}`)
    expect(scanStandaloneScreenSource('app/x.tsx', opaque)).toHaveLength(1)
  })

  it('проходят: контейнер во всех ветках, свой CustomHeader, memo-экспорт, редирект и null', () => {
    const wrapped = screen(`
export default function Screen() {
  if (!ready) return null
  if (guest) {
    return (
      <StandaloneScreen style={styles.container}>
        <EmptyState />
      </StandaloneScreen>
    )
  }
  const onPress = () => { return 1 }
  return (
    <>
      <Stack.Screen options={{ title }} />
      <StandaloneScreen>
        <ScrollView />
      </StandaloneScreen>
    </>
  )
}`)
    expect(scanStandaloneScreenSource('app/x.tsx', wrapped)).toEqual([])

    const ownHeader = screen(`
function ContactScreen() {
  return (
    <>
      <CustomHeader />
      <ScrollView />
    </>
  )
}
export default memo(ContactScreen)`)
    expect(scanStandaloneScreenSource('app/contact.tsx', ownHeader)).toEqual([])

    const redirect = screen(`
export default function RegisterRedirect() {
  return <Redirect href="/registration" />
}`)
    expect(scanStandaloneScreenSource('app/register.tsx', redirect)).toEqual([])
  })

  it('упоминание SafeAreaView в комментарии и в импорте не считается', () => {
    const source = screen(`
// раньше здесь был <SafeAreaView edges={['left']}>
export default function Screen() {
  return <StandaloneScreen><ScrollView /></StandaloneScreen>
}`)
    expect(scanStandaloneScreenSource('app/x.tsx', source)).toEqual([])
  })

  it('контейнер: верхний край постоянен, пропа edges нет', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    const owner = fs.readFileSync(path.join(process.cwd(), STANDALONE_SCREEN_OWNER), 'utf8')
    expect(scanStandaloneScreenOwnerSource(STANDALONE_SCREEN_OWNER, owner)).toEqual([])

    const withoutTop = owner.replace("['top', 'left', 'right', 'bottom']", "['left', 'right', 'bottom']")
    expect(scanStandaloneScreenOwnerSource(STANDALONE_SCREEN_OWNER, withoutTop)).toEqual([
      expect.stringContaining("начинающийся с 'top'"),
    ])

    const withProp = owner.replace('{ children, style, testID }: Props', '{ children, style, testID, edges }: Props')
    expect(scanStandaloneScreenOwnerSource(STANDALONE_SCREEN_OWNER, withProp)).toEqual([
      expect.stringContaining('проп edges у контейнера запрещён'),
    ])
  })
})
