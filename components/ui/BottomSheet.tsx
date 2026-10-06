import React, { useMemo, useRef } from 'react'
import { Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { asBottomDimension, useBottomChromeInset } from '@/components/layout/bottomChromeInset'
import CardActionPressable from '@/components/ui/CardActionPressable'
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

const PANEL_PADDING_BOTTOM = 16
const SWIPE_CLOSE_DISTANCE = 56

type Props = {
  visible: boolean
  onClose: () => void
  title: string
  children?: React.ReactNode
  /** iOS: окно листа действительно закрылось (`Modal.onDismiss`) — см. #2115 в `ActionListSheet`. */
  onDismiss?: () => void
}

const claimTouch = () => true
const keepTouch = () => false
// Web: клик внутри листа — не клик по карточке, в которой лист смонтирован.
const WEB_ROOT_PROPS = { dataSet: { cardAction: 'true' } }

/**
 * Единственный нижний лист приложения: Modal, затемнение, панель с ручкой,
 * заголовком и ✕. Списки действий (`ActionListSheet`), пояснения (`InfoSheet`) и
 * выбор статуса путешествия кладут в него только тело. Три контракта живут здесь
 * и больше нигде:
 *
 * 1. Свайп вниз по шапке закрывает лист (native, #2159/#2230). Шапка берёт
 *    касание на старте: если на старте ответчиком становится предок, RN на
 *    движении спрашивает только предков ответчика, и `onMoveShouldSet*` шапке
 *    уже не задаётся.
 * 2. Касание, начатое внутри листа, не уходит экрану под ним (native, #2231).
 *    Переговоры за касание идут по дереву React, а Modal — портал: нажимаемый
 *    предок листа (карточка каталога) участвует во всплытии и получал бы `onPress`
 *    от тапа по пустому месту листа. Границу держит обёртка ВНЕ Modal: в дереве
 *    React она предок содержимого листа, а нативно лежит в окне экрана и не
 *    предок вью листа. Это важно на Android — вью-ответчик перехватывает нативные
 *    касания своих потомков (`JSResponderHandler.onInterceptTouchEvent`), и
 *    панель в роли ответчика отняла бы жест у `ScrollView` тела.
 *    Следствие для тела листа: жест, которому нужно движение, берёт касание на
 *    старте (как шапка) или строится на gesture-handler — `onMoveShouldSet*`
 *    внутри листа не опрашивается.
 *    Web: Modal — портал React, и синтетический click всплывает по дереву React
 *    до `onClick` той же карточки. Корень листа помечен `data-card-action` —
 *    каноническая метка «клик не открывает карточку» (RULES.md).
 * 3. Нижний отступ — из общего резерва, без собственной высоты дока (#2153).
 *    Web: `useBottomChromeInset()` (док и плашки; 0 там, где дока нет). Native:
 *    Modal лежит поверх дока, поэтому отступа от края нет, а низ панели
 *    резервирует home indicator / навигационную панель.
 */
const BottomSheet: React.FC<Props> = ({ visible, onClose, title, children, onDismiss }) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const isWeb = Platform.OS === 'web'
  const { bottom: chromeBottom } = useBottomChromeInset()
  const insets = useSafeAreaInsetsSafe()

  // onClose читается из ref, чтобы PanResponder не пересоздавался между рендерами.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const swipeHandlers = useMemo(() => {
    if (isWeb) return null
    const closeIfFarEnough = (dy: number) => {
      if (dy > SWIPE_CLOSE_DISTANCE) onCloseRef.current()
    }
    return PanResponder.create({
      // ✕ глубже шапки и выигрывает своё касание сам; отдавать жест на полпути нечему.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_evt, g) => closeIfFarEnough(g.dy),
      onPanResponderTerminate: (_evt, g) => closeIfFarEnough(g.dy),
    }).panHandlers
  }, [isWeb])

  const panelBottom = isWeb
    ? { marginBottom: asBottomDimension(chromeBottom) }
    : { paddingBottom: Math.max(insets.bottom || 0, PANEL_PADDING_BOTTOM) }

  const closeLabel = i18nT('shared:components.ui.ActionListSheet.zakryt_e47a2993')

  const sheet = (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.root} testID="bottom-sheet-root" {...(isWeb ? WEB_ROOT_PROPS : null)}>
        <Pressable
          accessibilityLabel={i18nT('shared:components.ui.ActionListSheet.zakryt_menyu_deystviy_85947952')}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={[styles.panel, panelBottom]} testID="bottom-sheet-panel">
          <View style={styles.header} {...(swipeHandlers ?? {})}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>{title}</Text>
              <CardActionPressable
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                title={closeLabel}
                onPress={onClose}
                enableWebClickFallback
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              >
                <Feather name="x" size={20} color={colors.text} />
              </CardActionPressable>
            </View>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )

  if (isWeb) return sheet

  return (
    <View
      collapsable={false}
      onResponderTerminationRequest={keepTouch}
      onStartShouldSetResponder={claimTouch}
      style={styles.touchBoundary}
      testID="bottom-sheet-touch-boundary"
    >
      {sheet}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    // Нулевой абсолютный узел: в раскладке потребителя не участвует (ни размера,
    // ни `gap`), как и сам хост Modal.
    touchBoundary: {
      position: 'absolute',
      width: 0,
      height: 0,
    },
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15, 23, 42, 0.28)',
    },
    panel: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: PANEL_PADDING_BOTTOM,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      maxHeight: '72%',
      ...Platform.select({
        web: { boxShadow: '0 -12px 34px rgba(15,23,42,0.16)' },
      }),
    },
    header: {
      paddingBottom: 4,
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.borderLight,
      marginBottom: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    title: {
      flex: 1,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
      color: colors.text,
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    closeBtnPressed: {
      backgroundColor: colors.backgroundSecondary,
      ...Platform.select({ web: { transform: 'scale(0.99)' } }),
    },
  })

export default BottomSheet
