// #1491: кнопка действия панели маршрута планировщика. Проверяем ровно то, что
// требует карточка: подписи приходят с /map, кнопка живёт только пока есть
// несохранённые правки, и при этом ей нельзя перекрыть очистку маршрута.
import { routeBuilderCta } from '@/components/trips/planning/routeBuilderCta'

const cta = (input: Partial<Parameters<typeof routeBuilderCta>[0]>) =>
  routeBuilderCta({
    pointCount: 0,
    savedPointCount: 0,
    hasUnsavedChanges: true,
    pending: false,
    ...input,
  })

describe('routeBuilderCta', () => {
  it('прячет кнопку, пока черновик совпадает с сохранённым маршрутом', () => {
    expect(cta({ pointCount: 3, savedPointCount: 3, hasUnsavedChanges: false }).visible).toBe(false)
    expect(cta({ pointCount: 3, savedPointCount: 3, hasUnsavedChanges: true }).visible).toBe(true)
  })

  it('оставляет кнопку для незагруженного оригинала при сохранённых точках', () => {
    const originalOnly = cta({
      pointCount: 3,
      savedPointCount: 3,
      hasUnsavedChanges: false,
      hasPendingOriginal: true,
    })

    expect(originalOnly.visible).toBe(true)
    expect(originalOnly.label).toBe('Сохранить маршрут')
    expect(originalOnly.hint).toBeNull()
  })

  it('на одной точке просит старт и финиш подсказкой, но сохранить не мешает', () => {
    // Список из одной точки — законный черновик: до #1491 его сохраняла
    // постоянная кнопка, и отнимать эту возможность нельзя.
    const first = cta({ pointCount: 1, savedPointCount: 0 })

    expect(first.state).toBe('incomplete')
    expect(first.hint).toBe('Добавьте старт и финиш')
    expect(first.label).toBe('Сохранить маршрут')
    expect(first.disabled).toBe(false)
  })

  it('со старта и финиша предлагает построить маршрут', () => {
    const ready = cta({ pointCount: 2, savedPointCount: 0 })

    expect(ready.state).toBe('build')
    expect(ready.label).toBe('Построить маршрут')
    expect(ready.hint).toBeNull()
    expect(ready.disabled).toBe(false)
  })

  it('на уже построенном маршруте предлагает пересчёт', () => {
    const rebuilt = cta({ pointCount: 4, savedPointCount: 3 })

    expect(rebuilt.state).toBe('rebuild')
    expect(rebuilt.label).toBe('Пересчитать маршрут')
    expect(rebuilt.disabled).toBe(false)
  })

  it('не запирает пользователя, когда он укоротил сохранённый маршрут', () => {
    // Удалили точки до одной: сохранить это нужно уметь, иначе очистить
    // маршрут в планировщике становится нечем.
    const shortened = cta({ pointCount: 1, savedPointCount: 3 })

    expect(shortened.state).toBe('rebuild')
    expect(shortened.disabled).toBe(false)
  })

  it('пока запрос летит, показывает «Строим…» и блокирует повтор', () => {
    const busy = cta({ pointCount: 3, savedPointCount: 3, pending: true })

    expect(busy.state).toBe('pending')
    expect(busy.label).toBe('Строим…')
    expect(busy.disabled).toBe(true)
  })
})
