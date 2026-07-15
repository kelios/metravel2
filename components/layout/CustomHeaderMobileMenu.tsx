import React, { useRef } from 'react'
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import type { ThemedColors } from '@/hooks/useTheme'
import { DOCUMENT_NAV_ITEMS, PRIMARY_HEADER_NAV_ITEMS, SECONDARY_HEADER_NAV_ITEMS, type HeaderNavItem } from '@/constants/headerNavigation'
import type { NavigationIconName } from '@/constants/navigationIcons'
import { buildLoginHref } from '@/utils/authNavigation'
import { trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import UnreadBadge from './UnreadBadge'
import NavigationIcon from './NavigationIcon'
import { translate as i18nT } from '@/i18n'


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
  icon: NavigationIconName
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
      <NavigationIcon
        name={item.icon}
        size={20}
        color={item.iconColor ?? (item.active ? colors.primary : colors.textMuted)}
      />
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
          label: i18nT('navigation:components.layout.CustomHeaderMobileMenu.voyti_ff34a63d'),
          icon: 'log-in',
          onPress: () => onUserAction(buildLoginHref({ intent: 'menu' }) as any),
        },
        {
          key: 'registration',
          label: i18nT('navigation:components.layout.CustomHeaderMobileMenu.zaregistrirovatsya_42755889'),
          icon: 'user-plus',
          onPress: () => {
            trackRegisterCtaClicked({ source: 'mobile_menu', intent: 'menu', authState: 'guest' })
            onUserAction('/registration')
          },
        },
      ]
    : [
        {
          key: 'profile',
          label: i18nT('navigation:components.layout.CustomHeaderMobileMenu.lichnyy_kabinet_value1_ea3db966', { value1: favoritesCount > 0 ? ` (${favoritesCount})` : '' }),
          icon: 'user',
          onPress: () => onUserAction('/profile'),
          accessibilityLabel: username ? i18nT('navigation:components.layout.CustomHeaderMobileMenu.lichnyy_kabinet_value1_e241654e', { value1: username }) : i18nT('navigation:components.layout.CustomHeaderMobileMenu.lichnyy_kabinet_b728bc9e'),
        },
        {
          key: 'new-travel',
          label: i18nT('navigation:components.layout.CustomHeaderMobileMenu.dobavit_puteshestvie_f5877871'),
          icon: 'plus-circle',
          onPress: () => onUserAction('/travel/new'),
        },
        {
          key: 'my-travels',
          label: i18nT('navigation:components.layout.CustomHeaderMobileMenu.moi_puteshestviya_353f3065'),
          icon: 'map',
          onPress: onMyTravels ? onMyTravels : () => onUserAction('/metravel'),
        },
        {
          key: 'user-points',
          label: i18nT('navigation:components.layout.CustomHeaderMobileMenu.moi_tochki_9da59ffd'),
          icon: 'map-pin',
          onPress: () => onUserAction('/userpoints'),
        },
        {
          key: 'messages',
          label: unreadCount > 0 ? i18nT('navigation:components.layout.CustomHeaderMobileMenu.soobscheniya_value1_155d128d', { value1: unreadCount }) : i18nT('navigation:components.layout.CustomHeaderMobileMenu.soobscheniya_1fe9d06d'),
          icon: 'mail',
          onPress: () => onUserAction('/messages'),
          accessibilityLabel:
            unreadCount > 0 ? i18nT('navigation:components.layout.CustomHeaderMobileMenu.soobscheniya_value1_neprochitannyh_06035ae9', { value1: unreadCount }) : i18nT('navigation:components.layout.CustomHeaderMobileMenu.soobscheniya_1fe9d06d'),
          iconColor: unreadCount > 0 ? colors.primary : colors.textMuted,
          labelStyle: unreadCount > 0 ? { fontWeight: '600', color: colors.text } : undefined,
          iconSlotStyle: { position: 'relative' },
          trailingNode: <UnreadBadge count={unreadCount} />,
        },
        // Экспорт в PDF («Книга путешествий») скрыт в мобильной версии сайта —
        // фича доступна только на десктопе (см. AccountMenu). На мобильном пункт убран.
        {
          key: 'logout',
          label: i18nT('navigation:components.layout.CustomHeaderMobileMenu.vyhod_0a810aed'),
          icon: 'log-out',
          onPress: onLogout,
        },
      ]

  // «Статьи» добавлены локально (не в HEADER_NAV_ITEMS): попадание в HEADER_NAV_ITEMS
  // включило бы /articles в TOP_LEVEL_TAB_PATHS и скрыло контекст-бар с кнопкой «Назад».
  const articlesNavItem: HeaderNavItem = {
    path: '/articles',
    label: i18nT('navigation:components.layout.CustomHeaderMobileMenu.stati_bb6d41b4'),
    icon: 'file-text',
    priority: 'secondary',
  }

  const navigationItems: MenuActionItem[] = [
    ...(PRIMARY_HEADER_NAV_ITEMS ?? []),
    articlesNavItem,
    ...(SECONDARY_HEADER_NAV_ITEMS ?? []),
  ].map((item) => ({
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
          accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderMobileMenu.zakryt_menyu_fd90a4da')}
        >
          <View style={{ flex: 1 }} collapsable={false} />
        </Pressable>

        <View
          ref={panelRef}
          style={styles.modalContent}
          testID="mobile-menu-panel"
          {...({ role: 'dialog', 'aria-modal': 'true', 'aria-label': i18nT('navigation:components.layout.CustomHeaderMobileMenu.menyu_navigatsii_039574df') } as any)}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{i18nT('navigation:components.layout.CustomHeaderMobileMenu.menyu_cb359c1b')}</Text>
            <Pressable
              onPress={onRequestClose}
              style={styles.modalCloseButton}
              accessibilityRole="button"
              accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderMobileMenu.zakryt_menyu_fd90a4da')}
              testID="mobile-menu-close"
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalNavContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSectionTitle}>{i18nT('navigation:components.layout.CustomHeaderMobileMenu.akkaunt_39bf2f02')}</Text>
            {accountItems.map((item) => renderMenuItem(item, styles, colors))}

            <View style={styles.modalDivider} />
            <Text style={styles.modalSectionTitle}>{i18nT('navigation:components.layout.CustomHeaderMobileMenu.navigatsiya_15727585')}</Text>
            {navigationItems.map((item) => renderMenuItem(item, styles, colors))}

            {themeToggleNode ? (
              <>
                <View style={styles.modalDivider} />
                <Text style={styles.modalSectionTitle}>{i18nT('navigation:components.layout.CustomHeaderMobileMenu.tema_cfc0350a')}</Text>
                <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{themeToggleNode}</View>
              </>
            ) : null}

            <View style={styles.modalDivider} />
            <Text style={styles.modalSectionTitle}>{i18nT('navigation:components.layout.CustomHeaderMobileMenu.dokumenty_48a6fa0f')}</Text>
            {documentItems.map((item) => renderMenuItem(item, styles, colors))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
