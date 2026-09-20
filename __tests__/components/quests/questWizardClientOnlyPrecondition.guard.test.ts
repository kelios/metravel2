import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * #1562. `useQuestWizardResponsiveModel` зовёт `useResponsive({ clientOnly: true })`,
 * чтобы у визарда не было кадра с нулевой шириной. По контракту
 * `hooks/useHydrationReady.ts` опция допустима ТОЛЬКО для узла, которого нет в
 * SSR-разметке: для узла из статического HTML это hydration mismatch (#418).
 *
 * Инвариант держится на маршруте квеста: `useQuestBundle` отдаёт `loading: true`
 * на первом web-кадре, а маршрут по `isLoading` делает ранний return
 * `LoadingState`, поэтому ни одна точка монтирования визарда недостижима на
 * кадре гидратации. С #1992 бандл живёт в React Query, и `isPending` запроса
 * этого не гарантирует: посадочная города (`useQuestCityWalk`) прогревает тот
 * же ключ, и на тёплом кэше первый кадр нёс бы данные — поэтому `loading`
 * складывается из `isPending` и `useHydrationReady()` (false ровно на кадре
 * гидратации, см. `hooks/useHydrationReady.ts`), а сам запрос не сеет данные
 * синхронно (`initialData`/`placeholderData`). Инвариант живёт в чужом файле,
 * который правят параллельные сессии, и без этого гарда его снятие не уронило
 * бы ни один тест — визард молча начал бы рассыпаться на #418. Runtime-половина
 * — `useQuestsApi.test.ts` («первый кадр — loading даже при тёплом кэше»).
 */

const readSource = (relativePath: string) =>
  readFileSync(resolve(__dirname, '../../..', relativePath), 'utf8')

const ROUTE_PATH = 'app/(tabs)/quests/[city]/[questId].tsx'
const HOOK_PATH = 'hooks/useQuestsApi.ts'

describe('#1562 предусловие clientOnly для визарда квеста', () => {
  it('useQuestBundle держит первый web-кадр в loading: true — гидратация никогда не видит визард', () => {
    const source = readSource(HOOK_PATH)
    const hookStart = source.indexOf('export function useQuestBundle(')
    expect(hookStart).toBeGreaterThan(-1)
    const hookBody = source.slice(hookStart, source.indexOf('\nexport function', hookStart + 1))

    expect(hookBody).toMatch(/const hydrationReady = useHydrationReady\(\)/)
    expect(hookBody).toMatch(
      /loading:\s*Boolean\(questId\)\s*&&\s*\(isPending\s*\|\|\s*\(isFetching\s*&&\s*!data\)\s*\|\|\s*!hydrationReady\)/,
    )
  })

  /**
   * Вторая половина предусловия. `useQuestBundle` держит первый кадр только
   * когда `questId` передан, а маршрут зовёт его с `shouldLoadQuest ? questId :
   * undefined`: при `isFocused === false` на кадре гидратации хук отдаёт
   * `loading: false`, и «загрузку» держит уже ветка прогресса/гостя. Старый
   * литерал `useState(true)` закрывал оба случая разом, поэтому без этого кейса
   * гард стал бы уже прежнего.
   */
  it('маршрут складывает isLoading из бандла И ветки прогресса/гостя — questId без фокуса тоже держит загрузку', () => {
    const source = readSource(ROUTE_PATH)

    expect(source).toMatch(
      /const isLoading =\s*isQuestLoading \|\|\s*\(isAuthenticated \? progressLoading : Boolean\(questId\) && !guestFlow\.guestReady\)/,
    )
  })

  it('запрос бандла не сеет данные синхронно — тёплый кэш приходит только через isPending', () => {
    const query = readSource('hooks/questBundleQuery.ts')

    expect(query).not.toMatch(/initialData|placeholderData/)
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
