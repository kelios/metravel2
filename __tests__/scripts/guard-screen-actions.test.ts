const fs = require('node:fs')
const path = require('node:path')
const { scanSource, scanScreenActions, scanDeleteSurfaces, ACTION_SCREENS, DELETE_SURFACES } = require('@/scripts/guard-screen-actions')
const { makeTempDir } = require('./cli-test-utils')

describe('guard-screen-actions (#2101)', () => {
  it('репозиторий зелёный', () => {
    expect(scanScreenActions(process.cwd())).toEqual([])
    expect(ACTION_SCREENS.length).toBeGreaterThan(0)
  })

  it('негативная проба: полноширинная Button variant="danger" в теле экрана падает', () => {
    const source = `
      useScreenHeader({ title: 'x' })
      export const S = () => (
        <View>
          <Button label="Удалить" variant="danger" fullWidth onPress={remove} />
        </View>
      )
    `
    const findings = scanSource('components/trips/PublicTripDetail.tsx', source)
    expect(findings.some((f: string) => f.includes('variant="danger"'))).toBe(true)
  })

  it('негативная проба: безымянная иконка корзины вне «⋯» падает', () => {
    const source = `
      useScreenHeader({ title: 'x' })
      export const S = () => <Feather name="trash-2" size={16} />
    `
    expect(scanSource('components/trips/PublicTripDetail.tsx', source)).toHaveLength(1)
  })

  it('desktop-блок с меткой и пункт «⋯» с destructive проходят', () => {
    const source = `
      useScreenHeader({ title: 'x' })
      const a = <View {...SCREEN_HEADER_DESKTOP_PROPS}><Button variant="danger" /></View>
      const items = [{ key: 'delete', icon: 'trash-2', destructive: true, onPress: remove }]
      useScreenHeader({ title: 'x', overflow: items })
    `
    expect(scanSource('components/trips/PublicTripDetail.tsx', source)).toEqual([])
  })

  it('негативная проба: destructive стоит, но пункт уходит только в ряд чипов — guard падает', () => {
    const source = `
      useScreenHeader({ title: 'x' })
      const inlineActions = [{ key: 'delete', icon: 'trash-2', destructive: true, onPress: remove }]
      const card = <PlaceListCard inlineActions={inlineActions} />
    `
    expect(scanSource('components/trips/PublicTripDetail.tsx', source)).toHaveLength(1)
  })

  it('негативная проба: корзина рядом с чужим destructive, но вне его литерала — падает', () => {
    const source = `
      useScreenHeader({ title: 'x', overflow: [{ key: 'a', icon: 'x', destructive: true, onPress: a }] })
      const b = { key: 'b', icon: 'trash-2', onPress: b }
    `
    expect(scanSource('components/trips/PublicTripDetail.tsx', source)).toHaveLength(1)
  })

  it('экран без декларации шапки падает', () => {
    expect(scanSource('components/trips/PublicTripDetail.tsx', 'export const S = () => null')).toHaveLength(1)
  })

  // #2148: экран прохождения квеста — под тем же правилом.
  describe('экран прохождения квеста (#2148)', () => {
    it('страница, визард, панель и декларация — в списке экранов', () => {
      expect(ACTION_SCREENS).toEqual(expect.arrayContaining([
        'app/(tabs)/quests/[city]/[questId].tsx',
        'components/quests/QuestWizard.tsx',
        'components/quests/questWizardShell.tsx',
        'components/quests/useQuestScreenHeader.ts',
      ]))
    })

    it('негативная проба: полноширинная danger-кнопка «Сбросить» в теле экрана падает', () => {
      const source = `
        useQuestScreenHeader({ title })
        const reset = <Button label="Сбросить" variant="danger" fullWidth onPress={resetQuest} />
      `
      const findings = scanSource('components/quests/QuestWizard.tsx', source)
      expect(findings).toEqual([expect.stringContaining('variant="danger"')])
    })

    it('негативная проба: визард без декларации шапки падает', () => {
      const findings = scanSource('components/quests/QuestWizard.tsx', 'export function QuestWizard() { return null }')
      expect(findings).toEqual([expect.stringContaining('обязан объявить действия шапки')])
    })

    it('негативная проба: декларация без useScreenHeader падает', () => {
      const findings = scanSource('components/quests/useQuestScreenHeader.ts', 'export function useQuestScreenHeader() {}')
      expect(findings).toEqual([expect.stringContaining('обязан объявить действия шапки')])
    })
  })

  // #2115: guard видит все поверхности удаления, а не только экраны деталей.
  describe('реестр поверхностей удаления (#2115)', () => {
    const makeRoot = (files: Record<string, string>) => {
      const root = makeTempDir('screen-actions-')
      for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
        fs.writeFileSync(path.join(root, rel), body)
      }
      // Все записи реестра должны существовать с находкой — кладём их как есть.
      for (const rel of Object.keys(DELETE_SURFACES)) {
        if (files[rel] !== undefined) continue
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
        fs.writeFileSync(path.join(root, rel), `const icon = 'trash-2'\n`)
      }
      return root
    }

    it('новая корзина вне ACTION_SCREENS и без записи реестра — нарушение', () => {
      const root = makeRoot({ 'components/new/NewScreen.tsx': `<Feather name="trash-2" />\n` })
      const findings = scanDeleteSurfaces(root)
      expect(findings).toEqual([expect.stringContaining('components/new/NewScreen.tsx: корзина или variant="danger" без решения')])
    })

    it('запись реестра без находки — устарела', () => {
      const [rel] = Object.keys(DELETE_SURFACES)
      const root = makeRoot({ [rel]: `const nothingToDelete = true\n` })
      expect(scanDeleteSurfaces(root)).toEqual([expect.stringContaining(`${rel}: запись DELETE_SURFACES устарела`)])
    })

    it('корзина в комментарии не считается поверхностью', () => {
      const root = makeRoot({ 'components/new/Commented.tsx': `// <Feather name="trash-2" />\n` })
      expect(scanDeleteSurfaces(root)).toEqual([])
    })

    it('каждая запись реестра имеет вид и причину', () => {
      for (const [rel, entry] of Object.entries(DELETE_SURFACES) as [string, [string, string]][]) {
        expect([rel, ['row', 'bulk', 'editor', 'sheet', 'settings', 'dialog'].includes(entry[0])]).toEqual([rel, true])
        expect(entry[1].trim().length).toBeGreaterThan(10)
      }
    })
  })
})
