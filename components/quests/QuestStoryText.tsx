import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import QuestContentText from './QuestContentText'

/**
 * #3220: the one collapse rule for a point's story. A long story on a phone
 * opens with its first lines so the task and the answer field below it fit the
 * first screen (390×844, also with the cookie banner). Desktop shows it whole.
 * The clamp is visual: the full text stays in the tree (web DOM, screen readers);
 * the printable quest and the SSR page render the story elsewhere, in full.
 */
export const QUEST_STORY_COLLAPSE = { lines: 4, minChars: 320 } as const

export function shouldCollapseQuestStory(story: string | null | undefined, compact: boolean): boolean {
  return compact && (story?.trim().length ?? 0) > QUEST_STORY_COLLAPSE.minChars
}

type Props = { story: string | null | undefined; style: StyleProp<TextStyle>; collapsible: boolean }

export default function QuestStoryText({ story, style, collapsible }: Props) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const { isMobile } = useResponsive()
  const [expanded, setExpanded] = useState(false)
  const collapses = collapsible && shouldCollapseQuestStory(story, isMobile)
  return (
    <>
      <QuestContentText style={style} numberOfLines={collapses && !expanded ? QUEST_STORY_COLLAPSE.lines : undefined} testID="quest-step-story">
        {story}
      </QuestContentText>
      {collapses && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          hitSlop={6}
          style={styles.toggle}
          testID="quest-step-story-toggle"
        >
          <Text style={[styles.toggleText, { color: colors.brandText }]}>
            {expanded ? t('quests:components.quests.QuestStoryText.less') : t('quests:components.quests.QuestStoryText.more')}
          </Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.brandText} />
        </Pressable>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, minHeight: 44, marginTop: DESIGN_TOKENS.spacing.xs },
  toggleText: { fontSize: 15, fontWeight: '600' },
})
