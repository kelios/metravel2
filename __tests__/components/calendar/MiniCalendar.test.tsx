import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import MiniCalendar from '@/components/calendar/MiniCalendar'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import { buildTravelMonthFallbackDate } from '@/utils/travelCalendarDate'

// --- mocks ---
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    surface: '#ffffff',
    background: '#f8f9fa',
    backgroundSecondary: '#f1f5f9',
    text: '#1a202c',
    textMuted: '#94a3b8',
    textSecondary: '#64748b',
    primary: '#3b82f6',
    primaryLight: '#eff6ff',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    danger: '#ef4444',
  }),
}))

jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    radii: { sm: 4, md: 8, lg: 12, xl: 16, pill: 999 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  },
}))

jest.mock('@/styles/globalFocus', () => ({
  globalFocusStyles: { focusable: {} },
}))

jest.mock('@/stores/travelStatusStore', () => {
  const actual = jest.requireActual('@/stores/travelStatusStore')
  return {
    ...actual,
    useTravelStatusStore: jest.fn(),
  }
})

// Feather icon stub
jest.mock('@expo/vector-icons/Feather', () => {
  const { View } = require('react-native')
  return ({ name, testID }: { name: string; testID?: string }) => (
    <View testID={testID ?? `feather-${name}`} />
  )
})

// ---- helpers ----
const makeEntry = (plannedDate: string, id = 1): TravelStatusEntry => ({
  id,
  type: 'travel',
  title: `Trip ${id}`,
  url: `/travels/${id}`,
  status: 'planned',
  plannedDate,
  addedAt: Date.now(),
})

// ---- tests ----
describe('MiniCalendar', () => {
  describe('рендер заголовка', () => {
    it('показывает название текущего месяца и год', () => {
      const today = new Date()
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const { getByText } = render(<MiniCalendar entries={[]} />)
      expect(getByText(`${MONTHS[today.getMonth()]} ${today.getFullYear()}`)).toBeTruthy()
    })

    it('рендерит кнопки навигации по месяцам', () => {
      const { getByLabelText } = render(<MiniCalendar entries={[]} />)
      expect(getByLabelText('Предыдущий месяц')).toBeTruthy()
      expect(getByLabelText('Следующий месяц')).toBeTruthy()
    })

    it('рендерит строку с названиями дней недели (Пн–Вс)', () => {
      const { getByText } = render(<MiniCalendar entries={[]} />)
      for (const day of ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']) {
        expect(getByText(day)).toBeTruthy()
      }
    })
  })

  describe('навигация по месяцам', () => {
    it('переходит на следующий месяц при нажатии «Следующий месяц»', () => {
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const today = new Date()
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      const expectedTitle = `${MONTHS[nextMonth.getMonth()]} ${nextMonth.getFullYear()}`

      const { getByLabelText, getByText } = render(<MiniCalendar entries={[]} />)
      fireEvent.press(getByLabelText('Следующий месяц'))
      expect(getByText(expectedTitle)).toBeTruthy()
    })

    it('переходит на предыдущий месяц при нажатии «Предыдущий месяц»', () => {
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const today = new Date()
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const expectedTitle = `${MONTHS[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`

      const { getByLabelText, getByText } = render(<MiniCalendar entries={[]} />)
      fireEvent.press(getByLabelText('Предыдущий месяц'))
      expect(getByText(expectedTitle)).toBeTruthy()
    })

    it('переходит через граничный месяц: декабрь → январь следующего года', () => {
      const { getByLabelText, getByText } = render(<MiniCalendar entries={[]} />)
      // Navigate to December of current year
      const today = new Date()
      const monthsToEnd = 11 - today.getMonth() // months until December
      for (let i = 0; i < monthsToEnd; i++) {
        fireEvent.press(getByLabelText('Следующий месяц'))
      }
      // Now click next to go to January of next year
      fireEvent.press(getByLabelText('Следующий месяц'))
      expect(getByText(`Январь ${today.getFullYear() + 1}`)).toBeTruthy()
    })

    it('переходит через граничный месяц: январь → декабрь предыдущего года', () => {
      const { getByLabelText, getByText } = render(<MiniCalendar entries={[]} />)
      const today = new Date()
      // Navigate to January of current year
      const monthsToStart = today.getMonth() // months back to January
      for (let i = 0; i < monthsToStart; i++) {
        fireEvent.press(getByLabelText('Предыдущий месяц'))
      }
      // Now click prev to go to December of prev year
      fireEvent.press(getByLabelText('Предыдущий месяц'))
      expect(getByText(`Декабрь ${today.getFullYear() - 1}`)).toBeTruthy()
    })
  })

  describe('сетка дней', () => {
    it('рендерит корректное количество дней в May 2026 (31 день)', () => {
      const { getAllByRole } = render(<MiniCalendar entries={[]} focusDate="2026-05-01" />)
      // Day buttons are rendered as buttons in the grid
      const buttons = getAllByRole('button')
      // Filter out nav buttons (Предыдущий/Следующий месяц)
      const dayButtons = buttons.filter((b) => {
        const label = b.props.accessibilityLabel ?? ''
        return !label.includes('месяц')
      })
      expect(dayButtons.length).toBe(31)
    })

    it('день 1 рендерится как кнопка с правильным accessibilityLabel', () => {
      const { getByLabelText } = render(<MiniCalendar entries={[]} />)
      // May 2026 - current date context
      const today = new Date()
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const label = `1 ${MONTHS[today.getMonth()]}`
      expect(getByLabelText(label)).toBeTruthy()
    })
  })

  describe('отмеченные дни (entries)', () => {
    it('добавляет «, есть поездки» к label дня с planned поездкой', () => {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = '15'
      const plannedDate = `${year}-${month}-${day}`
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const { getByLabelText } = render(
        <MiniCalendar entries={[makeEntry(plannedDate)]} />
      )
      expect(
        getByLabelText(`${Number(day)} ${MONTHS[today.getMonth()]}, есть поездки`)
      ).toBeTruthy()
    })

    it('не отмечает дни из других месяцев', () => {
      // Current month entry in the next month
      const today = new Date()
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15)
      const plannedDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-15`
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const { queryByLabelText } = render(
        <MiniCalendar entries={[makeEntry(plannedDate)]} />
      )
      // The day 15 in current month should NOT have "есть поездки"
      expect(
        queryByLabelText(`15 ${MONTHS[today.getMonth()]}, есть поездки`)
      ).toBeNull()
    })

    it('не отмечает невозможную дату после Date-нормализации', () => {
      const today = new Date()
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const invalidEntry: TravelStatusEntry = {
        id: 4,
        type: 'travel',
        title: 'Invalid date',
        url: '/travels/4',
        status: 'planned',
        plannedDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-32`,
        addedAt: Date.now(),
      }
      const { queryByLabelText } = render(<MiniCalendar entries={[invalidEntry]} />)
      expect(queryByLabelText(`1 ${MONTHS[today.getMonth()]}, есть поездки`)).toBeNull()
    })

    it('не отмечает дни для visited/wishlist записей (без plannedDate)', () => {
      const today = new Date()
      const visitedEntry: TravelStatusEntry = {
        id: 2,
        type: 'travel',
        title: 'Visited trip',
        url: '/travels/2',
        status: 'visited',
        addedAt: Date.now(),
        // no plannedDate
      }
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const { queryByLabelText } = render(
        <MiniCalendar entries={[visitedEntry]} />
      )
      // No day should have "есть поездки" label
      for (let d = 1; d <= 31; d++) {
        expect(
          queryByLabelText(`${d} ${MONTHS[today.getMonth()]}, есть поездки`)
        ).toBeNull()
      }
    })

    it('отмечает visitedDate и wishlistDate как календарные даты', () => {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const entries: TravelStatusEntry[] = [
        {
          id: 5,
          type: 'travel',
          title: 'Visited trip',
          url: '/travels/5',
          status: 'visited',
          visitedDate: `${year}-${month}-08`,
          addedAt: Date.now(),
        },
        {
          id: 6,
          type: 'travel',
          title: 'Wishlist trip',
          url: '/travels/6',
          status: 'wishlist',
          wishlistDate: `${year}-${month}-18`,
          addedAt: Date.now(),
        },
      ]
      const { getByLabelText } = render(<MiniCalendar entries={entries} />)
      expect(getByLabelText(`8 ${MONTHS[today.getMonth()]}, есть поездки`)).toBeTruthy()
      expect(getByLabelText(`18 ${MONTHS[today.getMonth()]}, есть поездки`)).toBeTruthy()
    })

    it('отмечает посещённое путешествие по fallback-дате, если указаны только год и месяц', () => {
      const today = new Date()
      const year = today.getFullYear()
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const travelId = 7
      const fallbackDate = buildTravelMonthFallbackDate({
        year: String(year),
        monthName: MONTHS[today.getMonth()],
        seed: travelId,
      })
      const fallbackDay = fallbackDate ? Number(fallbackDate.slice(-2)) : null
      const entry: TravelStatusEntry = {
        id: travelId,
        type: 'travel',
        title: 'Visited trip by month',
        url: `/travels/${travelId}`,
        status: 'visited',
        travelYear: String(year),
        travelMonthName: MONTHS[today.getMonth()],
        addedAt: Date.now(),
      }

      const { getByLabelText } = render(<MiniCalendar entries={[entry]} />)

      expect(fallbackDay).not.toBeNull()
      expect(getByLabelText(`${fallbackDay} ${MONTHS[today.getMonth()]}, есть поездки`)).toBeTruthy()
    })

    it('открывает месяц с поездкой по focusDate, чтобы были видны точки старых лет', async () => {
      const entry: TravelStatusEntry = {
        id: 202001,
        type: 'travel',
        title: 'Visited trip in 2020',
        url: '/travels/202001',
        status: 'visited',
        travelYear: '2020',
        travelMonthName: 'Январь',
        addedAt: Date.now(),
      }
      const fallbackDate = buildTravelMonthFallbackDate({
        year: '2020',
        monthName: 'Январь',
        seed: entry.id,
      })
      const fallbackDay = fallbackDate ? Number(fallbackDate.slice(-2)) : null

      const { getByText, getByLabelText } = render(
        <MiniCalendar entries={[entry]} focusDate={fallbackDate} />
      )

      await waitFor(() => expect(getByText('Январь 2020')).toBeTruthy())
      expect(fallbackDay).not.toBeNull()
      expect(getByLabelText(`${fallbackDay} Январь, есть поездки`)).toBeTruthy()
    })
  })

  describe('выбор дня (selectedDate)', () => {
    it('вызывает onDayPress с корректной датой при нажатии на день', () => {
      const onDayPress = jest.fn()
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const { getByLabelText } = render(
        <MiniCalendar entries={[]} onDayPress={onDayPress} />
      )
      fireEvent.press(getByLabelText(`10 ${MONTHS[today.getMonth()]}`))
      expect(onDayPress).toHaveBeenCalledWith(`${year}-${month}-10`)
    })

    it('отмечает выбранный день (accessibilityState.selected = true)', () => {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const selectedDate = `${year}-${month}-10`
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const { getByLabelText } = render(
        <MiniCalendar entries={[]} selectedDate={selectedDate} />
      )
      const dayBtn = getByLabelText(`10 ${MONTHS[today.getMonth()]}`)
      expect(dayBtn.props.accessibilityState?.selected).toBe(true)
    })

    it('не вызывает onDayPress если он не передан', () => {
      const today = new Date()
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const { getByLabelText } = render(<MiniCalendar entries={[]} />)
      expect(() =>
        fireEvent.press(getByLabelText(`5 ${MONTHS[today.getMonth()]}`))
      ).not.toThrow()
    })
  })

  describe('рендер с пустым списком entries', () => {
    it('рендерится без ошибок при entries=[]', () => {
      expect(() => render(<MiniCalendar entries={[]} />)).not.toThrow()
    })
  })

  describe('множество поездок в одном месяце', () => {
    it('корректно обрабатывает несколько записей', () => {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const MONTHS = [
        'Январь', 'Февраль', 'Март', 'Апрель',
        'Май', 'Июнь', 'Июль', 'Август',
        'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
      ]
      const entries = [
        makeEntry(`${year}-${month}-05`, 1),
        makeEntry(`${year}-${month}-10`, 2),
        makeEntry(`${year}-${month}-20`, 3),
      ]
      const { getByLabelText } = render(<MiniCalendar entries={entries} />)
      expect(getByLabelText(`5 ${MONTHS[today.getMonth()]}, есть поездки`)).toBeTruthy()
      expect(getByLabelText(`10 ${MONTHS[today.getMonth()]}, есть поездки`)).toBeTruthy()
      expect(getByLabelText(`20 ${MONTHS[today.getMonth()]}, есть поездки`)).toBeTruthy()
    })
  })
})
