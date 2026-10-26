import { useCallback, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useThemedColors } from '@/hooks/useTheme';
import { useAvatarUri } from '@/hooks/useAvatarUri';
import { globalFocusStyles } from '@/styles/globalFocus';
import { buildAccountMenuModel, runAccountMenuTarget } from './accountMenuModel';
import { requestOpenDockMore } from './bottomDockItemDefs';
import { handleHeaderNavPress } from './customHeaderNavModel';
import UserAvatar from './UserAvatar';
import { translate as i18nT } from '@/i18n'

type CustomHeaderMobileAccountSectionProps = {
  activePath: string;
  styles: any;
};

/**
 * Правая группа мобильной бренд-строки: вход гостя или профиль пользователя и
 * кнопка меню.
 *
 * #2779: своего меню у шапки больше нет. Кнопка открывает тот же лист «Ещё»,
 * что и пункт дока (`requestOpenDockMore`) — на телефоне одно меню с одним
 * набором пунктов. Гость видит «Войти» прямо в шапке: раньше вход прятался
 * внутри меню, а на его месте стоял невидимый плейсхолдер. Подпись и цель входа —
 * из общей модели меню аккаунта, как у desktop.
 */
export default function CustomHeaderMobileAccountSection({
  styles,
}: CustomHeaderMobileAccountSectionProps) {
  const colors = useThemedColors();
  const router = useRouter();
  const { authReady, isAuthenticated, username, userAvatar, profileRefreshToken } = useAuth();
  const { avatarUri, setAvatarLoadError } = useAvatarUri({ userAvatar, profileRefreshToken });

  const navigate = useCallback((path: string) => handleHeaderNavPress(router, path), [router]);
  const openMenu = useCallback(() => {
    if (!requestOpenDockMore()) navigate('/more');
  }, [navigate]);

  const loginEntry = buildAccountMenuModel({
    surface: 'mobile',
    platform: Platform.OS,
    isAuthenticated: false,
    favoritesCount: 0,
    unreadCount: 0,
  }).guest.find((entry) => entry.key === 'login');

  let accountControl: ReactNode;
  if (isAuthenticated && username) {
    accountControl = (
      <Pressable
        onPress={() => navigate('/profile')}
        style={[styles.mobileUserPill, globalFocusStyles.focusable]}
        accessibilityRole="button"
        accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderMobileAccountSection.otkryt_profil_value1_4b61a725', { value1: username })}
      >
        <UserAvatar
          uri={avatarUri}
          size="md"
          onError={() => setAvatarLoadError(true)}
        />
        <Text style={styles.mobileUserName} numberOfLines={1}>
          {username}
        </Text>
      </Pressable>
    );
  } else if (authReady && !isAuthenticated && loginEntry) {
    accountControl = (
      <Pressable
        onPress={() => runAccountMenuTarget(loginEntry.target, 'mobile', {
          navigate,
          openExternal: (url) => handleHeaderNavPress(router, url, true),
          logout: () => undefined,
        })}
        style={[styles.mobileLoginButton, globalFocusStyles.focusable]}
        accessibilityRole="button"
        accessibilityLabel={loginEntry.title}
        testID="mobile-header-login"
      >
        <Feather name="log-in" size={16} color={colors.primaryText} />
        <Text style={styles.mobileLoginLabel} numberOfLines={1}>
          {loginEntry.title}
        </Text>
      </Pressable>
    );
  } else {
    // До чтения сессии вход ещё неизвестен: держим бокс, а не показываем «Войти»
    // пользователю, который вошёл.
    accountControl = (
      <View style={[styles.mobileUserPillPlaceholder, { pointerEvents: 'none' } as any]}>
        <UserAvatar uri={null} size="md" />
        <Text style={styles.mobileUserName} numberOfLines={1}>
          {' '}
        </Text>
      </View>
    );
  }

  return (
    <>
      {accountControl}

      <Pressable
        onPress={openMenu}
        style={[styles.mobileMenuButton, globalFocusStyles.focusable]}
        accessibilityRole="button"
        accessibilityLabel={i18nT('navigation:components.layout.CustomHeaderMobileAccountSection.otkryt_menyu_e43b6ae3')}
        testID="mobile-menu-open"
      >
        <View style={styles.iconSlot24}>
          <Feather name="menu" size={24} color={colors.text} />
        </View>
      </Pressable>
    </>
  );
}
