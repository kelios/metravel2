import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchTravelBySlug, fetchTravel } from '@/src/api/travelsApi';
import { getQuestById } from '@/components/quests/registry';
import { METRICS } from '@/constants/layout';

const MAX_BREADCRUMB_LENGTH = 50;

interface BreadcrumbItem {
  label: string;
  path: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
  travelName?: string; // ✅ ДОБАВЛЕНО: Название статьи для страницы путешествия
}

// Компонент навигационной цепочки (хлебные крошки)
export default function Breadcrumbs({ items, showHome = true, travelName }: BreadcrumbsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width <= METRICS.breakpoints.tablet;

  // ✅ ИСПРАВЛЕНИЕ: Получаем название статьи для страницы путешествия
  const isTravelPage = pathname?.startsWith('/travels/');
  const travelSlug = useMemo(() => {
    if (!isTravelPage) return null;
    const parts = pathname.split('/').filter(Boolean);
    const slugIndex = parts.indexOf('travels');
    return slugIndex >= 0 && parts[slugIndex + 1] ? parts[slugIndex + 1] : null;
  }, [pathname, isTravelPage]);

  const { data: travelData } = useQuery({
    // ВАЖНО: используем тот же ключ, что и useTravelDetails (['travel', slug]),
    // чтобы React Query переиспользовал один и тот же кэш и не делал второй запрос
    queryKey: ['travel', travelSlug],
    queryFn: () => {
      if (!travelSlug) return null;
      const idNum = Number(travelSlug);
      const isId = !Number.isNaN(idNum);
      return isId ? fetchTravel(idNum) : fetchTravelBySlug(travelSlug);
    },
    enabled: !!travelSlug && !travelName, // Загружаем только если не передано travelName
    staleTime: 600_000, // 10 минут
    gcTime: 10 * 60 * 1000,
  });

  // Используем переданное название или из запроса
  const finalTravelName = travelName || travelData?.name || null;

  const questBreadcrumbInfo = useMemo(() => {
    if (!pathname?.startsWith('/quests/')) {
      return null;
    }

    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 3) {
      return null;
    }

    const questSlug = parts[2];
    const questBundle = getQuestById(questSlug);
    let questTitle =
      questBundle?.title ||
      questSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    if (questTitle.length > MAX_BREADCRUMB_LENGTH) {
      questTitle = questTitle.slice(0, MAX_BREADCRUMB_LENGTH).trim() + '...';
    }

    const questPath = pathname || '/' + parts.slice(0, 3).join('/');
    return { label: questTitle, path: questPath };
  }, [pathname]);

  const breadcrumbs = useMemo(() => {
    const result: BreadcrumbItem[] = [];

    // Добавляем главную страницу
    if (showHome) {
      result.push({ label: 'Главная', path: '/' });
    }

    // Если переданы кастомные элементы, используем их
    if (items && items.length > 0) {
      return [...result, ...items];
    }

    // Специальный случай для детальных страниц квестов
    if (questBreadcrumbInfo) {
      result.push({ label: 'Квесты', path: '/quests' });
      result.push(questBreadcrumbInfo);
      return result;
    }

    // Автоматическое определение навигационной цепочки из pathname
    if (pathname === '/' || pathname === '/index') {
      return result;
    }

    // Разбираем pathname на части
    const parts = pathname.split('/').filter(Boolean);

    // ✅ ИСПРАВЛЕНИЕ: Обрабатываем части пути, пропуская "travels" - страницы /travels не существует
    parts.forEach((part, index) => {
      // Пропускаем "travels" во всех случаях - не показываем в breadcrumbs
      if (part === 'travels') {
        return;
      }

      // Формируем правильный path для навигации (включая travels в пути, если он был)
      // Специальный случай: сегмент "travel" должен вести на страницу "Мои путешествия"
      const path = part === 'travel'
        ? '/metravel'
        : '/' + parts.slice(0, index + 1).join('/');
      
      // ✅ ИСПРАВЛЕНИЕ: Для страницы статьи используем название из travelName (русское)
      let label = part;
      
      // Если это последний элемент на странице путешествия и есть название - используем его
      if (index === parts.length - 1 && isTravelPage && finalTravelName) {
        label = finalTravelName;
      } else {
        // Специальные случаи - локализация страниц (все на русском)
        const pageTranslations: Record<string, string> = {
          'travelsby': 'Беларусь',
          'map': 'Карта',
          'quests': 'Квесты',
          'roulette': 'Случайный маршрут',
          'article': 'Статья',
          'travel': 'Мои путешествия',
          'profile': 'Профиль',
          'login': 'Вход',
          'registration': 'Регистрация',
          'metravel': 'Мои путешествия',
          'chat': 'Чат',
          'about': 'О сайте',
          'export': 'Экспорт',
          'settings': 'Настройки',
          'history': 'История просмотров',
          'favorites': 'Избранное',
          'accountconfirmation': 'Подтверждение аккаунта',
          'set-password': 'Установка пароля',
          'articles': 'Статьи',
          'new': 'Новое путешествие',
        };

        if (pageTranslations[part]) {
          label = pageTranslations[part];
        } else {
          // Преобразуем slug в читаемое название на русском (только если это не страница путешествия)
          label = part
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      }
      
      // ✅ РЕАЛИЗАЦИЯ: Обрезаем слишком длинные названия (max 50 символов)
      if (label.length > MAX_BREADCRUMB_LENGTH) {
        label = label.slice(0, MAX_BREADCRUMB_LENGTH).trim() + '...';
      }

      result.push({ label, path });
    });

    return result;
  }, [pathname, items, showHome, finalTravelName, isTravelPage, questBreadcrumbInfo]);

  // Не показываем навигационную цепочку если только главная страница
  if (breadcrumbs.length <= 1) {
    return null;
  }

  const handlePress = (path: string) => {
    router.push(path as any);
  };

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <React.Fragment key={item.path}>
            {index > 0 && (
              <Feather 
                name="chevron-right" 
                size={14} 
                color="#999" 
                style={styles.separator}
              />
            )}
            <Pressable
              onPress={() => !isLast && handlePress(item.path)}
              disabled={isLast}
              style={({ pressed }) => [
                styles.item,
                isLast && styles.itemLast,
                pressed && !isLast && styles.itemPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isLast ? `Текущая страница: ${item.label}` : `Перейти на ${item.label}`}
            >
              <Text 
                style={[
                  styles.label,
                  isLast && styles.labelLast,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  containerMobile: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  item: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  itemLast: {
    opacity: 1,
  },
  itemPressed: {
    opacity: 0.7,
  },
  separator: {
    marginHorizontal: 4,
  },
  label: {
    fontSize: 13,
    color: '#667085',
    fontWeight: '500',
  },
  labelLast: {
    color: '#1b1f23',
    fontWeight: '600',
  },
});
