import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
import { render } from '@testing-library/react-native'
import type { ProgressionLine } from '@/api/gamification'

// react-native-svg подхватывается глобальным __mocks__/react-native-svg.js автоматически.

// DESIGN_TOKENS — минимальный стаб, зеркало RankBar.test.tsx
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    spacing: { xs: 4, sm: 8, md: 16 },
    typography: { sizes: { xs: 12, sm: 14, md: 16 } },
  },
}))

// useTheme/useThemedColors мокается глобально в __tests__/setup.ts.
// engravingPaper и badgeVisuals используют реальные модули — мок не нужен.

import ProgressionLineBar from '@/components/achievements/ProgressionLineBar'

// ── fixtures ───────────────────────────────────────────────────────────────────

const makeLine = (overrides: Partial<ProgressionLine> = {}): ProgressionLine => ({
  slug: 'dog',
  name: 'Собачья',
  activityKind: 'participant',
  activityName: 'Участник',
  description: 'Совместные поездки, к которым вы присоединились',
  level: 2,
  levelTitle: 'Следопыт стаи',
  current: 47,
  currentLevelMin: 25,
  nextLevelMin: 75,
  nextLevelTitle: 'Надёжный спутник',
  isMaxLevel: false,
  emoji: '🐕',
  ...overrides,
})

// ── 1. Не-max линейка: базовые поля ───────────────────────────────────────────

describe('ProgressionLineBar — не-max линейка', () => {
  it('рендерит activityName как заголовок трека', async () => {
    const { getByText } = await render(<ProgressionLineBar line={makeLine({ activityName: 'Участник' })} />)
    expect(getByText('Участник')).toBeTruthy()
  })

  it('рендерит чип уровня в формате "Ур. {level}"', async () => {
    const { getByText } = await render(<ProgressionLineBar line={makeLine({ level: 2 })} />)
    expect(getByText('Ур. 2')).toBeTruthy()
  })

  it('рендерит description из пропа line.description', async () => {
    const { getByText } = await render(
      <ProgressionLineBar
        line={makeLine({ description: 'Совместные поездки, к которым вы присоединились' })}
      />,
    )
    expect(getByText('Совместные поездки, к которым вы присоединились')).toBeTruthy()
  })

  it('рендерит значение current', async () => {
    const { getByText } = await render(<ProgressionLineBar line={makeLine({ current: 47 })} />)
    expect(getByText('47')).toBeTruthy()
  })

  it('рендерит подпись "очк." рядом с current', async () => {
    const { getByText } = await render(<ProgressionLineBar line={makeLine()} />)
    expect(getByText('очк.')).toBeTruthy()
  })

  it('рендерит подпись прогресса с remaining = nextLevelMin - current', async () => {
    // current=47, nextLevelMin=75 → remaining=28
    const { getByText } = await render(
      <ProgressionLineBar
        line={makeLine({
          current: 47,
          currentLevelMin: 25,
          nextLevelMin: 75,
          levelTitle: 'Следопыт стаи',
          nextLevelTitle: 'Надёжный спутник',
        })}
      />,
    )
    expect(getByText('«Следопыт стаи» · ещё 28 до «Надёжный спутник»')).toBeTruthy()
  })

  it('remaining корректно считается при current=currentLevelMin (только начал уровень)', async () => {
    // current=25, nextLevelMin=75 → remaining=50
    const { getByText } = await render(
      <ProgressionLineBar
        line={makeLine({
          current: 25,
          currentLevelMin: 25,
          nextLevelMin: 75,
          levelTitle: 'Следопыт стаи',
          nextLevelTitle: 'Надёжный спутник',
        })}
      />,
    )
    expect(getByText('«Следопыт стаи» · ещё 50 до «Надёжный спутник»')).toBeTruthy()
  })
})

// ── 2. Max-линейка ─────────────────────────────────────────────────────────────

describe('ProgressionLineBar — максимальный уровень', () => {
  const maxLine = makeLine({
    slug: 'fox',
    activityKind: 'reader',
    level: 5,
    levelTitle: 'Мудрая лиса',
    current: 1523,
    currentLevelMin: 300,
    nextLevelMin: null,
    nextLevelTitle: null,
    isMaxLevel: true,
  })

  it('рендерит подпись «"levelTitle" — максимальный уровень»', async () => {
    const { getByText } = await render(<ProgressionLineBar line={maxLine} />)
    expect(getByText('«Мудрая лиса» — максимальный уровень')).toBeTruthy()
  })

  it('НЕ рендерит текст "ещё ... до" в подписи при максимальном уровне', async () => {
    const { queryByText } = await render(<ProgressionLineBar line={maxLine} />)
    expect(queryByText(/ещё \d+ до/)).toBeNull()
  })
})

// ── 3. FE-фолбэк описания ─────────────────────────────────────────────────────

describe('ProgressionLineBar — FE-фолбэк ACTIVITY_DESC', () => {
  it('показывает ACTIVITY_DESC[participant] когда description=null', async () => {
    const { getByText } = await render(
      <ProgressionLineBar
        line={makeLine({ activityKind: 'participant', description: null })}
      />,
    )
    expect(getByText('Совместные поездки, к которым вы присоединились')).toBeTruthy()
  })

  it('показывает ACTIVITY_DESC[author] когда description=null и activityKind=author', async () => {
    const { getByText } = await render(
      <ProgressionLineBar
        line={makeLine({
          slug: 'boar',
          activityKind: 'author',
          description: null,
        })}
      />,
    )
    expect(getByText('Опубликованные путешествия и статьи')).toBeTruthy()
  })

  it('показывает ACTIVITY_DESC[reader] когда description=null и activityKind=reader', async () => {
    const { getByText } = await render(
      <ProgressionLineBar
        line={makeLine({
          slug: 'fox',
          activityKind: 'reader',
          description: null,
        })}
      />,
    )
    expect(getByText('Прочитанные истории путешествий')).toBeTruthy()
  })

  it('показывает ACTIVITY_DESC[explorer] когда description=null и activityKind=explorer', async () => {
    const { getByText } = await render(
      <ProgressionLineBar
        line={makeLine({
          slug: 'bird',
          activityKind: 'explorer',
          description: null,
        })}
      />,
    )
    expect(getByText('Открытые места и точки на карте')).toBeTruthy()
  })

  it('BE-приоритет: при непустом description показывается именно он, а не фолбэк', async () => {
    const { getByText, queryByText } = await render(
      <ProgressionLineBar
        line={makeLine({
          activityKind: 'participant',
          description: 'Кастомное описание от бэкенда',
        })}
      />,
    )
    expect(getByText('Кастомное описание от бэкенда')).toBeTruthy()
    expect(queryByText('Совместные поездки, к которым вы присоединились')).toBeNull()
  })
})

// ── 4. Регрессионный assert: name зверя НЕ в тексте трека ─────────────────────

describe('ProgressionLineBar — регрессия: звериное имя тропы убрано из вёрстки', () => {
  it('текст line.name ("Собачья") НЕ рендерится как текстовый узел', async () => {
    const { queryByText } = await render(
      <ProgressionLineBar line={makeLine({ name: 'Собачья' })} />,
    )
    // Имя тропы несёт только иконка-медальон, в текстовом дереве его быть не должно.
    expect(queryByText('Собачья')).toBeNull()
  })

  it('текст line.name ("Кабанья") НЕ рендерится как текстовый узел', async () => {
    const { queryByText } = await render(
      <ProgressionLineBar
        line={makeLine({ slug: 'boar', name: 'Кабанья', activityKind: 'author' })}
      />,
    )
    expect(queryByText('Кабанья')).toBeNull()
  })
})

// ── 5. Прочее ─────────────────────────────────────────────────────────────────

describe('ProgressionLineBar — прочее', () => {
  it('принимает testID и пробрасывает в корневой элемент', async () => {
    const { getByTestId } = await render(
      <ProgressionLineBar line={makeLine()} testID="progression-line-bar-test" />,
    )
    expect(getByTestId('progression-line-bar-test')).toBeTruthy()
  })

  it('корневой элемент имеет accessibilityRole="summary"', async () => {
    const { container } = await render(<ProgressionLineBar line={makeLine()} />)
    expect(getOnlyHost(container, node => node.props.accessibilityRole === 'summary')).toBeTruthy()
  })

  it('рендерится без краша когда current превышает nextLevelMin (remaining зажат в 0)', async () => {
    // remaining = max(0, 75 - 200) = 0
    const { getByText } = await render(
      <ProgressionLineBar
        line={makeLine({
          current: 200,
          currentLevelMin: 25,
          nextLevelMin: 75,
          levelTitle: 'Следопыт стаи',
          nextLevelTitle: 'Надёжный спутник',
        })}
      />,
    )
    expect(getByText('«Следопыт стаи» · ещё 0 до «Надёжный спутник»')).toBeTruthy()
  })
})
