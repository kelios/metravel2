// Общий хром модального листа квестов (#1795).
//
// Читалка отзывов и вход в форму отзыва живут на одном экране и раньше несли
// каждый свою копию «подложка + карточка + шапка + крестик». Копия у входа в
// отзыв к тому же теряла закрытие тапом по подложке, которое есть у соседнего
// модала. Хром теперь один; содержимое каждый экран передаёт детьми.

import { memo, useMemo, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type Props = {
  visible: boolean
  onClose: () => void
  title: string
  /** Подпись крестика для скринридера. */
  closeLabel: string
  /** Подпись подложки: тап по ней закрывает лист. */
  overlayLabel: string
  animationType?: 'none' | 'fade' | 'slide'
  /** Android: рисовать оверлей под статус-баром (нижний лист формы). */
  statusBarTranslucent?: boolean
  sheetStyle?: StyleProp<ViewStyle>
  testID?: string
  closeTestID?: string
  children: ReactNode
}

function QuestModalSheet({
  visible,
  onClose,
  title,
  closeLabel,
  overlayLabel,
  animationType = 'fade',
  statusBarTranslucent = false,
  sheetStyle,
  testID,
  closeTestID,
  children,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={onClose}
    >
      {/* Подложка закрывает лист по тапу, но не должна быть accessibility-
          элементом: иначе её подпись схлопнет всё окно в один узел для
          скринридера на native (Pressable по умолчанию accessible={true}). */}
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessible={false}
        accessibilityLabel={overlayLabel}
      >
        {/* Лист — Pressable только чтобы гасить тап по подложке. `accessible`
            у Pressable по умолчанию true и схлопнул бы всё содержимое в один
            элемент скринридера (звёзды и поля формы отзыва). */}
        <Pressable
          style={[styles.sheet, sheetStyle]}
          onPress={(e) => e.stopPropagation()}
          accessible={false}
          testID={testID}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              testID={closeTestID}
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    sheet: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '85%',
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
  })

export default memo(QuestModalSheet)
