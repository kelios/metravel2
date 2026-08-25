import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * #1562. `useQuestWizardResponsiveModel` зовёт `useResponsive({ clientOnly: true })`,
 * чтобы у визарда не было кадра с нулевой шириной. По контракту
 * `hooks/useHydrationReady.ts` опция допустима ТОЛЬКО для узла, которого нет в
 * SSR-разметке: для узла из статического HTML это hydration mismatch (#418).
 *
 * Инвариант держится на маршруте квеста: `useQuestBundle` стартует с
 * `loading: true`, а маршрут по `isLoading` делает ранний return `LoadingState`,
 * поэтому ни одна точка монтирования визарда недостижима на кадре гидратации.
 * Инвариант живёт в чужом файле, который правят параллельные сессии, и без этого
 * гарда его снятие не уронило бы ни один тест — визард молча начал бы
 * рассыпаться на #418. Тест на сам хук
 * (`useQuestWizardResponsiveModel.test.tsx`) эту половину не покрывает.
 */

const readSource = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../../..', relativePath), 'utf8')

const ROUTE_PATH = 'app/(tabs)/quests/[city]/[questId].tsx'
const HOOK_PATH = 'hooks/useQuestsApi.ts'

describe('#1562 предусловие clientOnly для визарда квеста', () => {
  it('useQuestBundle стартует с loading: true — первый кадр маршрута всегда «загрузка»', () => {
    const source = readSource(HOOK_PATH)
    const hookBody = source.slice(source.indexOf('export function useQuestBundle'))

    expect(hookBody).toMatch(/const \[loading, setLoading\] = useState\(true\)/)
  })

  it('ранний return по isLoading стоит выше любой точки монтирования визарда', () => {
    const source = readSource(ROUTE_PATH)

    const loadingGate = source.indexOf('if (isLoading) {\n    return <LoadingState')
    expect(loadingGate).toBeGreaterThan(-1)

    const mountPoints = [...source.matchAll(/<QuestWizardComponent\b/g)].map((match) => match.index ?? -1)
    expect(mountPoints.length).toBeGreaterThan(0)
    for (const mountPoint of mountPoints) {
      expect(mountPoint).toBeGreaterThan(loadingGate)
    }
  })

  it('модель визарда остаётся единственным консьюмером и держит clientOnly', () => {
    const model = readSource('components/quests/hooks/useQuestWizardResponsiveModel.ts')

    expect(model).toMatch(/useResponsive\(\{\s*clientOnly:\s*true\s*\}\)/)
  })
})
