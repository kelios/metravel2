import { getApiErrorMessage } from '@/utils/errorHelpers'

describe('getApiErrorMessage — structured field errors', () => {
  // Реальный ответ прода на попытку одобрить модерацию travel/619:
  // бэк перечисляет точки без категорий массивом объектов, а не строкой.
  // Раньше из такого тела не извлекалось ничего и пользователь получал
  // «Ошибка запроса: Bad Request».
  const body = {
    coordsMeTravel: [
      {
        index: 1,
        id: 15948,
        address: 'Kościół pw. Najświętszego Serca Pana Jezusa',
        field: 'categories',
        message: 'Заполните categories для точки маршрута.',
      },
      {
        index: 2,
        id: 15951,
        address: 'Kościół pw. Wniebowzięcia NMP',
        field: 'categories',
        message: 'Заполните categories для точки маршрута.',
      },
    ],
  }

  it('builds a readable message naming the offending items', () => {
    const message = getApiErrorMessage(body, 'Bad Request')

    expect(message).toContain('Заполните categories')
    expect(message).toContain('#2 Kościół pw. Najświętszego Serca Pana Jezusa')
    expect(message).toContain('#3 Kościół pw. Wniebowzięcia NMP')
    expect(message).not.toContain('Bad Request')
  })

  it('caps the enumeration and reports the remainder', () => {
    const many = {
      coordsMeTravel: Array.from({ length: 5 }, (_, index) => ({
        index,
        address: `Точка ${index + 1}`,
        message: 'Заполните categories для точки маршрута.',
      })),
    }

    expect(getApiErrorMessage(many, 'Bad Request')).toContain('+2')
  })

  it('still prefers plain string field errors', () => {
    expect(getApiErrorMessage({ name: 'Название обязательно' }, 'Bad Request'))
      .toBe('name: Название обязательно')
  })

  it('falls back to the status text when nothing is extractable', () => {
    expect(getApiErrorMessage({ coordsMeTravel: [] }, 'Bad Request'))
      .toContain('Bad Request')
  })
})
