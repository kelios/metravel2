/**
 * #1633, требование 3: отложенная ссылкой «Пропустить» точка обязана иметь в
 * навигации по маршруту собственное состояние — не «пройдена» и не «ещё
 * впереди». До правки в навигации были только `active`/`done`, и точка, которая
 * держит гейт финала, выглядела ровно как та, до которой игрок не дошёл.
 *
 * Тест держит две вещи, которые e2e не ловит:
 *  1. границу «отложена» — точка позади метится, текущая и будущая нет;
 *  2. видимость метки. Заливка `warningSoft` — 8%: на светлой подложке она даёт
 *     1.04:1 к нейтральной точке и 1.00:1 к пройденной, а на нативе у
 *     `stepDotMiniDone` нет и web-градиента. Один фон состояние не показывает,
 *     поэтому контур обязателен и в пилюле, и в кружке.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

const mockQueueAnalyticsEvent = jest.fn()
let mockQuestWizardResponsiveModel = {
  screenW: 1280,
  screenH: 900,
  isMobile: false,
  compactNav: false,
  compactDesktopLayout: false,
  useWideInlineLayout: false,
  useWideExcursionsSidebar: false,
}

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: (...args: any[]) => mockQueueAnalyticsEvent(...args),
}))
jest.mock('@/components/quests/hooks/useQuestWizardResponsiveModel', () => ({
  useQuestWizardResponsiveModel: () => mockQuestWizardResponsiveModel,
}))
// Карта/экскурсии/финал к навигации отношения не имеют, а тянут за собой сеть.
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestDesktopMapPanel: () => null,
  QuestExcursionsInline: () => null,
  QuestExcursionsSidebar: () => null,
  QuestFinalePanel: () => null,
}))
jest.mock('@/components/quests/useQuestFinaleMedia', () => ({
  useQuestFinaleMedia: () => ({
    frameW: 300,
    videoOk: true,
    setVideoOk: jest.fn(),
    videoUri: undefined,
    posterUri: undefined,
    youtubeEmbedUri: undefined,
    handleVideoError: jest.fn(),
    handleVideoRetry: jest.fn(),
  }),
}))
jest.mock('@/components/quests/useQuestReminder', () => ({ useQuestReminder: jest.fn() }))
jest.mock('@/components/quests/useQuestGeofence', () => ({ useQuestGeofence: jest.fn() }))
jest.mock('@/components/quests/QuestPrintable', () => ({ generatePrintableQuest: jest.fn() }))
jest.mock('@/components/quests/questOfflineMapExport', () => ({
  exportQuestOfflineMap: jest.fn(),
  getQuestOfflineMapPoints: () => [],
  openQuestOfflineMapInApp: jest.fn(),
}))

import { QuestWizard } from '@/components/quests/QuestWizard'
import { QuestStepPill } from '@/components/quests/questWizardNavigation'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'

const colors = getThemedColors(false) as any
const mobileStyles = createQuestWizardStyles(colors, true, 390)
const desktopStyles = createQuestWizardStyles(colors, false, 1280)

const anyAnswer = () => true
// Проверяющий обязан уметь отказывать: чекер, принимающий пустую строку, визард
// считает уже отвеченной точкой и вместо поля с ссылкой «Пропустить» показывает
// «Далее» — той ветки, ради которой тест написан, не было бы вовсе.
const exactAnswer = (value: string) => value.trim().toLowerCase() === 'ответ'
const makeStep = (id: string, title: string) => ({
  id,
  title,
  location: '',
  story: `Story ${id}`,
  task: `Task ${id}`,
  lat: 53.9,
  lng: 27.56,
  answer: exactAnswer,
})

const intro = { id: 'intro', title: 'Intro', location: '', story: 'Начало', task: '', lat: 53.9, lng: 27.56, answer: anyAnswer }
const steps = [makeStep('s1', 'Точка 1'), makeStep('s2', 'Точка 2'), makeStep('s3', 'Точка 3')]

const postponedLabel = (title: string) => `${title} — отложена, ждёт ответа`

const pillProps = {
  colors,
  onPress: jest.fn(),
  label: 'Точка 3',
  indexLabel: '3',
} as const

afterEach(cleanup)

describe('QuestWizard — граница состояния «отложена» в навигации (#1633)', () => {
  it('метит только точку позади: текущая и ещё не пройденная долгом не считаются', async () => {
    const view = render(
      <QuestWizard
        title="Тест-квест"
        steps={steps}
        finale={{ story: 'Финал' } as any}
        intro={intro}
        storageKey="postponed_nav_quest"
        questId="test-quest"
        cityId="minsk"
      />,
    )

    // Асинхронный load-эффект прогресса иначе откатит курсор после старта.
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.press(view.getByText('Начать квест'))
      await Promise.resolve()
    })

    // До пропуска долга нет ни у одной точки.
    expect(view.queryByLabelText(postponedLabel('Точка 1'))).toBeNull()

    await act(async () => {
      fireEvent.press(view.getByLabelText('Пропустить шаг'))
      await Promise.resolve()
    })

    // Точка 1 осталась без ответа за спиной — она и держит гейт финала.
    expect(view.getByLabelText(postponedLabel('Точка 1'))).toBeTruthy()
    // Точка 2 — текущая, точка 3 ещё впереди: долгом их метить нельзя.
    expect(view.queryByLabelText(postponedLabel('Точка 2'))).toBeNull()
    expect(view.queryByLabelText(postponedLabel('Точка 3'))).toBeNull()
  })
})

describe('QuestStepPill — метка отложенной точки', () => {
  it('заменяет номер значком возврата и называет состояние словами', () => {
    const view = render(<QuestStepPill {...(pillProps as any)} styles={desktopStyles} pending />)

    expect(view.getByLabelText(postponedLabel('Точка 3'))).toBeTruthy()
    // Номер уступает место значку: состояние читается и без цвета.
    expect(view.queryByText('3')).toBeNull()
  })

  it('пройденную точку долгом не метит', () => {
    const view = render(<QuestStepPill {...(pillProps as any)} styles={desktopStyles} pending done />)

    expect(view.queryByLabelText(postponedLabel('Точка 3'))).toBeNull()
    expect(view.getByText('3')).toBeTruthy()
  })
})

describe('навигация квеста — метка долга видна не только цветом', () => {
  const flat = (style: unknown) => StyleSheet.flatten(style as any) as any

  it('кружок отложенной точки обведён контуром: заливка 8% состояние не показывает', () => {
    for (const [surface, styles] of [['mobile', mobileStyles], ['desktop', desktopStyles]] as const) {
      const pending = flat([styles.stepDotMini, styles.stepDotMiniUnlocked, styles.stepDotMiniPending])
      const done = flat([styles.stepDotMini, styles.stepDotMiniUnlocked, styles.stepDotMiniDone])

      expect({ surface, border: pending.borderWidth > 0 }).toEqual({ surface, border: true })
      expect(pending.borderColor).toBe(colors.warning)
      // Отличие от пройденной точки не сводится к оттенку заливки.
      expect(pending.borderWidth).not.toBe(done.borderWidth ?? 0)
    }
  })

  it('пилюля отложенной точки обведена тем же контуром', () => {
    const pending = flat([desktopStyles.stepPill, desktopStyles.stepPillUnlocked, desktopStyles.stepPillPending])

    expect(pending.borderWidth).toBeGreaterThan(0)
    expect(pending.borderColor).toBe(colors.warning)
  })
})
