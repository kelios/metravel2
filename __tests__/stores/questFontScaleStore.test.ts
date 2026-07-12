import {
  QUEST_FONT_SCALE_STEPS,
  useQuestFontScaleStore,
} from '@/stores/questFontScaleStore'

describe('questFontScaleStore', () => {
  beforeEach(() => {
    useQuestFontScaleStore.setState({ fontScale: 1 })
  })

  it('starts at the smallest step', () => {
    expect(useQuestFontScaleStore.getState().fontScale).toBe(QUEST_FONT_SCALE_STEPS[0])
  })

  it('increase steps up through the range and clamps at the max', () => {
    const { increase } = useQuestFontScaleStore.getState()
    increase()
    expect(useQuestFontScaleStore.getState().fontScale).toBe(QUEST_FONT_SCALE_STEPS[1])
    increase()
    expect(useQuestFontScaleStore.getState().fontScale).toBe(QUEST_FONT_SCALE_STEPS[2])
    increase()
    expect(useQuestFontScaleStore.getState().fontScale).toBe(
      QUEST_FONT_SCALE_STEPS[QUEST_FONT_SCALE_STEPS.length - 1],
    )
  })

  it('decrease steps down and clamps at the min', () => {
    useQuestFontScaleStore.setState({ fontScale: QUEST_FONT_SCALE_STEPS[2] })
    const { decrease } = useQuestFontScaleStore.getState()
    decrease()
    expect(useQuestFontScaleStore.getState().fontScale).toBe(QUEST_FONT_SCALE_STEPS[1])
    decrease()
    expect(useQuestFontScaleStore.getState().fontScale).toBe(QUEST_FONT_SCALE_STEPS[0])
    decrease()
    expect(useQuestFontScaleStore.getState().fontScale).toBe(QUEST_FONT_SCALE_STEPS[0])
  })
})
