import { memo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { getThemedColors, useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';

const STORAGE_KEY_NOTIFICATIONS = 'user_notifications';
const STORAGE_KEY_LAST_CHECK = 'notifications_last_check';

const resolveIsDark = () => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
};

const resolveIconName = (icon?: string): keyof typeof Feather.glyphMap => {
  if (!icon) return 'bell';
  const glyphMap = (Feather as any).glyphMap as Record<string, number> | undefined;
  if (glyphMap && Object.prototype.hasOwnProperty.call(glyphMap, icon)) {
    return icon as keyof typeof Feather.glyphMap;
  }
  return 'bell';
};

export type NotificationType = 
  | 'badge_earned'
  | 'level_up'
  | 'reaction_received'
  | 'comment_received'
  | 'reminder_draft'
  | 'reminder_complete'
  | 'achievement_progress';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  color: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface NotificationSystemProps {
  onNotificationPress?: (notification: Notification) => void;
}

const NotificationSystem = ({ onNotificationPress }: NotificationSystemProps) => {
  const colors = useThemedColors();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const notificationsData = await AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
        if (notificationsData) {
          const allNotifications: Notification[] = JSON.parse(notificationsData);
          setNotifications(allNotifications);
          setUnreadCount(allNotifications.filter((n) => !n.read).length);
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    loadNotifications();
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      setNotifications((prev) => {
        const updated = prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
        setUnreadCount(updated.filter((n) => !n.read).length);
        void AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      setNotifications((prev) => {
        const updated = prev.map((n) => ({ ...n, read: true }));
        setUnreadCount(0);
        void AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      markAsRead(notification.id);
      onNotificationPress?.(notification);
    },
    [markAsRead, onNotificationPress]
  );

  const renderNotification = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem notification={item} onPress={() => handleNotificationPress(item)} />
    ),
    [handleNotificationPress]
  );

  if (notifications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="bell-off" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Нет уведомлений</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Здесь будут появляться важные события</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Feather name="bell" size={20} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Уведомления</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Button
            label="Прочитать все"
            onPress={markAllAsRead}
            variant="ghost"
            size="sm"
            style={[styles.markAllReadButton, { backgroundColor: 'transparent' }]}
            accessibilityLabel="Прочитать все"
          />
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
}

const NotificationItem = memo(({ notification, onPress }: NotificationItemProps) => {
  const colors = useThemedColors();
  const { title, message, icon, color, timestamp, read } = notification;
  const [fadeAnim] = useState(new Animated.Value(read ? 1 : 0.95));
  const shouldUseNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    if (!read) {
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: shouldUseNativeDriver,
      }).start();
    }
  }, [fadeAnim, read, shouldUseNativeDriver]);

  const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffMs = now.getTime() - notificationTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    return notificationTime.toLocaleDateString('ru-RU');
  };

  return (
    <Animated.View style={{ transform: [{ scale: fadeAnim }] }}>
      <Pressable
        style={[
          styles.notificationItem,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
          !read && [styles.notificationItemUnread, { backgroundColor: colors.primaryLight }]
        ]}
        onPress={onPress}
      >
        <View style={[styles.notificationIcon, { backgroundColor: color }]}>
          <Feather name={resolveIconName(icon)} size={16} color={colors.textOnDark} />
        </View>

        <View style={styles.notificationContent}>
          <Text style={[styles.notificationTitle, { color: colors.text }, !read && styles.notificationTitleUnread]}>
            {title}
          </Text>
          <Text style={[styles.notificationMessage, { color: colors.textMuted }]} numberOfLines={2}>
            {message}
          </Text>
          <Text style={[styles.notificationTime, { color: colors.textMuted }]}>{getTimeAgo(timestamp)}</Text>
        </View>

        {!read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  markAllReadButton: {
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  list: {
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  notificationItemUnread: {
    // backgroundColor moved to inline styles
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: DESIGN_TOKENS.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default memo(NotificationSystem);

// Утилита для создания уведомления
export const createNotification = async (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
  try {
    const notificationsData = await AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    const notifications: Notification[] = notificationsData ? JSON.parse(notificationsData) : [];

    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    notifications.unshift(newNotification);

    // Храним только последние 50 уведомлений
    const trimmedNotifications = notifications.slice(0, 50);
    await AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(trimmedNotifications));

    return newNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Утилита для проверки незавершенных черновиков
export const checkDraftReminders = async () => {
  try {
    const colors = getThemedColors(resolveIsDark());
    const lastCheckData = await AsyncStorage.getItem(STORAGE_KEY_LAST_CHECK);
    const now = new Date();
    
    if (lastCheckData) {
      const lastCheck = new Date(lastCheckData);
      const hoursSinceCheck = (now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60);
      
      // Проверяем раз в 24 часа
      if (hoursSinceCheck < 24) return;
    }

    // Здесь должна быть логика проверки черновиков
    // Для примера создаем напоминание
    await createNotification({
      type: 'reminder_draft',
      title: 'У вас есть незавершенная статья',
      message: 'Продолжите работу над статьей "Путешествие в горы"',
      icon: 'file-text',
      color: colors.primaryLight,
    });

    await AsyncStorage.setItem(STORAGE_KEY_LAST_CHECK, now.toISOString());
  } catch (error) {
    console.error('Error checking draft reminders:', error);
  }
};
