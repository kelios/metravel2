/**
 * Регрессия на семейство «интерактивный элемент меньше минимального тач-таргета»
 * (#192 → #1044 → #1271 → #1274) на экране мастера квеста.
 *
 * Приёмка #1274 нашла тут целый экран недомерков: шесть иконочных действий шапки
 * по 36dp и чипы шагов по 26dp. Гард их не видел, потому что стили объявлены в
 * `questWizardStyles/*.ts` и приезжают в JSX пропом, — эту дыру закрывает второй
 * проход `scanStyleModule`, а этот тест держит сами размеры.
 *
 * hitSlop здесь не засчитывается принципиально: и ряд шапки, и полоса шагов
 * обтягивают своих потомков вплотную, а на Android hitSlop потомка проверяется
 * только после попадания внутрь родителя. Именно поэтому #192 был закрыт
 * hitSlop'ом и всё равно остался сломанным.
 */
import { cleanup, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { QuestFinaleDot, QuestStepDot, QuestStepPill } from '@/components/quests/questWizardNavigation'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'

const MIN_TOUCH_TARGET = 44

const colors = getThemedColors(false) as any
const mobileStyles = createQuestWizardStyles(colors, true, 390)
const desktopStyles = createQuestWizardStyles(colors, false, 1280)

const dotProps = {
  colors: { textOnPrimary: '#fff', primaryText: '#000' },
  onPress: jest.fn(),
  label: '3',
} as const

afterEach(cleanup)

describe('мастер квеста — тач-таргеты шапки', () => {
  it('иконочное действие держит 44dp по обеим осям (было 36 на мобильном, 38 на десктопе)', () => {
    for (const [surface, styles] of [['mobile', mobileStyles], ['desktop', desktopStyles]] as const) {
      const style = StyleSheet.flatten(styles.actionIconButton) as any
      expect({ surface, width: style.width, height: style.height, minHeight: style.minHeight }).toEqual({
        surface,
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        minHeight: MIN_TOUCH_TARGET,
      })
    }
  })

  it('иконочный вариант не ужимает подписанный: оба варианта не ниже 44dp', () => {
    // Корень дефекта: `actionIconButton` применяется ПОСЛЕ базового стиля и
    // раньше перебивал его `minHeight: 44` вниз.
    const base = StyleSheet.flatten(mobileStyles.actionLabelButton) as any
    const merged = StyleSheet.flatten([mobileStyles.actionLabelButton, mobileStyles.actionIconButton]) as any

    expect(base.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
    expect(merged.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  })

  it('основная навигация шага держит 44dp', () => {
    expect((StyleSheet.flatten(mobileStyles.navButton) as any).minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)

    const toggle = StyleSheet.flatten(mobileStyles.navToggle) as any
    expect({ width: toggle.width, height: toggle.height }).toEqual({
      width: MIN_TOUCH_TARGET,
      height: MIN_TOUCH_TARGET,
    })
  })
})

describe('мастер квеста — тач-таргеты шагового навигатора', () => {
  // Корень дерева — сам Pressable, первый потомок — видимая фигура внутри рамки.
  const targetStyle = (tree: any) => StyleSheet.flatten(tree.props.style) as any
  const surfaceStyle = (tree: any) => StyleSheet.flatten(tree.children[0].props.style) as any

  it('чип шага нажимается рамкой 44dp, а видимый кружок остаётся 26dp', () => {
    const tree = render(<QuestStepDot {...(dotProps as any)} styles={mobileStyles} />).toJSON()

    const target = targetStyle(tree)
    expect({ width: target.width, height: target.height }).toEqual({
      width: MIN_TOUCH_TARGET,
      height: MIN_TOUCH_TARGET,
    })

    const circle = surfaceStyle(tree)
    expect({ width: circle.width, height: circle.height }).toEqual({ width: 26, height: 26 })
  })

  it('узкий экран уменьшает кружок, но не тач-таргет', () => {
    const tree = render(<QuestStepDot {...(dotProps as any)} styles={mobileStyles} small />).toJSON()

    expect(targetStyle(tree).height).toBe(MIN_TOUCH_TARGET)
    expect(surfaceStyle(tree).height).toBe(28)
  })

  it('точка финала нажимается той же рамкой 44dp', () => {
    const tree = render(<QuestFinaleDot {...(dotProps as any)} styles={mobileStyles} active={false} />).toJSON()

    const target = targetStyle(tree)
    expect({ width: target.width, height: target.height }).toEqual({
      width: MIN_TOUCH_TARGET,
      height: MIN_TOUCH_TARGET,
    })
  })

  it('широкоэкранная пилюля шага держит 44dp по высоте (было 28)', () => {
    const tree = render(
      <QuestStepPill {...(dotProps as any)} styles={desktopStyles} label="Ратуша" indexLabel="3" />,
    ).toJSON()

    expect(targetStyle(tree).minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  })
})
