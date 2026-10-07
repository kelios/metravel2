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
import { act, cleanup, fireEvent, render } from '@testing-library/react-native'
import { Platform, StyleSheet, Text } from 'react-native'

let mockContentLocale = 'pl'
jest.mock('@/hooks/useQuestContentLocale', () => ({
  useQuestContentLocale: () => mockContentLocale,
}))

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
import QuestContentLocaleNotice from '@/components/quests/QuestContentLocaleNotice'
import { i18n } from '@/i18n'
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
  contentLocaleSlot?: React.ReactNode
  screenW?: number
  currentIndex?: number
  showFinaleOnly?: boolean
}

const renderHeader = (overrides: HeaderOverrides) => {
  const { isMobile, offlineMapPointsCount = 3, statusSlot, contentLocaleSlot } = overrides
  const compactNav = overrides.compactNav ?? isMobile
  const screenW = overrides.screenW ?? (isMobile ? (compactNav ? 390 : 680) : 1024)
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
      currentIndex={overrides.currentIndex ?? 1}
      unlockedIndex={1}
      questFinished={false}
      showFinaleOnly={overrides.showFinaleOnly ?? false}
      headerInScreenRow={isMobile}
      screenW={screenW}
      compactNav={compactNav}
      offlineMapPointsCount={offlineMapPointsCount}
      offlineQuestState="idle"
      ratingSlot={<Text testID="rating-slot">4,6</Text>}
      completionSlot={<Text testID="completion-slot">Пройден</Text>}
      statusSlot={statusSlot}
      contentLocaleSlot={contentLocaleSlot}
      {...handlers}
    />,
  )

  return { ...view, handlers }
}

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('ru')
})
beforeEach(() => { mockContentLocale = 'pl' })

describe('пометка языка рядом с маршрутом (#2198)', () => {
  it.each([320, 390])('пассивная пометка не вложена в кнопку и не добавляет ряд статусов на %s', (screenW) => {
    const screen = renderHeader({
      isMobile: true,
      screenW,
      contentLocaleSlot: <QuestContentLocaleNotice contentLocale="ru" compact />,
    })
    const row = screen.getByTestId('quest-locale-route-row')
    const route = screen.getByTestId('quest-route-strip')
    const notice = screen.getByTestId('quest-content-locale-notice')
    expect(StyleSheet.flatten(row.props.style).height).toBe(44)
    expect(StyleSheet.flatten(route.props.style).height).toBe(44)
    expect(StyleSheet.flatten(route.props.style).minHeight).toBeGreaterThanOrEqual(44)
    expect(screen.queryByTestId('quest-header-status')).toBeNull()
    expect(row.findAll((node) => node.props.testID === 'quest-content-locale-notice').length).toBeGreaterThan(0)
    expect(route.findAll((node) => node.props.testID === 'quest-content-locale-notice')).toHaveLength(0)
    expect(notice.props.accessibilityLabel).toContain('Русский')
    expect(notice.props.onPress).toBeUndefined()
    expect(screen.getByLabelText('Маршрут: Точка 1 из 1, задания 1 из 2')).toBeTruthy()
    expect(screen.getByText('1/1')).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
    fireEvent.press(route)
    expect(screen.getByTestId('quest-route-sheet')).toBeTruthy()
    fireEvent.press(screen.getByTestId('quest-route-row-step-1'))
    expect(screen.handlers.goToStep).toHaveBeenCalledWith(1)
    fireEvent.press(route)
    fireEvent.press(screen.getByTestId('quest-nav-finale'))
    expect(screen.handlers.onShowFinale).toHaveBeenCalledTimes(1)
  })

  it('pending и статус фото остаются независимыми от пассивной пометки', () => {
    const screen = renderHeader({
      isMobile: true,
      contentLocaleSlot: <QuestContentLocaleNotice contentLocale="ru" compact />,
      statusSlot: <><Text testID="pending">Ждёт отправки</Text><Text testID="photo">Фото ждёт проверки</Text></>,
    })
    const status = screen.getByTestId('quest-header-status')
    const route = screen.getByTestId('quest-route-strip')
    expect(status.findAll((node) => node.props.testID === 'quest-content-locale-notice')).toHaveLength(0)
    expect(route.findAll((node) => node.props.testID === 'pending' || node.props.testID === 'photo')).toHaveLength(0)
    expect(screen.getByTestId('pending')).toBeTruthy()
    expect(screen.getByTestId('photo')).toBeTruthy()
    expect(screen.getByTestId('quest-content-locale-notice')).toBeTruthy()
  })

  it.each([
    [{ currentIndex: 0 }, 'Старт'],
    [{ showFinaleOnly: true }, 'Финал'],
  ] as const)('старт и финал остаются именованными состояниями: %s', (position, label) => {
    const screen = renderHeader({
      isMobile: true,
      ...position,
      contentLocaleSlot: <QuestContentLocaleNotice contentLocale="ru" compact />,
    })
    expect(screen.getByText(label)).toBeTruthy()
    expect(screen.queryByText('0/1')).toBeNull()
    expect(screen.getByText('1/2')).toBeTruthy()
  })

  it('без языкового слота сохраняет прежний ряд маршрута', () => {
    const screen = renderHeader({ isMobile: true, contentLocaleSlot: null })
    expect(screen.queryByTestId('quest-locale-route-row')).toBeNull()
    expect(screen.queryByTestId('quest-header-status')).toBeNull()
    expect(screen.queryByTestId('quest-content-locale-notice')).toBeNull()
    expect(screen.getByText('Точка 1 из 1 · Задания: 1 / 2')).toBeTruthy()
  })

  it.each([600, 767])('%s сохраняет язык и статусы в прежнем ряду над прогрессом', (screenW) => {
    const screen = renderHeader({
      isMobile: true,
      compactNav: false,
      screenW,
      contentLocaleSlot: <QuestContentLocaleNotice contentLocale="ru" compact />,
      statusSlot: <Text testID="pending">Ждёт отправки</Text>,
    })
    expect(screen.queryByTestId('quest-locale-route-row')).toBeNull()
    expect(screen.queryByTestId('quest-route-strip')).toBeNull()
    const status = screen.getByTestId('quest-header-status')
    expect(status.findAll((node) => node.props.testID === 'quest-content-locale-notice').length).toBeGreaterThan(0)
    expect(status.findAll((node) => node.props.testID === 'pending').length).toBeGreaterThan(0)
    expect(screen.getByTestId('quest-content-locale-notice')).toBeTruthy()
    expect(screen.getByTestId('pending')).toBeTruthy()
    expect(screen.getByText(/Задания: 1 \/ 2/)).toBeTruthy()
  })

  it('desktop не дублирует язык из существующего completionSlot', () => {
    const screen = renderHeader({
      isMobile: false,
      screenW: 1440,
      contentLocaleSlot: <QuestContentLocaleNotice contentLocale="ru" compact />,
    })
    expect(screen.queryByTestId('quest-locale-route-row')).toBeNull()
    expect(screen.queryByTestId('quest-content-locale-notice')).toBeNull()
    expect(screen.queryByTestId('quest-header-status')).toBeNull()
    expect(screen.getByTestId('completion-slot')).toBeTruthy()
    expect(screen.getByRole('header')).toBeTruthy()
  })

  it('смена языка обновляет видимый старт и доступную подпись без нового route model input', async () => {
    const screen = renderHeader({
      isMobile: true,
      currentIndex: 0,
      contentLocaleSlot: <QuestContentLocaleNotice contentLocale="ru" compact />,
    })
    expect(screen.getByText('Старт')).toBeTruthy()
    const beforeLabel = screen.getByTestId('quest-route-strip').props.accessibilityLabel
    await act(async () => { await i18n.changeLanguage('en') })
    expect(screen.queryByText('Старт')).toBeNull()
    expect(screen.getByText('Start')).toBeTruthy()
    expect(screen.getByTestId('quest-route-strip').props.accessibilityLabel).not.toBe(beforeLabel)
    expect(screen.getByLabelText('Route: Quest start, tasks 1 of 2')).toBeTruthy()
    expect(screen.getByTestId('quest-route-strip').props.accessibilityHint).toBe('Opens the list of all route points')
    fireEvent.press(screen.getByTestId('quest-route-strip'))
    expect(screen.getByText('Quest start')).toBeTruthy()
    expect(screen.getByText('Finale')).toBeTruthy()
    expect(screen.queryByText('Старт квеста')).toBeNull()
    expect(screen.queryByText('Финал')).toBeNull()
    fireEvent.press(screen.getByTestId('quest-route-row-step-1'))
    expect(screen.handlers.goToStep).toHaveBeenCalledWith(1)
  })
})

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
