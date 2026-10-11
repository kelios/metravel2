import { filterMapPointsByCategory, resolveMapCategorySelection } from '@/utils/mapCategorySelection'

const dictionary = [{ id: '43', name: 'Замок' }, { id: 115, name: 'Руины замка' }]
const points = [
  { id: 1, categoryName: 'Замок' },
  { id: 2, categoryName: 'Парк, Неизвестная категория' },
  { id: 3, categoryName: 'Руины замка, Замок' },
  { id: 4, categoryName: 'Площадь' },
]

describe('complete map category selection', () => {
  it('accepts registered numeric URL IDs and names as the same category', () => {
    const selection = resolveMapCategorySelection(['43', ' замок ', '115'], dictionary)
    expect(selection.tokens).toEqual(['Замок', 'Руины замка'])
    expect(selection.ids).toEqual([43, 115])
    expect(selection.hasCompleteCoverage).toBe(true)
    expect(filterMapPointsByCategory(points, selection).map((point) => point.id)).toEqual([1, 3])
  })

  it('keeps mixed resolved and unresolved members in local OR matching', () => {
    const selection = resolveMapCategorySelection(['43', 'Неизвестная категория'], dictionary)
    expect(selection.ids).toEqual([43])
    expect(selection.unresolvedTokens).toEqual(['Неизвестная категория'])
    expect(selection.hasCompleteCoverage).toBe(false)
    expect(filterMapPointsByCategory(points, selection).map((point) => point.id)).toEqual([1, 2, 3])
  })

  it.each(['loading', 'error'] as const)('retains unresolved URL IDs while the dictionary is %s', (state) => {
    const selection = resolveMapCategorySelection(['43', 'Unknown'], [], state)
    expect(selection.tokens).toEqual(['43', 'Unknown'])
    expect(selection.hasCompleteCoverage).toBe(false)
    const ready = resolveMapCategorySelection(selection.tokens, dictionary, 'ready')
    expect(ready.tokens).toEqual(['Замок', 'Unknown'])
    expect(ready.ids).toEqual([43])
  })

  it('does not mistake loading, errors or name-only fallback entries for complete backend coverage', () => {
    expect(resolveMapCategorySelection(['43'], dictionary, 'loading').hasCompleteCoverage).toBe(false)
    expect(resolveMapCategorySelection(['43'], dictionary, 'error').hasCompleteCoverage).toBe(false)
    expect(resolveMapCategorySelection(['Замок'], [{ id: 'Замок', name: 'Замок' }]).hasCompleteCoverage).toBe(false)
  })

  it('validates IDs through the dictionary rather than forwarding arbitrary numeric tokens', () => {
    const selection = resolveMapCategorySelection(['999999', '-1', '43'], dictionary)
    expect(selection.ids).toEqual([43])
    expect(selection.unresolvedTokens).toEqual(['999999', '-1'])
    expect(selection.hasCompleteCoverage).toBe(false)
  })

  it('matches comma-separated local point names without losing case-insensitive legacy names', () => {
    const selection = resolveMapCategorySelection([' неизвестная категория ', ' ЗАМОК '], dictionary)
    expect(filterMapPointsByCategory(points, selection).map((point) => point.id)).toEqual([1, 2, 3])
  })

  it('treats a registered numeric URL token as its ID even if another category has that name', () => {
    const selection = resolveMapCategorySelection(['43'], [{ id: 8, name: '43' }, ...dictionary])
    expect(selection.tokens).toEqual(['Замок'])
    expect(selection.ids).toEqual([43])
  })

  it('keeps the complete local OR when the selection exceeds the server category limit', () => {
    const largeDictionary = Array.from({ length: 51 }, (_, index) => ({
      id: index + 1,
      name: `Category ${index + 1}`,
    }))
    const selection = resolveMapCategorySelection(largeDictionary.map(({ id }) => String(id)), largeDictionary)
    expect(selection.hasCompleteCoverage).toBe(false)
    expect(selection.unresolvedTokens).toEqual([])
    expect(selection.ids).toHaveLength(51)
    expect(filterMapPointsByCategory([
      { id: 1, categoryName: 'Category 1' },
      { id: 51, categoryName: 'Category 51' },
      { id: 99, categoryName: 'Other' },
    ], selection).map(({ id }) => id)).toEqual([1, 51])
  })

  it('keeps no-selection data and input tokens unchanged', () => {
    const selected = ['43', '43', ' Unknown ']
    resolveMapCategorySelection(selected, dictionary)
    expect(selected).toEqual(['43', '43', ' Unknown '])
    expect(filterMapPointsByCategory(points, resolveMapCategorySelection([], dictionary))).toBe(points)
  })
})
