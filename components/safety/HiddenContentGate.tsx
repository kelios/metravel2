// #2133: рендер объекта ленты с учётом «Скрыть у себя». Скрытый объект
// заменяется плашкой той же ленты: соседи не прыгают, а «Показать» возвращает
// его без захода в настройки.

import { createContext, memo, useContext, useMemo, type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useHiddenContent } from '@/hooks/useHiddenContent'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import type { ContentRef } from '@/types/contentSafety'
import { translate as i18nT } from '@/i18n'

// «Скрыть у себя» имеет смысл только там, где объект умеет исчезнуть, — внутри
// этой обёртки. Меню безопасности читает контекст и не предлагает «Скрыть» на
// детальной странице или в шапке, где скрытый объект остался бы на экране.
const HideableContext = createContext(false)

export const useInsideHiddenContentGate = (): boolean => useContext(HideableContext)

type Props = {
  contentRef: ContentRef | null
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

function HiddenContentGate({ contentRef, children, style }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const { hidden, unhide } = useHiddenContent(contentRef)

  if (!hidden) return <HideableContext.Provider value>{children}</HideableContext.Provider>

  return (
    <View style={[styles.placeholder, style]} testID="hidden-content">
      <Feather name="eye-off" size={16} color={colors.textMuted} />
      <Text style={styles.text}>{i18nT('sharedStatic:contentSafety.hidden')}</Text>
      <Pressable
        style={styles.showBtn}
        onPress={unhide}
        accessibilityRole="button"
        accessibilityLabel={i18nT('sharedStatic:contentSafety.show')}
        testID="hidden-content-show"
        {...Platform.select({ web: { cursor: 'pointer' } })}
      >
        <Text style={styles.showText}>{i18nT('sharedStatic:contentSafety.show')}</Text>
      </Pressable>
    </View>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    placeholder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: DESIGN_TOKENS.spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
    },
    text: { flex: 1, fontSize: 13, color: colors.textMuted },
    showBtn: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    showText: { fontSize: 13, fontWeight: '700', color: colors.primaryText },
  })

export default memo(HiddenContentGate)
