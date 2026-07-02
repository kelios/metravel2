import { memo, useEffect, useMemo, useState } from 'react'
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import AwardsTabBar, {
  type AwardsTab,
} from '@/components/achievements/AwardsTabBar'
import AchievementsSection from '@/components/achievements/AchievementsSection'
import RecentAwardsTab from '@/components/achievements/RecentAwardsTab'
import ActivityProgressionSection from '@/components/achievements/ActivityProgressionSection'
import CharacterProfileCard from '@/components/achievements/CharacterProfileCard'
import RareAwardsSection from '@/components/achievements/RareAwardsSection'

type TabKey = 'recent' | 'all' | 'path' | 'rare'

interface Props {
  testID?: string
  style?: StyleProp<ViewStyle>
  /** Внешний запрос открыть конкретную под-вкладку (напр. из карточки ранга #587).
   * Меняй значение токена, чтобы повторно открыть ту же вкладку. */
  requestedTab?: { key: TabKey; token: number } | null
}

const TABS: AwardsTab[] = [
  { key: 'path', label: 'Ваш путь' },
  { key: 'all', label: 'Все награды' },
  { key: 'recent', label: 'Последние' },
  { key: 'rare', label: 'Особые' },
]

/**
 * Единая карточка «Награды» с под-вкладками (этап 1 редизайна).
 * Объединяет достижения, прогрессию/персонажа и особые награды под одной шапкой.
 */
function AwardsHub({ testID, style, requestedTab }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const [activeKey, setActiveKey] = useState<TabKey>('path')

  const requestedToken = requestedTab?.token
  useEffect(() => {
    if (requestedTab) setActiveKey(requestedTab.key)
    // token меняется при каждом запросе — позволяет повторно открыть ту же вкладку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedToken])

  return (
    <View style={[styles.card, style]} testID={testID ?? 'awards-hub'}>
      <View style={styles.header}>
        <Feather name="award" size={18} color={colors.primaryDark} />
        <Text style={styles.title} numberOfLines={1}>
          Награды
        </Text>
      </View>

      <AwardsTabBar
        tabs={TABS}
        activeKey={activeKey}
        onChange={(k) => setActiveKey(k as TabKey)}
        testID="awards-tabbar"
      />

      <View style={styles.content} testID="awards-panel">
        {activeKey === 'recent' ? <RecentAwardsTab /> : null}

        {activeKey === 'all' ? <AchievementsSection bare /> : null}

        {activeKey === 'path' ? (
          <View style={styles.pathStack}>
            <CharacterProfileCard bare />
            <ActivityProgressionSection
              bare
              onOpenAwards={() => setActiveKey('all')}
            />
          </View>
        ) : null}

        {activeKey === 'rare' ? <RareAwardsSection bare /> : null}
      </View>
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      padding: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
      flexShrink: 1,
    },
    content: { marginTop: DESIGN_TOKENS.spacing.xxs },
    pathStack: { gap: DESIGN_TOKENS.spacing.md },
  })

export default memo(AwardsHub)
