import React, { useMemo } from 'react'
import ReactDOM from 'react-dom'
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
} from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type ChildrenProps = { children?: React.ReactNode }

export const Text: React.FC<ChildrenProps & { style?: StyleProp<TextStyle>; numberOfLines?: number }> = ({
  children,
  style,
}) => <RNText style={style as any}>{children}</RNText>

export const Title: React.FC<ChildrenProps & { style?: StyleProp<TextStyle> }> = ({ children, style }) => (
  <RNText style={[{ fontSize: 18, fontWeight: '700' }, style] as any}>{children}</RNText>
)

export const Paragraph: React.FC<ChildrenProps & { style?: StyleProp<TextStyle> }> = ({ children, style }) => (
  <RNText style={[{ fontSize: 14 }, style] as any}>{children}</RNText>
)

export const Button: React.FC<
  ChildrenProps & {
    mode?: 'text' | 'outlined' | 'contained'
    onPress?: () => void
    disabled?: boolean
    loading?: boolean
    icon?: any
    compact?: boolean
    style?: StyleProp<ViewStyle>
    contentStyle?: StyleProp<ViewStyle>
  }
> = ({ children, onPress, disabled, style }) => {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <RNText style={styles.buttonText}>{children}</RNText>
    </Pressable>
  )
}

export const IconButton: React.FC<{
  icon: any
  size?: number
  onPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}> = ({ icon, size = 18, onPress, disabled, style, accessibilityLabel }) => {
  const label = accessibilityLabel || 'button'
  const resolvedIcon = useMemo(() => {
    if (React.isValidElement(icon)) return icon
    if (typeof icon === 'function') {
      try {
        return icon({ size })
      } catch {
        return null
      }
    }
    if (typeof icon === 'string') {
      return <RNText style={{ fontSize: size }}>{icon}</RNText>
    }
    return null
  }, [icon, size])

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.iconButton, style, pressed && !disabled && styles.pressed]}
    >
      {resolvedIcon}
    </Pressable>
  )
}

type MenuItemProps = {
  title: string
  onPress?: () => void
  leadingIcon?: any
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
}

type MenuProps = {
  visible: boolean
  onDismiss: () => void
  anchor: React.ReactNode
  children: React.ReactNode
  contentStyle?: StyleProp<ViewStyle>
}

const MenuItem: React.FC<MenuItemProps> = ({ title, onPress, leadingIcon, style, titleStyle }) => {
  const iconNode = useMemo(() => {
    if (!leadingIcon) return null
    if (React.isValidElement(leadingIcon)) return leadingIcon
    if (typeof leadingIcon === 'function') {
      try {
        return leadingIcon({ size: 18 })
      } catch {
        return null
      }
    }
    return null
  }, [leadingIcon])

  return (
    <Pressable onPress={onPress} accessibilityRole="menuitem" style={({ pressed }) => [styles.menuItem, style, pressed && styles.pressed]}>
      {iconNode ? <View style={styles.menuItemIcon}>{iconNode}</View> : null}
      <RNText style={[styles.menuItemText, titleStyle] as any}>{title}</RNText>
    </Pressable>
  )
}

export const Menu: React.FC<MenuProps> & { Item: React.FC<MenuItemProps> } = ({
  visible,
  onDismiss,
  anchor,
  children,
  contentStyle,
}) => {
  const [panelPosition, setPanelPosition] = React.useState<{ top: number; left: number; maxHeight: number; width: number } | null>(null)
  const anchorRef = React.useRef<View>(null)

  React.useEffect(() => {
    if (!visible) {
      setPanelPosition(null)
      return
    }
    if (Platform.OS !== 'web') return
    if (typeof window === 'undefined') return

    const update = () => {
      try {
        let anchorEl: HTMLElement | null = null
        
        if (anchorRef.current) {
          anchorEl = anchorRef.current as any as HTMLElement
        }
        
        if (!anchorEl) {
          const allAnchors = document.querySelectorAll('[data-testid="web-menu-anchor"]')
          if (allAnchors.length > 0) {
            anchorEl = allAnchors[allAnchors.length - 1] as HTMLElement
          }
        }
        
        if (!anchorEl) {
          anchorEl = document.querySelector('[data-testid="account-menu-anchor"]') as HTMLElement | null
        }
        
        if (!anchorEl) return
        
        const anchorRect = anchorEl.getBoundingClientRect()
        const VIEWPORT_MARGIN = 8
        const MENU_GAP = 4
        const MAX_MENU_WIDTH = 320
        const MIN_MENU_HEIGHT = 200
        const MAX_MENU_HEIGHT = 600

        // Вычисляем доступную ширину viewport
        const availableWidth = window.innerWidth - (VIEWPORT_MARGIN * 2)
        const menuWidth = Math.min(MAX_MENU_WIDTH, availableWidth)

        // 1. Вычисляем вертикальную позицию (top)
        let top = anchorRect.bottom + MENU_GAP
        
        const availableHeightBelow = window.innerHeight - top - VIEWPORT_MARGIN
        let maxHeight = Math.max(MIN_MENU_HEIGHT, Math.min(MAX_MENU_HEIGHT, availableHeightBelow))
        
        if (maxHeight < MIN_MENU_HEIGHT) {
          const availableHeightAbove = anchorRect.top - VIEWPORT_MARGIN
          if (availableHeightAbove > availableHeightBelow) {
            maxHeight = Math.max(MIN_MENU_HEIGHT, Math.min(MAX_MENU_HEIGHT, availableHeightAbove))
            top = Math.max(VIEWPORT_MARGIN, anchorRect.top - maxHeight - MENU_GAP)
          }
        }
        
        top = Math.max(VIEWPORT_MARGIN, top)
        
        // 2. Вычисляем горизонтальную позицию (left)
        let left = anchorRect.right - menuWidth
        
        // Проверяем левую границу
        if (left < VIEWPORT_MARGIN) {
          left = anchorRect.left
          
          if (left < VIEWPORT_MARGIN) {
            left = VIEWPORT_MARGIN
          }
        }
        
        // Проверяем правую границу
        const menuRight = left + menuWidth
        if (menuRight > window.innerWidth - VIEWPORT_MARGIN) {
          left = window.innerWidth - menuWidth - VIEWPORT_MARGIN
          
          // Финальная проверка, что не выходим за левую границу
          left = Math.max(VIEWPORT_MARGIN, left)
        }
        
        setPanelPosition({ top, left, maxHeight, width: menuWidth })
      } catch {
        // noop
      }
    }

    const raf = window.requestAnimationFrame ? window.requestAnimationFrame(update) : (setTimeout(update, 0) as any)

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    return () => {
      try {
        if (window.cancelAnimationFrame && typeof raf === 'number') window.cancelAnimationFrame(raf)
      } catch {
        // noop
      }
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [visible])

  return (
    <View style={styles.menuRoot}>
      <View ref={anchorRef} testID="web-menu-anchor" collapsable={false}>
        {anchor}
      </View>
      {visible ? (
        <Portal>
          <View style={styles.menuOverlay} accessibilityRole="menu" testID="web-menu-overlay">
            <Pressable style={styles.menuBackdrop} onPress={onDismiss} />
            <View
              style={[
                styles.menuPanel,
                panelPosition
                  ? ({
                      top: panelPosition.top,
                      left: panelPosition.left,
                      width: panelPosition.width,
                      maxHeight: panelPosition.maxHeight,
                      overflowY: 'auto',
                    } as any)
                  : null,
                contentStyle,
              ] as any}
              testID="web-menu-panel"
            >
              {children}
            </View>
          </View>
        </Portal>
      ) : null}
    </View>
  )
}

Menu.Item = MenuItem

export const Card: React.FC<ChildrenProps & { style?: StyleProp<ViewStyle> }> & {
  Content: React.FC<ChildrenProps>
  Cover: React.FC<{ source?: any; style?: StyleProp<ImageStyle>; resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat' }>
} = ({ children, style }) => {
  return <View style={[styles.card, style] as any}>{children}</View>
}

Card.Content = ({ children }: ChildrenProps) => <View style={styles.cardContent}>{children}</View>

Card.Cover = ({ source, style, resizeMode = 'cover' }) => (
  <Image source={source} style={style as any} resizeMode={resizeMode} />
)

export const Dialog: any = ({ children }: ChildrenProps) => <View>{children}</View>
Dialog.Title = ({ children }: ChildrenProps) => <Title>{children}</Title>
Dialog.Content = ({ children }: ChildrenProps) => <View>{children}</View>
Dialog.Actions = ({ children }: ChildrenProps) => <View>{children}</View>

export const Portal: React.FC<ChildrenProps> = ({ children }) => {
  if (Platform.OS !== 'web') return <>{children}</>
  if (typeof document === 'undefined') return <>{children}</>
  return ReactDOM.createPortal(children as any, document.body)
}

export const Snackbar: React.FC<ChildrenProps & { visible: boolean }> = ({ children, visible }) =>
  visible ? <View style={styles.snackbar}>{children}</View> : null

export const DataTable: React.FC<ChildrenProps> & { Pagination: React.FC<any> } = ({ children }) => (
  <View>{children}</View>
)

DataTable.Pagination = () => null

export const Icon: React.FC<any> = () => null

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DESIGN_TOKENS.colors.primary,
  },
  buttonText: {
    color: DESIGN_TOKENS.colors.textOnDark,
    fontWeight: '700',
  },
  iconButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  menuRoot: {
    position: 'relative',
  },
  menuOverlay: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    inset: 0 as any,
    zIndex: 9999,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  menuPanel: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    minWidth: 260,
    borderRadius: 12,
    paddingVertical: 8,
    backgroundColor: DESIGN_TOKENS.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  menuItemIcon: {
    width: 20,
    marginRight: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 15,
    color: DESIGN_TOKENS.colors.text,
    textAlign: 'left',
    flex: 1,
  },
  card: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 12,
  },
  cardContent: {
    padding: 12,
  },
  snackbar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: DESIGN_TOKENS.colors.overlay,
  },
})
