import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import PlaceCommentsPanel from '@/components/places/PlaceCommentsPanel'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'

type Props = { pointId: number; placeTitle: string }

export default function PlaceDiscussionButton({ pointId, placeTitle }: Props) {
  const [open, setOpen] = useState(false)
  const colors = useThemedColors()
  const { t } = useTranslation()
  const label = t('sharedStatic:placeComments.action')
  return (
    <>
      <CardActionPressable
        style={styles.button}
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        testID={`place-discussion-${pointId}`}
      >
        <Feather name="message-circle" size={16} color={colors.primaryText} />
        <Text style={[styles.label, { color: colors.primaryText }]}>{label}</Text>
      </CardActionPressable>
      {open && <PlaceCommentsPanel pointId={pointId} placeTitle={placeTitle} onClose={() => setOpen(false)} />}
    </>
  )
}

const styles = StyleSheet.create({
  button: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
  label: { fontSize: 13, fontWeight: '600' },
})
