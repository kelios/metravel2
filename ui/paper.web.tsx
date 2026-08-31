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
  ActivityIndicator,
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

// Одна точка разбора `IconSource` на весь шим. Раньше `IconButton` и `Menu.Item`
// несли по своей копии этого try/catch, причём строку разворачивал только
// первый. Строка здесь — готовый ГЛИФ («→»), а не имя иконки: имена шим не
// принимает, см. `ButtonIconSource`.
const resolveIconNode = (
  icon: IconSource | undefined,
  size: number,
  color?: string,
): React.ReactNode => {
  if (!icon) return null
  if (React.isValidElement(icon)) return icon
  if (typeof icon === 'function') {
    try {
      return icon({ size, color })
    } catch {
      return null
    }
  }
  if (typeof icon === 'string') {
    return <RNText style={[{ fontSize: size }, color ? { color } : null] as any}>{icon}</RNText>
  }
  return null
}

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

type ButtonMode = 'text' | 'outlined' | 'contained'

// В отличие от `IconSource`, строку `Button` не принимает намеренно. paper на
// native понимает под строкой ИМЯ material-иконки, а рисовать их на web нечем:
// проект пользуется Feather, и тот покрывает лишь малую часть material-набора.
// Частичный маппинг имён вернул бы ровно тот дефект, который чинит #1663:
// незнакомое имя снова молча не рисовалось бы. Поэтому вызывающий передаёт
// готовый узел — настоящая paper на native элемент тоже принимает.
type ButtonIconSource = React.ReactElement | ((props: IconRenderProps) => React.ReactNode)

// `accessibilityState` react-native-web не форвардит вовсе (его нет в
// `modules/forwardedProps`), а собственный `aria-disabled` у `Pressable`
// выставляется ПОСЛЕ `...rest`, поэтому пробросить атрибут снаружи нельзя.
// Единственный рабочий канал недоступности на web — проп `disabled` самого
// `Pressable`: он даёт `aria-disabled`, `tabIndex=-1` и снимает press-события.
type ButtonShimProps = ChildrenProps &
  Omit<PressableProps, 'children' | 'style' | 'onPress' | 'disabled'> & {
    mode?: ButtonMode
    onPress?: () => void
    disabled?: boolean
    loading?: boolean
    icon?: ButtonIconSource
    compact?: boolean
    style?: StyleProp<ViewStyle>
    contentStyle?: StyleProp<ViewStyle>
  }

const BUTTON_ICON_SIZE = 18

// Три режима paper положены на варианты дизайн-системы (`components/ui/Button`):
// contained ≈ primary, outlined ≈ outline, text ≈ ghost. `mode` по умолчанию —
// `text`, как в настоящей paper; сейчас его выставляют все места использования.
const BUTTON_FOREGROUND: Record<ButtonMode, string> = {
  contained: DESIGN_TOKENS.colors.textOnPrimary,
  outlined: DESIGN_TOKENS.colors.text,
  text: DESIGN_TOKENS.colors.text,
}

export const Button: React.FC<ButtonShimProps> = ({
  children,
  onPress,
  disabled,
  style,
  mode = 'text',
  loading = false,
  icon,
  compact = false,
  contentStyle,
  ...rest
}) => {
  // Значение из-за границы типов (нетипизированный вызывающий, чужой бандл) не
  // должно давать кнопку без заливки и без цвета текста — это ровно то «молча
  // ничего», которое чинит #1663. Проверяем СВОЙ ключ, а не `in`: `in` смотрит и
  // прототип, поэтому `mode="toString"` прошёл бы гард насквозь и положил бы в
  // `color` кнопки и в `color` спиннера функцию вместо цвета.
  const safeMode: ButtonMode = Object.prototype.hasOwnProperty.call(BUTTON_FOREGROUND, mode)
    ? mode
    : 'text'
  const foreground = BUTTON_FOREGROUND[safeMode]
  const iconNode = useMemo(
    () => (loading ? null : resolveIconNode(icon, BUTTON_ICON_SIZE, foreground)),
    [icon, loading, foreground],
  )

  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      // `accessibilityState` react-native-web не обрабатывает вовсе, поэтому
      // `busy` из него до DOM не доходит — ровно тот же «проп принят, ничего не
      // нарисовано», который чинит #1663. Реальный канал для web — `aria-busy`,
      // он есть в `modules/forwardedProps`. `undefined` вместо `false`, чтобы не
      // вешать атрибут на каждую кнопку. `accessibilityState` оставлен для native.
      aria-busy={loading || undefined}
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        buttonModeStyles[safeMode],
        compact && styles.buttonCompact,
        // Стиль вызывающего идёт ПОСЛЕ режима: `accountconfirmation` и
        // `FiltersUpsertComponent` задают собственные фон и радиус поверх него.
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.buttonContent, contentStyle] as any}>
        {loading ? (
          <ActivityIndicator size="small" color={foreground} style={styles.buttonIcon} />
        ) : iconNode ? (
          <View style={styles.buttonIcon}>{iconNode}</View>
        ) : null}
        <RNText style={[styles.buttonLabel, { color: foreground }] as any}>{children}</RNText>
      </View>
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
  const resolvedIcon = useMemo(() => resolveIconNode(icon, size), [icon, size])

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
  const iconNode = useMemo(() => resolveIconNode(leadingIcon, 18), [leadingIcon])

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

// На web оба потребителя (`components/ui/ConfirmDialog.tsx`,
// `components/travel/upsert/WizardExitDialog.tsx`) уходят в `Modal` до `<Dialog>`,
// так что этот путь здесь не исполняется. Тип всё равно нужен настоящий: типы
// этого файла теперь резолвятся и для native-вызовов, а прежний `any` снимал с
// них проверку целиком. `visible` при этом соблюдается — принимать проп и
// игнорировать его значило бы повторить ровно тот дефект, который чинит #1657.
type DialogShimProps = Omit<ViewProps, 'style'> &
  ChildrenProps & {
    visible?: boolean
    onDismiss?: () => void
    dismissable?: boolean
    style?: StyleProp<ViewStyle>
  }

export const Dialog: React.FC<DialogShimProps> & {
  Title: React.FC<TextShimProps>
  Content: React.FC<CardShimProps>
  Actions: React.FC<CardShimProps>
} = ({ children, visible = true, onDismiss: _onDismiss, dismissable: _dismissable, style, ...rest }) => {
  if (!visible) return null
  return (
    <View {...rest} style={style as any}>
      {children}
    </View>
  )
}

Dialog.Title = ({ children, ...rest }: TextShimProps) => <Title {...rest}>{children}</Title>

Dialog.Content = ({ children, style, ...rest }: CardShimProps) => (
  <View {...rest} style={style as any}>
    {children}
  </View>
)

Dialog.Actions = ({ children, style, ...rest }: CardShimProps) => (
  <View {...rest} style={style as any}>
    {children}
  </View>
)

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

// #1663: `Icon` и `DataTable` из шима убраны, а не «пока не реализованы».
// `Icon` рендерил `null`, из-за чего иконки чеклиста публикации на web не
// рисовались вовсе; его места использования переведены на прямой `Feather`,
// которым пользуется остальной проект (в том числе соседние строки тех же
// карточек). `DataTable` вызывающих не имел ни одного. Экспорт убран намеренно:
// типы этого файла резолвятся и для native, поэтому попытка снова взять их
// через `@/ui/paper` теперь падает на `tsc`, а не молчит до браузера.

// Рамка живёт в базовом стиле, а режим меняет только цвета: иначе `outlined`
// добавлял бы кнопке 2px, и тоггл ручной точки (`ManualPointPanel`), который
// переключает contained ↔ outlined, дёргал бы раскладку на каждое нажатие.
const buttonModeStyles = StyleSheet.create({
  contained: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderColor: 'transparent',
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: DESIGN_TOKENS.colors.primary,
  },
  text: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
})

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `compact` у paper режет только горизонтальные отступы. Высота и ширина
  // остаются 44: floor тач-таргета компактность не отменяет.
  buttonCompact: {
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: DESIGN_TOKENS.spacing.xs,
  },
  buttonLabel: {
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
