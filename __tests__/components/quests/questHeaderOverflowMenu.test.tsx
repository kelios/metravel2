/**
 * #1669: редкие действия шапки квеста (сброс, GPX, «открыть в приложении»,
 * печать) уехали с телефона в лист «Ещё».
 *
 * Тест держит проводку, а не раскладку. E2E-спека проверяет, что подписи в
 * листе ЕСТЬ, но не что строка листа действительно зовёт обработчик, — а именно
 * это ломается тише всего: `ActionListSheet` сам закрывает лист перед вызовом
 * (`components/ui/ActionListSheet.tsx`), и потерянный `onPress` выглядел бы как
 * «нажал сброс — ничего не произошло».
 *
 * Второй инвариант — десктоп: ветка `!isMobile` обязана сохранить прежний ряд
 * целиком, без кнопки «Ещё».
 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

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

const renderHeader = (overrides: { isMobile: boolean; offlineMapPointsCount?: number }) => {
  const { isMobile, offlineMapPointsCount = 3 } = overrides
  const screenW = isMobile ? 390 : 1024
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
      isMobile={isMobile}
      screenW={screenW}
      compactNav={isMobile}
      offlineMapPointsCount={offlineMapPointsCount}
      offlineQuestState="idle"
      {...handlers}
    />,
  )

  return { ...view, handlers }
}

afterEach(cleanup)

describe('шапка квеста — меню «Ещё» на телефоне', () => {
  it('держит счётчик заданий однострочным', () => {
    const { getByText } = renderHeader({ isMobile: true })

    // Ищем счётчик по содержимому, а не по позиции среди Text-узлов: он обязан
    // оставаться однострочным, иначе на узкой UK-локали ломается геометрия ряда.
    // #2149: на телефоне (< 600 px) счётчик живёт в полосе маршрута рядом с позицией.
    expect(getByText(/Задания: 1 \/ 2/).props.numberOfLines).toBe(1)
  })

  it('убирает редкие действия из ряда, но отдаёт их листу', () => {
    const { queryByLabelText, getByLabelText } = renderHeader({ isMobile: true })

    // Лист закрыт: действий нет нигде, включая сам ряд.
    expect(queryByLabelText('Сбросить прогресс')).toBeNull()
    expect(queryByLabelText(/Скачать GPX/)).toBeNull()
    expect(queryByLabelText('Открыть точки квеста в приложении карт')).toBeNull()

    fireEvent.press(getByLabelText('Действия с квестом'))

    expect(getByLabelText('Сбросить прогресс')).toBeTruthy()
    expect(getByLabelText(/Скачать GPX/)).toBeTruthy()
    expect(getByLabelText('Открыть точки квеста в приложении карт')).toBeTruthy()
  })

  it('строка листа действительно вызывает действие', async () => {
    const { getByLabelText, handlers } = renderHeader({ isMobile: true })

    fireEvent.press(getByLabelText('Действия с квестом'))
    fireEvent.press(getByLabelText('Сбросить прогресс'))

    // На iOS пункт листа выполняется после закрытия листа (onDismiss / таймер, #2115).
    await waitFor(() => expect(handlers.onReset).toHaveBeenCalledTimes(1))
  })

  it('не показывает экспорт точек, когда точек нет', () => {
    const { getByLabelText, queryByLabelText } = renderHeader({
      isMobile: true,
      offlineMapPointsCount: 0,
    })

    fireEvent.press(getByLabelText('Действия с квестом'))

    // Мёртвая строка в листе запрещена: экспортировать нечего.
    expect(queryByLabelText(/Скачать GPX/)).toBeNull()
    expect(queryByLabelText('Открыть точки квеста в приложении карт')).toBeNull()
    expect(getByLabelText('Сбросить прогресс')).toBeTruthy()
  })

  it('на десктопе ряд остаётся прежним и без кнопки «Ещё»', () => {
    const { getByLabelText, queryByLabelText } = renderHeader({ isMobile: false })

    expect(queryByLabelText('Действия с квестом')).toBeNull()
    expect(getByLabelText('Сбросить прогресс')).toBeTruthy()
    expect(getByLabelText(/Скачать GPX/)).toBeTruthy()
    expect(getByLabelText('Открыть точки квеста в приложении карт')).toBeTruthy()
    expect(getByLabelText('Скачать квест для офлайна')).toBeTruthy()
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

  it('не показывает desktop-подсказку на телефоне', () => {
    const { getByLabelText, queryByTestId } = renderHeader({ isMobile: true })
    fireEvent(getByLabelText('Скачать квест для офлайна'), 'focus')
    expect(queryByTestId('action-tooltip')).toBeNull()
  })
})
