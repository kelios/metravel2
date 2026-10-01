import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'

import ActionListSheet from '@/components/ui/ActionListSheet'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

type Props = {
  visible: boolean
  onClose: () => void
  title: string
  /** Абзацы пояснения раздела. */
  paragraphs: string[]
}

/**
 * Нижний лист «Подробнее» (i) вложенного экрана (#2099): пояснение, которое на
 * телефоне не занимает место в теле страницы. Тот же Modal-лист, что и у
 * `ActionListSheet` (крестик, свайп вниз на native), поэтому одинаков на web и native.
 */
const InfoSheet: React.FC<Props> = ({ visible, onClose, title, paragraphs }) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <ActionListSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={styles.body} testID="info-sheet-body">
        {paragraphs.map((text, index) => (
          <Text key={`${index}-${text.slice(0, 16)}`} style={styles.paragraph}>
            {text}
          </Text>
        ))}
      </ScrollView>
    </ActionListSheet>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    body: { flexGrow: 0, paddingBottom: 8 },
    paragraph: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginBottom: 10 },
  })

export default React.memo(InfoSheet)
