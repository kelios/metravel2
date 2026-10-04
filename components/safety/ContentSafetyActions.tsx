// #2133: кнопка «…» и лист «Пожаловаться / Скрыть / Заблокировать» у чужого
// контента любого типа. Цель касания 44×44 без hitSlop (HIG, guard-touch-targets).
//
// Кнопка стоит в каждой карточке ленты, поэтому сама она читает только стор
// сессии; мутации жалобы/блока, лист и стор скрытого монтируются после первого
// нажатия (`ContentSafetyMenu`) — лента из 50 карточек не держит 100 мутаций.

import { memo, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ActionListSheet from '@/components/ui/ActionListSheet'
import {
  useContentSafetyActions,
  useContentSafetyAvailable,
  type ContentSafetyOptions,
} from '@/components/safety/useContentSafetyActions'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

type Props = ContentSafetyOptions & {
  style?: StyleProp<ViewStyle>
  /** `surface` — круглая кнопка с подложкой (шапка профиля), `plain` — иконка без фона (строки ленты). */
  appearance?: 'surface' | 'plain'
  iconSize?: number
  /** testID кнопки; по умолчанию `<testIDPrefix>-menu`. */
  testID?: string
}

type MenuProps = ContentSafetyOptions & { open: boolean; onClose: () => void; hintStyle: StyleProp<TextStyle> }

function ContentSafetyMenu({ open, onClose, hintStyle, ...options }: MenuProps) {
  const model = useContentSafetyActions(options)
  if (!model.available) return null
  return (
    <>
      <ActionListSheet visible={open} onClose={onClose} title={model.title} actions={model.items}>
        {model.hasBlock ? <Text style={hintStyle}>{i18nT('sharedStatic:contentSafety.blockHint')}</Text> : null}
      </ActionListSheet>
      {model.overlay}
    </>
  )
}

function ContentSafetyActions({ style, appearance = 'plain', iconSize = 18, testID, ...options }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const [open, setOpen] = useState(false)
  // После первого открытия меню остаётся смонтированным: лист причины живёт дольше листа действий.
  const [mounted, setMounted] = useState(false)
  const available = useContentSafetyAvailable(options.contentRef)

  if (!available) return null

  const prefix = options.testIDPrefix ?? 'content-safety'

  return (
    <>
      <Pressable
        style={[styles.trigger, appearance === 'surface' && styles.triggerSurface, style]}
        onPress={() => {
          setMounted(true)
          setOpen(true)
        }}
        accessibilityRole="button"
        accessibilityLabel={i18nT('sharedStatic:contentSafety.trigger')}
        testID={testID ?? `${prefix}-menu`}
        {...Platform.select({ web: { cursor: 'pointer' } })}
      >
        <Feather name="more-horizontal" size={iconSize} color={colors.textSecondary} />
      </Pressable>

      {mounted ? (
        <ContentSafetyMenu {...options} open={open} onClose={() => setOpen(false)} hintStyle={styles.hint} />
      ) : null}
    </>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    trigger: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    triggerSurface: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    hint: { fontSize: 13, color: colors.textMuted, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 8 },
  })

export default memo(ContentSafetyActions)
