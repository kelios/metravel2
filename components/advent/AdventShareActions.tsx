import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { ADVENT_ART_COLORS } from '@/constants/adventVisuals'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import type { AdventCardShareStatus } from './useAdventCardShare'

type Props = {
  status: AdventCardShareStatus
  canDownload: boolean
  onShare: () => void
  onDownload: () => void
  /** Подпись главной кнопки; по умолчанию «Поделиться». */
  shareLabel?: string
  /**
   * `night` — на ночной подложке иллюстрации (грамота «Итоги года»): цвета
   * не из темы интерфейса, иначе статус и контурная кнопка теряют контраст (#3488).
   */
  tone?: 'theme' | 'night'
  testIDPrefix: string
}

type ShareTone = NonNullable<Props['tone']>
/**
 * `outlineLabel`/`outlineHover` пусты — контурная кнопка в цветах темы. Рамку
 * не трогаем: `Button` кладёт вариант поверх `style`, а `primary` на `night` ≈5:1.
 */
type ToneColors = { status: string; failed: string; outlineIcon: string; outlineLabel?: string; outlineHover?: string }

/** Цвета строки результата и контурной кнопки под подложку. */
export function resolveAdventShareToneColors(
  tone: ShareTone,
  colors: { textMuted: string; danger: string; primaryDark: string },
): ToneColors {
  if (tone === 'night') {
    return {
      status: ADVENT_ART_COLORS.nightTextMuted,
      failed: ADVENT_ART_COLORS.nightDanger,
      outlineIcon: ADVENT_ART_COLORS.gold,
      outlineLabel: ADVENT_ART_COLORS.nightText,
      outlineHover: ADVENT_ART_COLORS.nightHover,
    }
  }
  return { status: colors.textMuted, failed: colors.danger, outlineIcon: colors.primaryDark }
}

/** Кнопки «Поделиться» / «Скачать картинку» и строка результата (#2868). */
function AdventShareActions({ status, canDownload, onShare, onDownload, shareLabel, tone = 'theme', testIDPrefix }: Props) {
  const colors = useThemedColors()
  const toneColors = resolveAdventShareToneColors(tone, colors)
  const busy = status === 'busy'
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button
          label={shareLabel ?? i18nT('adventStatic:share.share')}
          size="sm"
          onPress={onShare}
          disabled={busy}
          icon={<Feather name="share-2" size={16} color={colors.textOnPrimary} />}
          testID={`${testIDPrefix}-share`}
        />
        {canDownload ? (
          <Button
            label={i18nT('adventStatic:share.download')}
            size="sm"
            variant="outline"
            onPress={onDownload}
            disabled={busy}
            icon={<Feather name="download" size={16} color={toneColors.outlineIcon} />}
            hoverStyle={toneColors.outlineHover ? { backgroundColor: toneColors.outlineHover } : undefined}
            labelStyle={toneColors.outlineLabel ? { color: toneColors.outlineLabel } : undefined}
            testID={`${testIDPrefix}-download`}
          />
        ) : null}
      </View>
      {status === 'copied' || status === 'failed' ? (
        <Text
          style={[styles.status, { color: status === 'failed' ? toneColors.failed : toneColors.status }]}
          accessibilityLiveRegion="polite"
          testID={`${testIDPrefix}-status`}
        >
          {status === 'copied' ? i18nT('adventStatic:share.copied') : i18nT('adventStatic:share.failed')}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: DESIGN_TOKENS.spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
  status: { fontSize: 13, lineHeight: 18 },
})

export default memo(AdventShareActions)
