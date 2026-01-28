/**
 * Примеры использования оптимизаций Expo 54 + React 19
 * 
 * Этот файл содержит практические примеры использования
 * всех реализованных оптимизаций.
 */

import React, { Suspense, useTransition } from 'react';
import { View, Text, ActivityIndicator, Pressable, TextInput, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useTravelPrefetch } from '@/hooks/useTravelPrefetch';
import OptimizedImage from '@/components/ui/OptimizedImage';

// ============================================
// 1. FlashList для больших списков
// ============================================

interface Travel {
  id: string;
  name: string;
  imageUrl: string;
  slug: string;
}

export function OptimizedTravelList({ travels }: { travels: Travel[] }) {
  const { prefetchBySlug } = useTravelPrefetch();

  const renderItem = ({ item }: { item: Travel }) => (
    <Pressable
      style={{ padding: 16 }}
      onHoverIn={() => {
        if (Platform.OS !== 'web') return;
        // ✅ Prefetch при наведении для мгновенной загрузки
        prefetchBySlug(item.slug);
      }}
    >
      {/* ✅ Используем recyclingKey для переиспользования view */}
      <OptimizedImage
        source={{ uri: item.imageUrl }}
        recyclingKey={item.id}
        responsivePolicy="initial"
        contentFit="cover"
        aspectRatio={16 / 9}
        loading="lazy"
        priority="low"
      />
      <Text>{item.name}</Text>
    </Pressable>
  );

  return (
    <FlashList
      data={travels}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      // ✅ FlashList автоматически определяет размеры
      drawDistance={500}
      overrideItemLayout={(layout: any) => {
        layout.size = 280;
      }}
    />
  );
}

// ============================================
// 2. React Query с Prefetching
// ============================================

export function TravelCard({ slug }: { slug: string }) {
  const { prefetchBySlug, getCachedTravel } = useTravelPrefetch();

  // Проверяем, есть ли данные в кеше
  const cachedTravel = getCachedTravel(slug);

  return (
    <Pressable
      onHoverIn={() => {
        if (Platform.OS !== 'web') return;
        // ✅ Prefetch при наведении
        if (!cachedTravel) {
          prefetchBySlug(slug);
        }
      }}
    >
      <Text>Travel Card</Text>
    </Pressable>
  );
}

// ============================================
// 3. React 19 useTransition для плавных переходов
// ============================================

export function SearchWithTransition() {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = React.useState('');

  const handleSearch = (newQuery: string) => {
    // ✅ Используем startTransition для плавного обновления
    startTransition(() => {
      setQuery(newQuery);
    });
  };

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={handleSearch}
        placeholder="Поиск..."
        style={{ padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 }}
      />
      {isPending && <ActivityIndicator />}
      <SearchResults query={query} />
    </View>
  );
}

// ============================================
// 4. Suspense для lazy loading компонентов
// ============================================

const HeavyMap = React.lazy(() => import('@/components/Map'));

export function LazyLoadedMap() {
  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      {/* ✅ Компонент загружается только когда нужен */}
      <HeavyMap />
    </Suspense>
  );
}

// ============================================
// 5. React Query с оптимизированными настройками
// ============================================

export function OptimizedDataFetching({ travelId }: { travelId: number }) {
  const { isLoading } = useQuery({
    queryKey: ['travel', travelId],
    queryFn: () => fetchTravel(travelId),
    // ✅ Данные свежие 5 минут
    staleTime: 5 * 60 * 1000,
    // ✅ Кеш хранится 10 минут
    gcTime: 10 * 60 * 1000,
    // ✅ Не перезагружать при фокусе окна
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <ActivityIndicator />;

  return <View>{/* Render data */}</View>;
}

// ============================================
// 6. Batch prefetching для связанных данных
// ============================================

export function RelatedTravels({ currentTravelId }: { currentTravelId: number }) {
  const { prefetchMultiple } = useTravelPrefetch();

  const { data: related = [] } = useQuery<Array<{ id?: number; slug?: string }>>({
    queryKey: ['related-travels', currentTravelId],
    queryFn: () => fetchRelatedTravels(currentTravelId),
  });

  React.useEffect(() => {
    if (!related.length) return;
    // ✅ Prefetch всех связанных путешествий сразу
    prefetchMultiple(related);
  }, [prefetchMultiple, related]);

  return <View>{/* Render related travels */}</View>;
}

// ============================================
// 7. Оптимизированные изображения с fallback
// ============================================

export function ResponsiveImage({ imageUrl }: { imageUrl: string }) {
  return (
    <OptimizedImage
      source={{ uri: imageUrl }}
      contentFit="cover"
      aspectRatio={16 / 9}
      // ✅ Blurhash placeholder
      placeholder="LGF5]+Yk^6#M@-5c,1J5@[or[Q6."
      // ✅ Приоритет для LCP изображений
      priority="high"
      loading="eager"
      // ✅ Кеширование
      cachePolicy="memory-disk"
      // ✅ Плавный переход
      transition={300}
    />
  );
}

// ============================================
// Вспомогательные функции (заглушки)
// ============================================

async function fetchTravel(id: number) {
  // Заглушка
  return { id, name: 'Travel' };
}

async function fetchRelatedTravels(id: number) {
  // Заглушка
  if (id === -1) return [];
  return [] as Array<{ id?: number; slug?: string }>;
}

function SearchResults({ query }: { query: string }) {
  return <Text>Results for: {query}</Text>;
}
