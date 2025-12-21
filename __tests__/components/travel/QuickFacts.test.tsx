import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import QuickFacts from '@/components/travel/QuickFacts'

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    Platform: { OS: 'web', select: (obj: any) => obj.web || obj.default },
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
  }
})

const baseTravel: any = {
  id: 1,
  monthName: 'Март',
  year: '2024',
  number_days: 5,
  countryName: 'Польша',
  travelAddress: [],
}

describe('QuickFacts', () => {
  it('returns null when there is no data to show', () => {
    const { queryByLabelText } = render(<QuickFacts travel={{} as any} />)
    expect(queryByLabelText('Ключевая информация о путешествии')).toBeNull()
  })

  it('renders basic facts (date, days, country)', () => {
    const { getByText, getByLabelText } = render(<QuickFacts travel={baseTravel} />)

    // контейнер
    expect(getByLabelText('Ключевая информация о путешествии')).toBeTruthy()

    // дата
    expect(getByText('Март 2024')).toBeTruthy()
    // длительность
    expect(getByText('5 дней')).toBeTruthy()
    // страна
    expect(getByText('Польша')).toBeTruthy()
  })

  it('normalizes categoryName from string and object and splits by comma', () => {
    const travelWithCategories: any = {
      ...baseTravel,
      travelAddress: [
        { categoryName: 'Город, История' },
        { categoryName: { id: 1, name: 'Природа, Море' } },
      ],
    }

    const onCategoryPress = jest.fn()
    const { getByText } = render(
      <QuickFacts travel={travelWithCategories} onCategoryPress={onCategoryPress} />,
    )

    // Теги категорий должны быть развёрнуты и уникальны
    const city = getByText('Город')
    const history = getByText('История')
    const nature = getByText('Природа')
    const sea = getByText('Море')

    expect(city).toBeTruthy()
    expect(history).toBeTruthy()
    expect(nature).toBeTruthy()
    expect(sea).toBeTruthy()

    // Проверяем, что onCategoryPress вызывается по нажатию
    fireEvent.press(city)
    expect(onCategoryPress).toHaveBeenCalledWith('Город')
  })

  it('does not treat categories as buttons when onCategoryPress is not provided', () => {
    const travelWithCategories: any = {
      ...baseTravel,
      travelAddress: [{ categoryName: 'Город' }],
    }

    const { getByText } = render(<QuickFacts travel={travelWithCategories} />)

    const city = getByText('Город')
    // Нажатие не должно падать и не должно быть обработчика
    fireEvent.press(city)
    expect(city).toBeTruthy()
  })
})
