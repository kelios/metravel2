import React, { useMemo } from 'react'
import { Dimensions, Platform } from 'react-native'

import { useDockReservePx } from '@/components/layout/bottomChromeInset'
import { useQuestsList } from '@/hooks/useQuestsApi'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { getStyles } from '@/screens/tabs/QuestsScreen.styles'
import QuestNotFoundScreen from './QuestNotFoundScreen'

type Props = {
  /** Запрошенный сегмент адреса — alias квеста, которого нет. */
  segment: string
}

/**
 * «Квест не найден» для экрана самого квеста (#3227): `/quests/<city>/<slug>` и
 * адрес с языковым префиксом. Лендинги города и страны уже держат каталог и
 * стили раздела и рисуют `QuestNotFoundScreen` напрямую; экрану квеста они не
 * нужны, пока адрес существует, поэтому каталог (для популярных квестов) и
 * стили лендинга берутся здесь — в ленивом чанке, который грузится только на
 * несуществующем адресе.
 */
export default function QuestAddressNotFound({ segment }: Props) {
  const colors = useThemedColors()
  const { width } = useBreakpoints()
  const dockPx = useDockReservePx()
  const height = Platform.OS === 'web' ? 0 : Dimensions.get('window').height
  const styles = useMemo(() => getStyles(colors, width, height, dockPx), [colors, width, height, dockPx])
  const { quests } = useQuestsList()
  return <QuestNotFoundScreen kind="quest" segment={segment} quests={quests} styles={styles} />
}
