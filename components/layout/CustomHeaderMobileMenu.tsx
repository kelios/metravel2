import React, { useRef } from 'react'
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import type { ThemedColors } from '@/hooks/useTheme'
import { DOCUMENT_NAV_ITEMS, PRIMARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation'
import { buildLoginHref } from '@/utils/authNavigation'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import UnreadBadge from './UnreadBadge'
import BelarusOutlineIcon from './BelarusOutlineIcon'

type Props = {
  visible: boolean
  onRequestClose: () => void
  onOverlayPress: () => void
  onNavPress: (path: string, external?: boolean) => void
  onUserAction: (path: string, extraAction?: () => void) => void
  onMyTravels?: () => void
  onLogout: () => void
  colors: ThemedColors
  styles: any
  activePath: string
  isAuthenticated: boolean
  username?: string | null
  favoritesCount: number
  unreadCount?: number
  themeToggleNode?: React.ReactNode
}

type MenuActionItem = {
  key: string
  label: string
  icon: string
  onPress: () => void
  accessibilityLabel?: string
  active?: boolean
  iconColor?: string
  labelStyle?: any
  iconSlotStyle?: any
  trailingNode?: React.ReactNode
}

const renderMenuItem = (
  item: MenuActionItem,
  styles: any,
  colors: ThemedColors,
) => (
  <Pressable
    key={item.key}
    onPress={item.onPress}
    style={({ hovered, pressed }) => [
      styles.modalNavItem,
      (hovered || pressed) && styles.modalNavItemHover,
      item.active && styles.modalNavItemActive,
    ]}
    accessibilityRole="button"
    accessibilityLabel={item.accessibilityLabel ?? item.label}
    accessibilityState={item.active ? { selected: true } : undefined}
  >
    <View style={[styles.iconSlot20, item.iconSlotStyle]}>
      {item.icon === 'belarus-outline' ? (
        <BelarusOutlineIcon
          size={20}
          color={item.iconColor ?? (item.active ? colors.primary : colors.textMuted)}
        />
      ) : (
        <Feather
          name={item.icon as any}
          size={20}
          color={item.iconColor ?? (item.active ? colors.primary : colors.textMuted)}
        />
      )}
      {item.trailingNode}
    </View>
    <Text style={[styles.modalNavLabel, item.active && styles.modalNavLabelActive, item.labelStyle]}>
      {item.label}
    </Text>
  </Pressable>
)

export default function CustomHeaderMobileMenu({
  visible,
  onRequestClose,
  onOverlayPress,
  onNavPress,
  onUserAction,
  onMyTravels,
  onLogout,
  colors,
  styles,
  activePath,
  isAuthenticated,
  username,
  favoritesCount,
  unreadCount = 0,
  themeToggleNode,
}: Props) {
  // A11Y-05: focus trap для web — при открытии меню фокус остаётся внутри панели
  const panelRef = useRef<any>(null);
  useFocusTrap(panelRef as any, { enabled: visible && Platform.OS === 'web' });

  const accountItems: MenuActionItem[] = !isAuthenticated
    ? [
        {
          key: 'login',
          label: 'Войти',
          icon: 'log-in',
          onPress: () => onUserAction(buildLoginHref({ intent: 'menu' }) as any),
        },
        {
          key: 'registration',
          label: 'Зарегистрироваться',
          icon: 'user-plus',
          onPress: () => onUserAction('/registration'),
        },
      ]
    : [
        {
          key: 'profile',
          label: `Личный кабинет${favoritesCount > 0 ? ` (${favoritesCount})` : ''}`,
          icon: 'user',
          onPress: () => onUserAction('/profile'),
          accessibilityLabel: username ? `Личный кабинет ${username}` : 'Личный кабинет',
        },
        {
          key: 'new-travel',
          label: 'Добавить путешествие',
          icon: 'plus-circle',
          onPress: () => onUserAction('/travel/new'),
        },
        {
          key: 'my-travels',
          label: 'Мои путешествия',
          icon: 'map',
          onPress: onMyTravels ? onMyTravels : () => onUserAction('/metravel'),
        },
        {
          key: 'user-points',
          label: 'Мои точки',
          icon: 'map-pin',
          onPress: () => onUserAction('/userpoints'),
        },
        {
          key: 'messages',
          label: unreadCount > 0 ? `Сообщения (${unreadCount})` : 'Сообщения',
          icon: 'mail',
          onPress: () => onUserAction('/messages'),
          accessibilityLabel:
            unreadCount > 0 ? `Сообщения, ${unreadCount} непрочитанных` : 'Сообщения',
          iconColor: unreadCount > 0 ? colors.primary : colors.textMuted,
          labelStyle: unreadCount > 0 ? { fontWeight: '600', color: colors.text } : undefined,
          iconSlotStyle: { position: 'relative' },
          trailingNode: <UnreadBadge count={unreadCount} />,
        },
        {
          key: 'export',
          label: 'Экспорт в PDF',
          icon: 'file-text',
          onPress: () => onUserAction('/export'),
        },
        {
          key: 'logout',
          label: 'Выход',
          icon: 'log-out',
          onPress: onLogout,
        },
      ]

  const navigationItems: MenuActionItem[] = (PRIMARY_HEADER_NAV_ITEMS ?? []).map((item) => ({
    key: item.path,
    label: item.label,
    icon: item.icon,
    onPress: () => onNavPress(item.path, item.external),
    active: !item.external && activePath === item.path,
  }))

  const documentItems: MenuActionItem[] = (DOCUMENT_NAV_ITEMS ?? []).map((item) => ({
    key: item.path,
    label: item.label,
    icon: item.icon,
    onPress: () => onUserAction(item.path),
  }))

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.modalOverlay} testID="mobile-menu-overlay-container">
        <Pressable
          style={styles.modalOverlay}
          testID="mobile-menu-overlay"
          collapsable={false}
          onPress={onOverlayPress}
          accessibilityRole="button"
          accessibilityLabel="Закрыть меню"
        >
          <View style={{ flex: 1 }} collapsable={false} />
        </Pressable>

        <View
          ref={panelRef}
          style={styles.modalContent}
          testID="mobile-menu-panel"
          {...({ role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Меню навигации' } as any)}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Меню</Text>
            <Pressable
              onPress={onRequestClose}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Закрыть меню"
              testID="mobile-menu-close"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalNavContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSectionTitle}>Аккаунт</Text>
            {accountItems.map((item) => renderMenuItem(item, styles, colors))}

            <View style={styles.modalDivider} />
            <Text style={styles.modalSectionTitle}>Навигация</Text>
            {navigationItems.map((item) => renderMenuItem(item, styles, colors))}

            {themeToggleNode ? (
              <>
                <View style={styles.modalDivider} />
                <Text style={styles.modalSectionTitle}>Тема</Text>
                <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{themeToggleNode}</View>
              </>
            ) : null}

            <View style={styles.modalDivider} />
            <Text style={styles.modalSectionTitle}>Документы</Text>
            {documentItems.map((item) => renderMenuItem(item, styles, colors))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
