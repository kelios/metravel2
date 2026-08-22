// #1491: подпись главной кнопки построения маршрута — одна лесенка состояний на
// /map и в планировщике поездки. Тест держит и порядок приоритетов, и сами
// слова: разъедутся — экраны снова начнут учить пользователя дважды.
import { routeCtaLabel, routeCtaState } from '@/components/MapPage/routeCtaLabel'

describe('routeCtaState', () => {
  it('ставит «идёт запрос» выше всех остальных состояний', () => {
    expect(routeCtaState({ pending: true, hasRoute: true, canBuild: true })).toBe('pending')
    expect(routeCtaState({ pending: true, hasRoute: false, canBuild: false })).toBe('pending')
  })

  it('различает первое построение и пересчёт готового маршрута', () => {
    expect(routeCtaState({ hasRoute: true, canBuild: true })).toBe('rebuild')
    expect(routeCtaState({ hasRoute: false, canBuild: true })).toBe('build')
  })

  it('без старта и финиша не предлагает строить', () => {
    expect(routeCtaState({ hasRoute: false, canBuild: false })).toBe('incomplete')
    expect(routeCtaState({})).toBe('incomplete')
  })
})

describe('routeCtaLabel', () => {
  it('печатает те же подписи, что видит пользователь на /map', () => {
    expect(routeCtaLabel('pending')).toBe('Строим…')
    expect(routeCtaLabel('rebuild')).toBe('Пересчитать маршрут')
    expect(routeCtaLabel('build')).toBe('Построить маршрут')
    expect(routeCtaLabel('incomplete')).toBe('Добавьте старт и финиш')
  })
})
