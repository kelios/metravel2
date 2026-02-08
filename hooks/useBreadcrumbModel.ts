import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useGlobalSearchParams, useLocalSearchParams, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelsApi';
import { fetchQuestByQuestId } from '@/api/quests';
import { fetchUserProfile } from '@/api/user';
import { queryKeys } from '@/queryKeys';

const useGlobalSearchParamsSafe: typeof useGlobalSearchParams =
  typeof useGlobalSearchParams === 'function'
    ? useGlobalSearchParams
    : (((_opts?: any) => ({}) as any) as any);

const useLocalSearchParamsSafe: typeof useLocalSearchParams =
  typeof useLocalSearchParams === 'function'
    ? useLocalSearchParams
    : (((_opts?: any) => ({}) as any) as any);

export type BreadcrumbModelItem = {
  label: string;
  path: string;
};

export type BreadcrumbModel = {
  items: BreadcrumbModelItem[];
  depth: number;
  currentTitle: string;
  pageContextTitle: string;
  backToPath: string | null;
  showBreadcrumbs: boolean;
};

const MAX_BREADCRUMB_LENGTH = 50;

const pageTranslations: Record<string, string> = {
  travelsby: 'Беларусь',
  map: 'Карта',
  quests: 'Квесты',
  roulette: 'Случайный маршрут',
  article: 'Статья',
  travel: 'Мои путешествия',
  profile: 'Профиль',
  login: 'Вход',
  registration: 'Регистрация',
  metravel: 'Мои путешествия',
  about: 'О сайте',
  export: 'Экспорт',
  settings: 'Настройки',
  history: 'История просмотров',
  favorites: 'Избранное',
  accountconfirmation: 'Подтверждение аккаунта',
  'set-password': 'Установка пароля',
  new: 'Новое путешествие',
  userpoints: 'Мои точки',
};

function normalizePathname(pathname: string | null | undefined) {
  if (!pathname) return '/';
  if (pathname === '/index') return '/';
  return pathname;
}

 function normalizeSlugPart(value: string | null) {
   if (!value) return null;
   return String(value).trim().split('#')[0].split('%23')[0] || null;
 }

function getResolvedPathname(pathname: string | null | undefined) {
  const normalized = normalizePathname(pathname);
  // Предпочитаем значение из роутера; к window обращаемся только если pathname пуст
  if (normalized && normalized !== undefined) {
    return normalized;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return normalizePathname(window.location.pathname);
  }
  return normalized;
}

function toTitleFromSegment(segment: string) {
  const translated = pageTranslations[segment];
  const base = translated
    ? translated
    : segment
        .split('-')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ');

  if (base.length > MAX_BREADCRUMB_LENGTH) {
    return base.slice(0, MAX_BREADCRUMB_LENGTH).trim() + '...';
  }

  return base;
}

function truncateLabel(label: string) {
  const base = String(label ?? '').trim();
  if (!base) return '';
  if (base.length > MAX_BREADCRUMB_LENGTH) {
    return base.slice(0, MAX_BREADCRUMB_LENGTH).trim() + '...';
  }
  return base;
}

function getRootTitle(pathname: string) {
  const root = HEADER_NAV_ITEMS.find((i) => i.path === pathname);
  if (root?.label) return root.label;
  const segment = pathname.replace(/^\//, '').split('/').filter(Boolean)[0] || '';
  if (segment) return toTitleFromSegment(segment);
  return 'Путешествия';
}

export function useBreadcrumbModel(): BreadcrumbModel {
  const pathname = usePathname();
  const resolvedPathname = getResolvedPathname(pathname);
  // expo-router mocks in unit tests often provide only useLocalSearchParams.
  // Prefer global search params when available; otherwise fall back to local params.
  const globalParams = useGlobalSearchParamsSafe<{ returnTo?: string | string[] }>();
  const localParams = useLocalSearchParamsSafe<{ returnTo?: string | string[] }>();
  const returnTo = (globalParams as any)?.returnTo ?? (localParams as any)?.returnTo;

  const normalizedReturnToParam = useMemo(() => {
    if (typeof returnTo === 'string') return returnTo;
    if (Array.isArray(returnTo)) return String(returnTo[0] ?? '');
    return '';
  }, [returnTo]);

  const travelSlug = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/travels/')) return null;
    const parts = p.split('/').filter(Boolean);
    const idx = parts.indexOf('travels');
    const raw = idx >= 0 && parts[idx + 1] ? String(parts[idx + 1]) : null;
    return normalizeSlugPart(raw);
  }, [resolvedPathname]);

  const travelCacheKey = useMemo(() => {
    if (!travelSlug) return null;
    const idNum = Number(travelSlug);
    const isId = Number.isFinite(idNum) && idNum > 0;
    return isId ? idNum : travelSlug;
  }, [travelSlug]);

  const { data: travelData } = useQuery({
    queryKey: queryKeys.travel(travelCacheKey as any),
    queryFn: ({ signal } = {} as any) => {
      if (!travelSlug) return null;
      const idNum = Number(travelSlug);
      const isId = !Number.isNaN(idNum);
      return isId ? fetchTravel(idNum, { signal }) : fetchTravelBySlug(travelSlug, { signal });
    },
    enabled: travelCacheKey != null,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });

  // Quest title from API (for breadcrumbs on quest detail pages)
  const questSlugForBreadcrumb = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/quests/')) return null;
    const parts = p.split('/').filter(Boolean);
    return parts.length >= 3 ? parts[2] : null;
  }, [resolvedPathname]);

  const { data: questApiData } = useQuery({
    queryKey: ['quest-bundle', questSlugForBreadcrumb],
    queryFn: () => questSlugForBreadcrumb ? fetchQuestByQuestId(questSlugForBreadcrumb) : null,
    enabled: !!questSlugForBreadcrumb,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });
  const questApiTitle = questApiData?.title || '';

  // User profile name (for breadcrumbs on /user/[id] pages)
  const userIdForBreadcrumb = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/user/')) return null;
    const parts = p.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'user') return null;
    const raw = parts[1];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? raw : null;
  }, [resolvedPathname]);

  const { data: userProfileData } = useQuery({
    queryKey: ['user-profile', userIdForBreadcrumb],
    queryFn: () => userIdForBreadcrumb ? fetchUserProfile(userIdForBreadcrumb) : null,
    enabled: !!userIdForBreadcrumb,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });
  const userProfileName = useMemo(() => {
    if (!userProfileData) return '';
    const clean = (v: unknown) => {
      const s = String(v ?? '').trim();
      return s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' ? '' : s;
    };
    return `${clean(userProfileData.first_name)} ${clean(userProfileData.last_name)}`.trim();
  }, [userProfileData]);

  return useMemo(() => {
    const p = resolvedPathname;
    const isHome = p === '/';

    if (isHome) {
      const pageContextTitle = getRootTitle('/');
      return {
        items: [],
        depth: 1,
        currentTitle: pageContextTitle,
        pageContextTitle,
        backToPath: null,
        showBreadcrumbs: false,
      };
    }

    const parts = p.split('/').filter(Boolean);

    const isTravelDetailsWithReturn =
      p.startsWith('/travels/') && typeof normalizedReturnToParam === 'string' && !!normalizedReturnToParam.trim();
    if (isTravelDetailsWithReturn) {
      const normalizedReturnTo = normalizedReturnToParam.startsWith('/')
        ? normalizedReturnToParam
        : `/${normalizedReturnToParam}`;
      const rootContext = HEADER_NAV_ITEMS.find((i) => i.path === normalizedReturnTo);
      const returnLabel = rootContext?.label || toTitleFromSegment(normalizedReturnTo.replace(/^\//, ''));

      if (travelSlug && !travelData?.name) {
        return {
          items: [],
          depth: 1,
          currentTitle: returnLabel,
          pageContextTitle: returnLabel,
          backToPath: normalizedReturnTo,
          showBreadcrumbs: false,
        };
      }
      const travelTitle = truncateLabel(String(travelData?.name || toTitleFromSegment(parts[parts.length - 1] || '')));

      const items: BreadcrumbModelItem[] = [
        { label: returnLabel, path: normalizedReturnTo },
        { label: travelTitle, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: travelTitle,
        pageContextTitle: returnLabel,
        backToPath: normalizedReturnTo,
        showBreadcrumbs: true,
      };
    }

    if (parts.length === 1) {
      const pageContextTitle = getRootTitle(p);
      return {
        items: [],
        depth: 1,
        currentTitle: pageContextTitle,
        pageContextTitle,
        backToPath: '/',
        showBreadcrumbs: false,
      };
    }

    const isUserProfile = p.startsWith('/user/') && parts.length >= 2 && parts[0] === 'user';
    if (isUserProfile) {
      const userName = userProfileName || 'Профиль';
      const userTitle = truncateLabel(userName);

      const items: BreadcrumbModelItem[] = [
        { label: userTitle, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: userTitle,
        pageContextTitle: 'Главная',
        backToPath: '/',
        showBreadcrumbs: true,
      };
    }

    const isQuestDetails = p.startsWith('/quests/') && parts.length >= 3;
    if (isQuestDetails) {
      const questSlug = parts[2];
      let questTitle = questApiTitle || toTitleFromSegment(questSlug);
      if (questTitle.length > MAX_BREADCRUMB_LENGTH) {
        questTitle = questTitle.slice(0, MAX_BREADCRUMB_LENGTH).trim() + '...';
      }

      const items = [
        { label: 'Квесты', path: '/quests' },
        { label: questTitle, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: questTitle,
        pageContextTitle: 'Квесты',
        backToPath: '/quests',
        showBreadcrumbs: true,
      };
    }

    const computed: BreadcrumbModelItem[] = [];
    parts.forEach((part, index) => {
      if (part === 'travels') return;

      const path = part === 'travel' ? '/metravel' : '/' + parts.slice(0, index + 1).join('/');
      const label = toTitleFromSegment(part);
      computed.push({ label, path });
    });

    const isTravelDetails = p.startsWith('/travels/') && !!travelData?.name;
    if (isTravelDetails && computed.length > 0) {
      const lastIdx = computed.length - 1;
      computed[lastIdx] = {
        ...computed[lastIdx],
        label: truncateLabel(String(travelData?.name || computed[lastIdx].label)),
      };
    }

    if (computed.length === 0) {
      const pageContextTitle = getRootTitle('/');
      return {
        items: [],
        depth: 1,
        currentTitle: pageContextTitle,
        pageContextTitle,
        backToPath: null,
        showBreadcrumbs: false,
      };
    }

    const currentTitle = computed[computed.length - 1].label;
    const backToPath = computed.length >= 2 ? computed[computed.length - 2].path : '/';

    const rootContext = HEADER_NAV_ITEMS.find((i) => i.path === '/' + (parts[0] || ''));
    const pageContextTitle = rootContext?.label || getRootTitle('/');

    return {
      items: computed,
      depth: computed.length + 1,
      currentTitle,
      pageContextTitle,
      backToPath,
      showBreadcrumbs: computed.length >= 1,
    };
  }, [resolvedPathname, normalizedReturnToParam, travelData?.name, travelSlug, questApiTitle, userProfileName]);
}
