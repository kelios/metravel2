/**
 * Панель прохождения квеста (`QuestHeaderPanel`) на телефоне и на desktop.
 *
 * #1669 увёл редкие действия с телефона в лист «Ещё», #2148 — весь ряд
 * действий и мету в строку экрана (декларация `useQuestScreenHeader`, её
 * проводку держит `questScreenHeader.test.tsx`). Здесь держится обратная
 * сторона: на телефоне панель НЕ рисует ни ряд кнопок, ни ряд меты, ни второй
 * заголовок первого уровня, но оставляет навигацию и статусы, требующие
 * внимания. Desktop сохраняет прежний ряд целиком.
 */
import React from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react-native'
import { Platform, Text } from 'react-native'

// Экскурсии к шапке отношения не имеют, а тянут за собой сеть.
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestCompactExcursions: () => null,
}))
jest.mock('@/components/ui/ActionTooltip', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    __esModule: true,
    default: ({ visible, label, onDismiss }: { visible: boolean; label: string; onDismiss: () => void }) =>
      visible ? React.createElement(Text, { testID: 'action-tooltip', onPress: onDismiss }, label) : null,
  }
})

import { QuestHeaderPanel } from '@/components/quests/questWizardShell'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'
import type { QuestCountModel } from '@/utils/questCountModel'

const colors = getThemedColors(false) as any

const countModel: QuestCountModel = {
  total: 2,
  start: 1,
  progressTotal: 2,
  required: 2,
  optional: 0,
  final: 0,
  source: 'explicit',
}

type HeaderOverrides = {
  isMobile: boolean
  compactNav?: boolean
  offlineMapPointsCount?: number
  statusSlot?: React.ReactNode
}

const renderHeader = (overrides: HeaderOverrides) => {
  const { isMobile, offlineMapPointsCount = 3, statusSlot } = overrides
  const compactNav = overrides.compactNav ?? isMobile
  const screenW = isMobile ? (compactNav ? 390 : 680) : 1024
  const handlers = {
    onReset: jest.fn(),
    onPrintDownload: jest.fn(),
    onOfflineMapDownload: jest.fn(),
    onOfflineMapOpenInApp: jest.fn(),
    onOfflineQuestDownload: jest.fn(),
    goToStep: jest.fn(),
    onShowFinale: jest.fn(),
  }

  const view = render(
    <QuestHeaderPanel
      colors={colors}
      styles={createQuestWizardStyles(colors, isMobile, screenW)}
      title="Квест шапки"
      progress={0.5}
      completedCount={1}
      stepsCount={2}
      countModel={countModel}
      allSteps={[
        { id: 'intro', title: 'Старт' },
        { id: 'step-1', title: 'Точка 1' },
      ]}
      answers={{}}
      postponedStepIds={new Set<string>()}
      currentIndex={1}
      unlockedIndex={1}
      questFinished={false}
      showFinaleOnly={false}
      headerInScreenRow={isMobile}
      screenW={screenW}
      compactNav={compactNav}
      offlineMapPointsCount={offlineMapPointsCount}
      offlineQuestState="idle"
      ratingSlot={<Text testID="rating-slot">4,6</Text>}
      completionSlot={<Text testID="completion-slot">Пройден</Text>}
      statusSlot={statusSlot}
      {...handlers}
    />,
  )

  return { ...view, handlers }
}

afterEach(cleanup)

describe('панель квеста на телефоне — действия и мета в строке экрана (#2148)', () => {
  it('не рисует ряд кнопок, ряд меты и второй заголовок', () => {
    const { queryByTestId, queryByLabelText, queryByRole } = renderHeader({ isMobile: true })

    expect(queryByTestId('quest-header-actions')).toBeNull()
    expect(queryByTestId('feather-more-horizontal')).toBeNull()
    expect(queryByLabelText('Скачать квест для офлайна')).toBeNull()
    expect(queryByLabelText('Сбросить прогресс')).toBeNull()
    expect(queryByTestId('rating-slot')).toBeNull()
    expect(queryByTestId('completion-slot')).toBeNull()
    // Заголовок первого уровня на телефоне — название в строке экрана.
    expect(queryByRole('header')).toBeNull()
  })

  it('оставляет полосу маршрута (< 600 px)', () => {
    const { getByTestId } = renderHeader({ isMobile: true })

    expect(getByTestId('quest-route-strip')).toBeTruthy()
  })

  it('от 600 до 767 px — полоса прогресса со счётчиком и пилюли, без ряда кнопок', () => {
    const { getByText, getByTestId, queryByTestId } = renderHeader({ isMobile: true, compactNav: false })

    expect(getByText(/Задания: 1 \/ 2/)).toBeTruthy()
    expect(getByTestId('quest-nav-finale')).toBeTruthy()
    expect(queryByTestId('quest-header-actions')).toBeNull()
  })

  it('статусы, требующие внимания, видны над навигацией и только когда они есть', () => {
    const withStatus = renderHeader({ isMobile: true, statusSlot: <Text testID="pending">Ждёт отправки</Text> })
    expect(withStatus.getByTestId('quest-header-status')).toBeTruthy()
    expect(withStatus.getByTestId('pending')).toBeTruthy()
    withStatus.unmount()

    const withoutStatus = renderHeader({ isMobile: true })
    expect(withoutStatus.queryByTestId('quest-header-status')).toBeNull()
  })
})

describe('панель квеста на desktop', () => {
  it('ряд остаётся прежним: название, мета и все действия с подписями для диктора', () => {
    const { getByLabelText, getByRole, getByTestId, queryByTestId } = renderHeader({ isMobile: false })

    expect(getByRole('header').props.children).toBe('Квест шапки')
    expect(getByTestId('rating-slot')).toBeTruthy()
    expect(getByTestId('completion-slot')).toBeTruthy()
    expect(getByTestId('quest-header-actions')).toBeTruthy()
    expect(queryByTestId('feather-more-horizontal')).toBeNull()
    expect(getByLabelText('Сбросить прогресс')).toBeTruthy()
    expect(getByLabelText(/Скачать GPX/)).toBeTruthy()
    expect(getByLabelText('Открыть точки квеста в приложении карт')).toBeTruthy()
    expect(getByLabelText('Скачать квест для офлайна')).toBeTruthy()
    expect(queryByTestId('quest-header-status')).toBeNull()
  })

  it('кнопка ряда действительно вызывает действие', () => {
    const { getByLabelText, handlers } = renderHeader({ isMobile: false })

    fireEvent.press(getByLabelText('Сбросить прогресс'))

    expect(handlers.onReset).toHaveBeenCalledTimes(1)
  })
})

describe('подсказки действий квеста на web', () => {
  const originalOS = Platform.OS
  beforeEach(() => { Platform.OS = 'web' })
  afterEach(() => { Platform.OS = originalOS })

  it('остаётся видимой при уходе мыши с кнопки в фокусе', () => {
    const { getByLabelText, getByTestId, queryByTestId } = renderHeader({ isMobile: false })
    const button = getByLabelText('Скачать квест для офлайна')
    fireEvent(button, 'hoverIn')
    fireEvent(button, 'focus')
    fireEvent(button, 'hoverOut')
    expect(getByTestId('action-tooltip').props.children).toBe('Скачать офлайн')
    fireEvent(button, 'blur')
    expect(queryByTestId('action-tooltip')).toBeNull()
  })

  it('остаётся видимой при потере фокуса под мышью и закрывается по dismiss', () => {
    const { getByLabelText, getByTestId, queryByTestId } = renderHeader({ isMobile: false })
    const button = getByLabelText('Скачать квест для офлайна')
    fireEvent(button, 'hoverIn')
    fireEvent(button, 'focus')
    fireEvent(button, 'blur')
    fireEvent.press(getByTestId('action-tooltip'))
    expect(queryByTestId('action-tooltip')).toBeNull()
    fireEvent(button, 'hoverOut')
    fireEvent(button, 'hoverIn')
    expect(getByTestId('action-tooltip')).toBeTruthy()
  })

  it('не показывает подсказку у недоступного действия', () => {
    const { getByLabelText, queryByTestId } = renderHeader({ isMobile: false, offlineMapPointsCount: 0 })
    fireEvent(getByLabelText(/Скачать GPX/), 'hoverIn')
    expect(queryByTestId('action-tooltip')).toBeNull()
  })

})
