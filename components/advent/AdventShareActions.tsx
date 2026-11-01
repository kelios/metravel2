import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import type { AdventCardShareStatus } from './useAdventCardShare'

type Props = {
  status: AdventCardShareStatus
  canDownload: boolean
  onShare: () => void
  onDownload: () => void
  testIDPrefix: string
}

/** Кнопки «Поделиться» / «Скачать картинку» и строка результата (#2868). */
function AdventShareActions({ status, canDownload, onShare, onDownload, testIDPrefix }: Props) {
  const colors = useThemedColors()
  const busy = status === 'busy'
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button
          label={i18nT('adventStatic:share.share')}
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
            icon={<Feather name="download" size={16} color={colors.primaryDark} />}
            testID={`${testIDPrefix}-download`}
          />
        ) : null}
      </View>
      {status === 'copied' || status === 'failed' ? (
        <Text
          style={[styles.status, { color: status === 'failed' ? colors.danger : colors.textMuted }]}
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
