// Web-реализация подмножества react-native-paper.
//
// #1657: каждый компонент здесь ОБЯЗАН пробрасывать остальные пропы дальше
// (`...rest`). Раньше они деструктурировали ровно `children` и `style`, поэтому
// `accessibilityRole`, `aria-level`, `testID`, `numberOfLines`, `pointerEvents`
// и `onDismiss` молча исчезали по дороге к DOM: правка выглядела сделанной,
// типы и юнит-тесты были зелёные, эффекта не было.
//
// Типы этого файла — источник истины для обеих платформ: `ui/paper.native.tsx`
// переименован из `.ts` именно затем, чтобы `tsc` перестал резолвить web-вызовы
// по native-файлу (механизм — в шапке `paper.native.tsx`). Значит, добавляя
// компоненту проп на месте использования, добавь его и сюда — иначе `tsc`
// теперь честно ругается вместо того, чтобы промолчать.
import React, { useMemo } from 'react'
import ReactDOM from 'react-dom'
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type ImageProps,
  type PressableProps,
  type StyleProp,
  type TextProps as RNTextProps,
  type ViewProps,
  type ViewStyle,
  type TextStyle,
  type ImageStyle,
} from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type ChildrenProps = { children?: React.ReactNode }

// react-native-web превращает `accessibilityRole="header"` + `aria-level` в
// настоящий тег `h${level}`, а без уровня — жёстко в `h1` (#1617). В типах
// react-native `aria-level` нет, это web-расширение, поэтому объявляем сами.
type WebHeadingProps = { 'aria-level'?: number }

type TextShimProps = RNTextProps & WebHeadingProps

// paper принимает иконку элементом, именем или рендер-функцией. Тип нужен явно:
// с прежним `any` колбэк `({ size }) => ...` на местах использования падал в
// implicit any, как только эти типы стали видимыми.
type IconRenderProps = { size: number; color?: string }
type IconSource = React.ReactNode | ((props: IconRenderProps) => React.ReactNode)

export const Text: React.FC<TextShimProps> = ({ children, style, ...rest }) => (
  <RNText {...rest} style={style as any}>
    {children}
  </RNText>
)

export const Title: React.FC<TextShimProps> = ({ children, style, ...rest }) => (
  <RNText {...rest} style={[{ fontSize: 18, fontWeight: '700' }, style] as any}>
    {children}
  </RNText>
)

export const Paragraph: React.FC<TextShimProps> = ({ children, style, ...rest }) => (
  <RNText {...rest} style={[{ fontSize: 14 }, style] as any}>
    {children}
  </RNText>
)

// `accessibilityState` react-native-web не форвардит вовсе (его нет в
// `modules/forwardedProps`), а собственный `aria-disabled` у `Pressable`
// выставляется ПОСЛЕ `...rest`, поэтому пробросить атрибут снаружи нельзя.
// Единственный рабочий канал недоступности на web — проп `disabled` самого
// `Pressable`: он даёт `aria-disabled`, `tabIndex=-1` и снимает press-события.
type ButtonShimProps = ChildrenProps &
  Omit<PressableProps, 'children' | 'style' | 'onPress' | 'disabled'> & {
    mode?: 'text' | 'outlined' | 'contained'
    onPress?: () => void
    disabled?: boolean
    loading?: boolean
    icon?: IconSource
    compact?: boolean
    style?: StyleProp<ViewStyle>
    contentStyle?: StyleProp<ViewStyle>
  }

export const Button: React.FC<ButtonShimProps> = ({
  children,
  onPress,
  disabled,
  style,
  // Визуальные пропы paper web-шим пока не отрисовывает: кнопка всегда одна и та
  // же заливка. Это осознанный no-op, а не молчаливая потеря, — отдельная задача.
  mode: _mode,
  loading: _loading,
  icon: _icon,
  compact: _compact,
  contentStyle: _contentStyle,
  ...rest
}) => {
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
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

export const IconButton: React.FC<
  Omit<PressableProps, 'children' | 'style' | 'onPress' | 'disabled'> & {
    icon: IconSource
    size?: number
    onPress?: () => void
    disabled?: boolean
    style?: StyleProp<ViewStyle>
  }
> = ({ icon, size = 18, onPress, disabled, style, accessibilityLabel, ...rest }) => {
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
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.iconButton, style, pressed && !disabled && styles.pressed]}
    >
      {resolvedIcon}
    </Pressable>
  )
}

type MenuItemProps = Omit<PressableProps, 'children' | 'style' | 'onPress'> & {
  title: string
  onPress?: () => void
  leadingIcon?: IconSource
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
}

type MenuProps = {
  visible: boolean
  onDismiss: () => void
  anchor: React.ReactNode
  children: React.ReactNode
  contentStyle?: StyleProp<ViewStyle>
  accessibilityRole?: 'menu' | 'dialog'
  accessibilityLabel?: string
}

const MenuItem: React.FC<MenuItemProps> = ({ title, onPress, leadingIcon, style, titleStyle, ...rest }) => {
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
    <Pressable
      accessibilityRole="menuitem"
      {...rest}
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, style, pressed && styles.pressed]}
    >
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
  accessibilityRole = 'menu',
  accessibilityLabel,
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
          <View style={styles.menuOverlay} testID="web-menu-overlay">
            <Pressable style={styles.menuBackdrop} onPress={onDismiss} />
            {panelPosition ? (
              <View
                style={[
                  styles.menuPanel,
                  {
                    top: panelPosition.top,
                    left: panelPosition.left,
                    width: panelPosition.width,
                    maxHeight: panelPosition.maxHeight,
                    overflowY: 'auto',
                  } as any,
                  contentStyle,
                ] as any}
                accessibilityRole={accessibilityRole as any}
                accessibilityLabel={accessibilityLabel}
                testID="web-menu-panel"
              >
                {children}
              </View>
            ) : null}
          </View>
        </Portal>
      ) : null}
    </View>
  )
}

Menu.Item = MenuItem

type DialogMenuProps = Omit<MenuProps, 'accessibilityRole'>

export const DialogMenu: React.FC<DialogMenuProps> & { Item: React.FC<MenuItemProps> } = (props) => (
  <Menu {...props} accessibilityRole="dialog" />
)

DialogMenu.Item = MenuItem

type CardShimProps = Omit<ViewProps, 'style'> & ChildrenProps & { style?: StyleProp<ViewStyle> }

type CardCoverProps = Omit<ImageProps, 'source' | 'style' | 'resizeMode'> & {
  source?: ImageProps['source']
  style?: StyleProp<ImageStyle>
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat'
}

export const Card: React.FC<CardShimProps> & {
  Content: React.FC<CardShimProps>
  Cover: React.FC<CardCoverProps>
} = ({ children, style, ...rest }) => {
  return (
    <View {...rest} style={[styles.card, style] as any}>
      {children}
    </View>
  )
}

Card.Content = ({ children, style, ...rest }: CardShimProps) => (
  <View {...rest} style={[styles.cardContent, style] as any}>
    {children}
  </View>
)

Card.Cover = ({ source, style, resizeMode = 'cover', ...rest }) => (
  <Image {...rest} source={source} style={style as any} resizeMode={resizeMode} />
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

// paper прячет Snackbar сам по таймеру и зовёт `onDismiss`; web-шим этот проп
// раньше принимал и выбрасывал, поэтому snackbar на web висел, пока состояние
// снаружи не изменится. Длительность — paper `Snackbar.DURATION_MEDIUM`.
const SNACKBAR_DURATION_MEDIUM = 7000

export const Snackbar: React.FC<
  Omit<ViewProps, 'style'> &
    ChildrenProps & {
      visible: boolean
      onDismiss?: () => void
      duration?: number
      style?: StyleProp<ViewStyle>
    }
> = ({ children, visible, onDismiss, duration = SNACKBAR_DURATION_MEDIUM, style, ...rest }) => {
  // paper держит колбэк через `useLatestCallback`, поэтому смена identity
  // `onDismiss` там таймер не перезапускает. Повторяем это здесь: с зависимостью
  // на сам колбэк вызывающий с инлайновой стрелкой продлевал бы 7 секунд на
  // каждый рендер, и snackbar на web не закрывался бы, хотя на native закрывается.
  const onDismissRef = React.useRef(onDismiss)
  onDismissRef.current = onDismiss

  React.useEffect(() => {
    if (!visible || !onDismissRef.current) return undefined
    if (!Number.isFinite(duration)) return undefined
    const timer = setTimeout(() => onDismissRef.current?.(), duration)
    return () => clearTimeout(timer)
  }, [visible, duration])

  if (!visible) return null
  return (
    <View {...rest} style={[styles.snackbar, style] as any}>
      {children}
    </View>
  )
}

export const DataTable: React.FC<ChildrenProps> & { Pagination: React.FC<any> } = ({ children }) => (
  <View>{children}</View>
)

// `DataTable.Pagination` и `Icon` — заглушки, а не забытый проброс: рисовать их
// на web значит менять видимую вёрстку (иконки чеклиста публикации, пагинация
// таблицы), и это отдельная задача. Пока контракт такой: на web этих узлов нет.
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
    color: DESIGN_TOKENS.colors.textOnPrimary,
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
