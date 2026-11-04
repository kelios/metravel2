import Feather from '@expo/vector-icons/Feather'
import type { StyleProp, ViewStyle } from 'react-native'

import IconButton from '@/components/ui/IconButton'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

type Props = {
  onPress: () => void
  label?: string
  compact?: boolean
  style?: StyleProp<ViewStyle>
}

export default function CatalogFilterCloseButton({ onPress, label, compact = false, style }: Props) {
  const colors = useThemedColors()
  return (
    <IconButton
      icon={<Feather name="x" size={compact ? 16 : 20} color={compact ? colors.textMuted : colors.text} />}
      label={label ?? i18nT('common:action.close')}
      onPress={onPress}
      size="sm"
      style={style}
    />
  )
}
