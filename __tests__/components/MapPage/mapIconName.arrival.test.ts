import { mapIconName } from '@/components/MapPage/mapIconName'
import { ARRIVAL_MODE_ICON_NAME } from '@/components/trips/planning/tripPlanFormatting'

// #2056: на web MapIcon рисует Feather через mapIconName. Имя без ветки
// уходит в Feather как есть, и вместо значка переезда рисуется «?» (прод b10da3b09).
const featherGlyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json') as Record<string, number>

describe('mapIconName — способы прибытия (#2056)', () => {
  it.each(Object.entries(ARRIVAL_MODE_ICON_NAME))('%s → существующий глиф Feather', (_mode, iconName) => {
    const feather = mapIconName(iconName)
    expect(feather).not.toBe(iconName)
    expect(featherGlyphs[feather]).toBeDefined()
  })
})
