import React from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import type { ThemedColors } from '@/hooks/useTheme'
import { DOCUMENT_NAV_ITEMS, PRIMARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation'

type Props = {
  visible: boolean
  onRequestClose: () => void
  onOverlayPress: () => void
  onNavPress: (path: string) => void
  onUserAction: (path: string, extraAction?: () => void) => void
  onMyTravels?: () => void
  onCreate: () => void
  onLogout: () => void
  colors: ThemedColors
  styles: any
  activePath: string
  isAuthenticated: boolean
  username?: string | null
  favoritesCount: number
  themeToggleNode?: React.ReactNode
}

export default function CustomHeaderMobileMenu({
  visible,
  onRequestClose,
  onOverlayPress,
  onNavPress,
  onUserAction,
  onMyTravels,
  onCreate,
  onLogout,
  colors,
  styles,
  activePath,
  isAuthenticated,
  username,
  favoritesCount,
  themeToggleNode,
}: Props) {
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
          style={styles.modalContent}
          testID="mobile-menu-panel"
          {...({ role: 'dialog', 'aria-modal': 'true' } as any)}
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
            <Text style={styles.modalSectionTitle}>Навигация</Text>
            {PRIMARY_HEADER_NAV_ITEMS.map((item) => {
              const isActive = activePath === item.path
              return (
                <Pressable
                  key={item.path}
                  onPress={() => onNavPress(item.path)}
                  style={({ hovered, pressed }) => [
                    styles.modalNavItem,
                    (hovered || pressed) && styles.modalNavItemHover,
                    isActive && styles.modalNavItemActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={styles.iconSlot20}>
                    <Feather
                      name={item.icon as any}
                      size={20}
                      color={isActive ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.modalNavLabel, isActive && styles.modalNavLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              )
            })}

            <View style={styles.modalDivider} />
            <Text style={styles.modalSectionTitle}>Аккаунт</Text>
            {!isAuthenticated ? (
              <>
                <Pressable
                  onPress={() => onUserAction('/login')}
                  style={styles.modalNavItem}
                  accessibilityRole="button"
                  accessibilityLabel="Войти"
                >
                  <View style={styles.iconSlot20}>
                    <Feather name="log-in" size={20} color={colors.textMuted} />
                  </View>
                  <Text style={styles.modalNavLabel}>Войти</Text>
                </Pressable>
                <Pressable
                  onPress={() => onUserAction('/registration')}
                  style={styles.modalNavItem}
                  accessibilityRole="button"
                  accessibilityLabel="Зарегистрироваться"
                >
                  <View style={styles.iconSlot20}>
                    <Feather name="user-plus" size={20} color={colors.textMuted} />
                  </View>
                  <Text style={styles.modalNavLabel}>Зарегистрироваться</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => onUserAction('/profile')}
                  style={styles.modalNavItem}
                  accessibilityRole="button"
                  accessibilityLabel={username ? `Личный кабинет ${username}` : 'Личный кабинет'}
                >
                  <View style={styles.iconSlot20}>
                    <Feather name="user" size={20} color={colors.textMuted} />
                  </View>
                  <Text style={styles.modalNavLabel}>
                    {`Личный кабинет${favoritesCount > 0 ? ` (${favoritesCount})` : ''}`}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onMyTravels ? onMyTravels : () => onUserAction('/metravel')}
                  style={styles.modalNavItem}
                  accessibilityRole="button"
                  accessibilityLabel="Мои путешествия"
                >
                  <View style={styles.iconSlot20}>
                    <Feather name="map" size={20} color={colors.textMuted} />
                  </View>
                  <Text style={styles.modalNavLabel}>Мои путешествия</Text>
                </Pressable>

                <Pressable
                  onPress={() => onUserAction('/userpoints')}
                  style={styles.modalNavItem}
                  accessibilityRole="button"
                  accessibilityLabel="Мои точки"
                >
                  <View style={styles.iconSlot20}>
                    <Feather name="map-pin" size={20} color={colors.textMuted} />
                  </View>
                  <Text style={styles.modalNavLabel}>Мои точки</Text>
                </Pressable>

                <Pressable
                  onPress={onCreate}
                  style={styles.modalNavItem}
                  accessibilityRole="button"
                  accessibilityLabel="Поделиться маршрутом и историей"
                >
                  <View style={styles.iconSlot20}>
                    <Feather name="share-2" size={20} color={colors.textMuted} />
                  </View>
                  <Text style={styles.modalNavLabel}>Поделиться путешествием</Text>
                </Pressable>

                <Pressable
                  onPress={() => onUserAction('/export')}
                  style={styles.modalNavItem}
                  accessibilityRole="button"
                  accessibilityLabel="Экспорт в PDF"
                >
                  <View style={styles.iconSlot20}>
                    <Feather name="file-text" size={20} color={colors.textMuted} />
                  </View>
                  <Text style={styles.modalNavLabel}>Экспорт в PDF</Text>
                </Pressable>

                <Pressable
                  onPress={onLogout}
                  style={styles.modalNavItem}
                  accessibilityRole="button"
                  accessibilityLabel="Выход"
                >
                  <View style={styles.iconSlot20}>
                    <Feather name="log-out" size={20} color={colors.textMuted} />
                  </View>
                  <Text style={styles.modalNavLabel}>Выход</Text>
                </Pressable>
              </>
            )}

            {themeToggleNode ? (
              <>
                <View style={styles.modalDivider} />
                <Text style={styles.modalSectionTitle}>Тема</Text>
                <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{themeToggleNode}</View>
              </>
            ) : null}

            <View style={styles.modalDivider} />
            <Text style={styles.modalSectionTitle}>Документы</Text>
            {DOCUMENT_NAV_ITEMS.map((item) => (
              <Pressable
                key={item.path}
                onPress={() => onUserAction(item.path)}
                style={styles.modalNavItem}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.iconSlot20}>
                  <Feather name={item.icon as any} size={20} color={colors.textMuted} />
                </View>
                <Text style={styles.modalNavLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
