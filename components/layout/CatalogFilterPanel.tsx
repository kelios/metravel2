import type { ComponentProps, ReactNode } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Modal, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import IconButton from '@/components/ui/IconButton'
import { Heading } from '@/components/ui/Typography'
import { CATALOG_FILTER_PANEL } from '@/components/layout/catalogFilterPanelGeometry'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { webDataSetProps } from '@/utils/webProps'

type FilterPanelProps = ComponentProps<typeof View> & {
  overlay?: boolean
  title?: string
  titleAccessory?: ReactNode
  onClose?: () => void
  closeLabel?: string
  scrollContentStyle?: StyleProp<ViewStyle>
}

export default function CatalogFilterPanel({
  overlay = false,
  title,
  titleAccessory,
  onClose,
  closeLabel,
  scrollContentStyle,
  children,
  style,
  ...props
}: FilterPanelProps) {
  const colors = useThemedColors()
  const panel = (
    <View
      {...props}
      {...(overlay ? webDataSetProps({ catalogFilterOverlay: true }) : null)}
      style={[styles.panel, style, overlay && styles.overlay, { backgroundColor: colors.background }]}
    >
      {title ? (
        <View style={styles.header}>
          <Heading level={2} style={styles.heading}>{title}</Heading>
          {titleAccessory}
          {overlay && onClose ? (
            <IconButton
              icon={<Feather name="x" size={20} color={colors.text} />}
              label={closeLabel ?? i18nT('common:action.close')}
              onPress={onClose}
              size="sm"
            />
          ) : null}
        </View>
      ) : null}
      {scrollContentStyle ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={scrollContentStyle}>
          {children}
        </ScrollView>
      ) : children}
    </View>
  )

  return overlay ? (
    <Modal animationType="none" visible onRequestClose={onClose} accessibilityLabel={title}>
      {panel}
    </Modal>
  ) : panel
}

const styles = StyleSheet.create({
  panel: {
    flexShrink: 0,
    paddingHorizontal: CATALOG_FILTER_PANEL.padding,
    paddingTop: CATALOG_FILTER_PANEL.padding,
  },
  overlay: {
    width: '100%',
    maxHeight: '100%',
    flex: 1,
    minHeight: 0,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  heading: { flex: 1, minWidth: 0 },
})
