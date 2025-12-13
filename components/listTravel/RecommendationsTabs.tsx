import React, {
  useState,
  useMemo,
  lazy,
  Suspense,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  ScrollView,
  Image,
  Animated,
  FlatList,
  RefreshControl,
  findNodeHandle,
  UIManager,
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useFavorites } from '@/context/FavoritesContext';
import { useAuth } from '@/context/AuthContext';

/* ---------------- lazy blocks ---------------- */

const PersonalizedRecommendations = lazy(() =>
  import('@/components/PersonalizedRecommendations').catch(() => ({
    default: () => (
      <View style={styles.errorContainer}>
        <MaterialIcons
          name="error-outline"
          size={48}
          color={DESIGN_TOKENS.colors.error}
        />
        <Text style={styles.errorText}>Не удалось загрузить рекомендации</Text>
      </View>
    ),
  })),
);

const WeeklyHighlights = lazy(() =>
  import('@/components/WeeklyHighlights').catch(() => ({
    default: () => (
      <View style={styles.errorContainer}>
        <MaterialIcons
          name="error-outline"
          size={48}
          color={DESIGN_TOKENS.colors.error}
        />
        <Text style={styles.errorText}>Не удалось загрузить подборку месяца</Text>
      </View>
    ),
  })),
);

/* ---------------- types ---------------- */

type TabType = 'recommendations' | 'highlights' | 'favorites' | 'history';

interface RecommendationsTabsProps {
  forceVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

/* ---------------- skeletons ---------------- */

const CardSkeleton = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonImage} />
    <View style={styles.skeletonContent}>
      <View style={[styles.skeletonLine, { width: '80%' }]} />
      <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
    </View>
  </View>
);

const RecommendationsPlaceholder = () => (
  <View style={styles.placeholderContainer}>
    <View style={styles.skeletonHeader} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {[1, 2, 3].map(i => (
        <CardSkeleton key={i} />
      ))}
    </ScrollView>
  </View>
);

/* ---------------- card ---------------- */

const TravelCard = React.memo(
  ({
     item,
     onPress,
     isHistory = false,
   }: {
    item: any;
    onPress: () => void;
    isHistory?: boolean;
  }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const pressIn = () =>
      Animated.spring(scale, {
        toValue: 0.98,
        useNativeDriver: true,
        speed: 20,
      }).start();

    const pressOut = () =>
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
      }).start();

    return (
      <Animated.View style={[styles.cardContainer, { transform: [{ scale }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={styles.cardPressable}
        >
          <View style={styles.cardImageContainer}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <MaterialIcons name="route" size={32} />
              </View>
            )}

            {isHistory && (
              <View style={styles.historyBadge}>
                <MaterialIcons name="history" size={14} color="#fff" />
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.cardGradient}
            />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

/* ---------------- main ---------------- */

function RecommendationsTabs({
                               forceVisible,
                               onVisibilityChange,
                             }: RecommendationsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('highlights');
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const { favorites, viewHistory, refreshFavorites } = useFavorites();
  const { isAuthenticated } = useAuth();

  const underline = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const scrollLock = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- tabs MUST be before effects ---- */

  const tabs = useMemo(
    () => [
      { id: 'highlights' as TabType, label: 'Подборка месяца', icon: 'auto-awesome' },
      { id: 'recommendations' as TabType, label: 'Рекомендации', icon: 'star' },
      { id: 'favorites' as TabType, label: 'Избранное', icon: 'favorite', count: favorites.length },
      { id: 'history' as TabType, label: 'История', icon: 'history', count: viewHistory.length },
    ],
    [favorites.length, viewHistory.length],
  );

  /* ---- underline animation ---- */

  useEffect(() => {
    const index = tabs.findIndex(t => t.id === activeTab);
    if (index >= 0) {
      Animated.spring(underline, {
        toValue: index,
        useNativeDriver: true,
      }).start();
    }
  }, [activeTab, tabs, underline]);

  /* ---- handlers ---- */

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFavorites?.();
    setRefreshing(false);
  }, [refreshFavorites]);

  const collapse = () => {
    setCollapsed(true);
    onVisibilityChange?.(false);
  };

  const expand = () => {
    setCollapsed(false);
    onVisibilityChange?.(true);
  };

  /* ---- collapsed ---- */

  if (!forceVisible && collapsed) {
    return (
      <View style={styles.collapsedContainer}>
        <Pressable onPress={expand} style={styles.expandButton}>
          <Feather name="chevron-down" size={18} />
          <Text style={styles.expandText}>Показать рекомендации</Text>
        </Pressable>
      </View>
    );
  }

  /* ---- content ---- */

  const renderContent = () => {
    switch (activeTab) {
      case 'highlights':
        return (
          <Suspense fallback={<RecommendationsPlaceholder />}>
            <WeeklyHighlights showHeader={false} />
          </Suspense>
        );
      case 'recommendations':
        return (
          <Suspense fallback={<RecommendationsPlaceholder />}>
            <PersonalizedRecommendations showHeader={false} />
          </Suspense>
        );
      case 'favorites':
        return (
          <FlatList
            horizontal
            data={favorites}
            renderItem={({ item }) => (
              <TravelCard item={item} onPress={() => router.push(item.url)} />
            )}
            keyExtractor={i => `${i.type}-${i.id}`}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} />
            }
          />
        );
      case 'history':
        return (
          <FlatList
            horizontal
            data={viewHistory}
            renderItem={({ item }) => (
              <TravelCard
                item={item}
                onPress={() => router.push(item.url)}
                isHistory
              />
            )}
            keyExtractor={i => `${i.id}-${i.viewedAt}`}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScrollView horizontal ref={scrollRef} showsHorizontalScrollIndicator={false}>
          {tabs.map(tab => (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={styles.tab}>
              <MaterialIcons name={tab.icon as any} size={16} />
              <Text>{tab.label}</Text>
            </Pressable>
          ))}

          <Animated.View
            style={[
              styles.tabUnderline,
              {
                transform: [
                  {
                    translateX: underline.interpolate({
                      inputRange: tabs.map((_, i) => i),
                      outputRange: tabs.map((_, i) => i * 100),
                    }),
                  },
                ],
              },
            ]}
          />
        </ScrollView>

        <Pressable onPress={collapse} style={styles.collapseButton}>
          <Feather name="chevron-up" size={18} />
        </Pressable>
      </View>

      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 16 },
  header: { flexDirection: 'row', alignItems: 'center' },
  tab: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  tabUnderline: { height: 2, backgroundColor: '#000', position: 'absolute', bottom: 0 },
  collapseButton: { padding: 8 },
  content: { padding: 12 },

  cardContainer: { width: 200, marginRight: 12 },
  cardPressable: { flex: 1 },
  cardImageContainer: { height: 120 },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardGradient: { position: 'absolute', bottom: 0, height: '50%', width: '100%' },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 14 },

  historyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  collapsedContainer: { padding: 12 },
  expandButton: { flexDirection: 'row', alignItems: 'center' },
  expandText: { marginLeft: 8 },

  placeholderContainer: { padding: 16 },
  skeletonHeader: { height: 20, width: 160 },
  skeletonCard: { width: 200 },
  skeletonImage: { height: 120 },
  skeletonContent: { padding: 12 },
  skeletonLine: { height: 12 },

  errorContainer: { padding: 24, alignItems: 'center' },
  errorText: { textAlign: 'center' },
});

export default RecommendationsTabs;
