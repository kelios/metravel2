const { scanSource, scanScreenActions, ACTION_SCREENS } = require('@/scripts/guard-screen-actions')

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
})
