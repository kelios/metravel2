// Страница профиля пользователя
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import EmptyState from '@/components/EmptyState';

interface UserStats {
  travelsCount: number;
  favoritesCount: number;
  viewsCount: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;
  const { user, isAuthenticated, logout } = useAuth();
  const { favorites, viewHistory } = useFavorites();
  const [stats, setStats] = useState<UserStats>({
    travelsCount: 0,
    favoritesCount: 0,
    viewsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, [favorites, viewHistory]);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      // Загружаем статистику пользователя
      const [userName, userId] = await Promise.all([
        AsyncStorage.getItem('userName'),
        AsyncStorage.getItem('userId'),
      ]);

      // Подсчитываем статистику
      setStats({
        travelsCount: 0, // TODO: загрузить из API
        favoritesCount: favorites.length,
        viewsCount: viewHistory.length,
      });
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, [logout, router]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="user"
          title="Войдите в аккаунт"
          description="Для доступа к профилю необходимо войти в систему"
          action={{
            label: 'Войти',
            onPress: () => router.push('/login'),
          }}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#4a8c8c" />
        </View>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      icon: 'heart',
      label: 'Избранное',
      count: stats.favoritesCount,
      onPress: () => router.push('/favorites'),
      color: '#ef5350',
    },
    {
      icon: 'map',
      label: 'Мои путешествия',
      count: stats.travelsCount,
      onPress: () => router.push('/metravel'),
      color: '#4a8c8c',
    },
    {
      icon: 'eye',
      label: 'История просмотров',
      count: stats.viewsCount,
      onPress: () => router.push('/history'),
      color: '#ff9f5a',
    },
    {
      icon: 'settings',
      label: 'Настройки',
      onPress: () => router.push('/settings'),
      color: '#667085',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Feather name="user" size={32} color="#4a8c8c" />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || 'Пользователь'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Feather name="map" size={24} color="#4a8c8c" />
            <Text style={styles.statNumber}>{stats.travelsCount}</Text>
            <Text style={styles.statLabel}>Путешествий</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="heart" size={24} color="#ef5350" />
            <Text style={styles.statNumber}>{stats.favoritesCount}</Text>
            <Text style={styles.statLabel}>Избранное</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="eye" size={24} color="#ff9f5a" />
            <Text style={styles.statNumber}>{stats.viewsCount}</Text>
            <Text style={styles.statLabel}>Просмотров</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <Pressable
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              {...Platform.select({
                web: { cursor: 'pointer' },
              })}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                <Feather name={item.icon as any} size={20} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.count !== undefined && (
                  <Text style={styles.menuCount}>{item.count}</Text>
                )}
              </View>
              <Feather name="chevron-right" size={20} color="#ccc" />
            </Pressable>
          ))}
        </View>

        {/* Logout Button */}
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
          {...Platform.select({
            web: { cursor: 'pointer' },
          })}
        >
          <Feather name="log-out" size={20} color="#ef5350" />
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4a8c8c',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1b1f23',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1b1f23',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1b1f23',
  },
  menuCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef5350',
    gap: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef5350',
  },
});
