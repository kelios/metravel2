import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    useWindowDimensions,
    Image,
} from 'react-native';
import { Menu, Divider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFilters } from '@/providers/FiltersProvider';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { router } from 'expo-router';
import { useUserProfileCached } from '@/src/hooks/useUserProfileCached';

function RenderRightMenu() {
    const { isAuthenticated, username, logout, userId, profileRefreshToken } = useAuth();
    const { favorites } = useFavorites();
    const { updateFilters } = useFilters();
    const [visible, setVisible] = useState(false);
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;

    const { profile } = useUserProfileCached(userId, {
        enabled: isAuthenticated && !!userId,
        cacheKeySuffix: profileRefreshToken,
    });

    const avatarUri = React.useMemo(() => {
        const raw = profile?.avatar;
        if (!raw) return null;
        const separator = raw.includes('?') ? '&' : '?';
        return `${raw}${separator}v=${profileRefreshToken}`;
    }, [profile?.avatar, profileRefreshToken]);

    const openMenu = useCallback(() => setVisible(true), []);
    const closeMenu = useCallback(() => setVisible(false), []);

    const handleOpenPublicProfile = useCallback(() => {
        if (!userId) return;
        router.push(`/user/${userId}` as any);
    }, [userId]);

    const handleNavigate = useCallback(
        (path: string, extraAction?: () => void) => {
            requestAnimationFrame(() => {
                extraAction?.();
                router.push(path as any);
                closeMenu();
            });
        },
        [closeMenu]
    );

    const handleLogout = useCallback(async () => {
        await logout();
        closeMenu();
        router.push('/' as any);
    }, [logout, closeMenu]);

    return (
        <View style={styles.container}>
            {isAuthenticated && username && !isMobile && (
                <TouchableOpacity
                    onPress={handleOpenPublicProfile}
                    accessibilityRole="button"
                    accessibilityLabel={`Открыть публичный профиль ${username}`}
                    style={styles.userContainer}
                >
                    {avatarUri ? (
                        <Image key={avatarUri} source={{ uri: avatarUri }} style={styles.userAvatar} />
                    ) : (
                        <Icon name="account-circle" size={24} color="#333" />
                    )}
                    <Text style={styles.username} numberOfLines={1}>
                        {username}
                    </Text>
                </TouchableOpacity>
            )}

            <Menu
                visible={visible}
                onDismiss={closeMenu}
                contentStyle={styles.menuContent}
                anchor={
                    <TouchableOpacity onPress={openMenu} style={styles.menuButton}>
                        <Icon name="menu" size={24} color="#333" />
                    </TouchableOpacity>
                }
            >
                {!isAuthenticated ? (
                    <>
                        <Menu.Item
                            onPress={() => handleNavigate('/login')}
                            title="Войти"
                            leadingIcon="login"
                        />
                        <Menu.Item
                            onPress={() => handleNavigate('/registration')}
                            title="Зарегистрироваться"
                            leadingIcon="account-plus"
                        />
                    </>
                ) : (
                    <>
                        <Menu.Item
                            onPress={() => handleNavigate('/profile')}
                            title={`Личный кабинет${favorites.length > 0 ? ` (${favorites.length})` : ''}`}
                            leadingIcon={({ size }) => (
                                <Icon name="account-circle" size={size} color="#6b8e7f" />
                            )}
                        />
                        <Divider />
                        <Menu.Item
                            onPress={() =>
                                handleNavigate('/metravel', () => {
                                    const numericUserId = userId ? Number(userId) : undefined;
                                    updateFilters({ user_id: numericUserId });
                                })
                            }
                            title="Мои путешествия"
                            leadingIcon={({ size }) => (
                                <Icon name="earth" size={size} color="#6aaaaa" />
                            )}
                        />
                        <Divider />
                        <Menu.Item
                            onPress={() => handleNavigate('/travel/new')}
                            title="Добавить путешествие"
                            leadingIcon={({ size }) => (
                                <Icon name="map-plus" size={size} color="#6aaaaa" />
                            )}
                        />
                        <Divider />
                        <Menu.Item
                            onPress={() => handleNavigate('/export')}
                            title="Экспорт в PDF"
                            leadingIcon={({ size }) => (
                                <Icon name="file-pdf-box" size={size} color="#b83a3a" />
                            )}
                        />
                        <Divider />
                        <Menu.Item
                            onPress={handleLogout}
                            title="Выход"
                            leadingIcon={({ size }) => (
                                <Icon name="logout" size={size} color="#6aaaaa" />
                            )}
                        />
                    </>
                )}
            </Menu>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flexDirection: 'row', 
        alignItems: 'center',
        gap: 8,
    },
    userContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
        maxWidth: 180,
    },
    userAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    username: { fontSize: 16, color: '#333', marginLeft: 6 },
    menuButton: {
        backgroundColor: '#f0f0f0',
        borderRadius: 24,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContent: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingVertical: 4,
        elevation: 5,
        minWidth: 200,
        borderColor: '#e0e0e0',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
});

export default React.memo(RenderRightMenu);
