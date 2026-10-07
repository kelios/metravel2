/**
 * #1633, требование 3: отложенная ссылкой «Пропустить» точка обязана иметь в
 * навигации по маршруту собственное состояние — не «пройдена» и не «ещё
 * впереди». До правки в навигации были только `active`/`done`, и точка, которая
 * держит гейт финала, выглядела ровно как та, до которой игрок не дошёл.
 *
 * Тест держит две вещи, которые e2e не ловит:
 *  1. границу «отложена» — точка позади метится, текущая и будущая нет;
 *  2. видимость метки: одна заливка состояние не показывает, поэтому у
 *     отложенной точки контур `warning` и значок «вернуться» — оба из модели
 *     `resolveQuestStepVisualState` (#2146), одной и для пилюли, и для кружка.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react-native'

const mockQueueAnalyticsEvent = jest.fn()
let mockQuestWizardResponsiveModel = {
  screenW: 1280,
  screenH: 900,
  isMobile: false,
  headerInScreenRow: false,
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
jest.mock('@/components/quests/QuestPrintable', () => ({ generatePrintableQuest: jest.fn() }))
jest.mock('@/components/quests/questOfflineMapExport', () => ({
  exportQuestOfflineMap: jest.fn(),
  getQuestOfflineMapPoints: () => [],
  openQuestOfflineMapInApp: jest.fn(),
}))

import { QuestWizard } from '@/components/quests/QuestWizard'
import { QuestFinalePill, QuestStepPill } from '@/components/quests/questWizardNavigation'
import { resolveQuestStepVisualState } from '@/components/quests/questStepVisualState'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'

const colors = getThemedColors(false) as any
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

// #2146: подпись строит `resolveQuestStepVisualState` — «Точка N из M, отложена,
// ждёт ответа»; у пилюли впереди заголовок шага.
const postponedLabel = (position: number, total = 3) => new RegExp(`Точка ${position} из ${total}, отложена, ждёт ответа`)

const pillProps = {
  colors,
  onPress: jest.fn(),
  label: 'Точка 3',
  indexLabel: '3',
  position: 3,
  total: 3,
} as const

afterEach(cleanup)

describe('QuestWizard — граница состояния «отложена» в навигации (#1633)', () => {
  it('actual sidebar keeps an authored optional marker once in text and accessible label', async () => {
    const optionalSteps = [{ ...makeStep('optional', 'Башня (по желанию)'), pointRole: 'optional' as const }]
    const view = render(<QuestWizard title="Роли" steps={optionalSteps} intro={intro} finale={{ story: 'Финал' } as any}
      storageKey="optional_nav_once" questId="optional-nav" cityId="minsk" />)
    await act(async () => { await Promise.resolve() })
    expect(view.getByText('Башня (по желанию)')).toBeTruthy()
    const button = view.getByLabelText(/Башня \(по желанию\).*Точка 1 из 1/)
    expect(button.props.accessibilityLabel).not.toContain('Точка по желанию')
  })

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
    expect(view.queryByLabelText(postponedLabel(1))).toBeNull()

    await act(async () => {
      fireEvent.press(view.getByLabelText('Пропустить шаг'))
      await Promise.resolve()
    })

    // Точка 1 осталась без ответа за спиной — она и держит гейт финала.
    expect(view.getByLabelText(postponedLabel(1))).toBeTruthy()
    // Точка 2 — текущая, точка 3 ещё впереди: долгом их метить нельзя.
    expect(view.queryByLabelText(postponedLabel(2))).toBeNull()
    expect(view.queryByLabelText(postponedLabel(3))).toBeNull()
  })
})

describe('QuestStepPill — метка отложенной точки', () => {
  it('заменяет номер значком возврата и называет состояние словами', () => {
    const view = render(<QuestStepPill {...(pillProps as any)} styles={desktopStyles} pending />)

    expect(view.getByLabelText(postponedLabel(3))).toBeTruthy()
    // Номер уступает место значку: состояние читается и без цвета.
    expect(view.queryByText('3')).toBeNull()
  })

  it('пройденную точку долгом не метит', () => {
    const view = render(<QuestStepPill {...(pillProps as any)} styles={desktopStyles} pending done />)

    expect(view.queryByLabelText(postponedLabel(3))).toBeNull()
    // #2146: пройденная читается словом и галочкой, а не номером.
    expect(view.getByLabelText(/Точка 3 из 3, пройдена/)).toBeTruthy()
    expect(view.queryByText('3')).toBeNull()
  })
})

describe('QuestStepPill — подпись диктора без повторов (#2146)', () => {
  it('финал не повторяет своё название', () => {
    const view = render(<QuestFinalePill colors={colors} styles={desktopStyles} onPress={jest.fn()} />)
    expect(view.getByLabelText('Финал, доступен')).toBeTruthy()
  })

  it('необязательная точка не повторяет роль: она уже в видимой подписи пилюли', () => {
    const view = render(
      <QuestStepPill {...(pillProps as any)} styles={desktopStyles} role="optional" label="Ратуша · Точка по желанию" />,
    )
    expect(view.getByLabelText('Ратуша · Точка по желанию: Точка 3 из 3, доступна')).toBeTruthy()
  })
})

describe('навигация квеста — метка долга видна не только цветом', () => {
  it('отложенная точка обведена контуром warning и несёт значок «вернуться», а не номер', () => {
    for (const theme of [getThemedColors(false), getThemedColors(true)]) {
      const pending = resolveQuestStepVisualState({ state: 'pending', colors: theme })
      const done = resolveQuestStepVisualState({ state: 'done', colors: theme })

      expect(pending.borderWidth).toBeGreaterThan(0)
      expect(pending.borderColor).toBe(theme.warning)
      expect(pending.glyph).toBe('return')
      // Отличие от пройденной точки не сводится к оттенку заливки.
      expect(pending.fill).not.toBe(done.fill)
    }
  })
})
