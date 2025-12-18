import { useMemo } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getQuestById } from '@/components/quests/registry';
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { fetchTravel, fetchTravelBySlug } from '@/src/api/travelsApi';

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
};

function normalizePathname(pathname: string | null | undefined) {
  if (!pathname) return '/';
  if (pathname === '/index') return '/';
  return pathname;
}

function getResolvedPathname(pathname: string | null | undefined) {
  const normalized = normalizePathname(pathname);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return normalizePathname(window.location.pathname || normalized);
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
  return root?.label || 'Путешествия';
}

export function useBreadcrumbModel(): BreadcrumbModel {
  const pathname = usePathname();
  const resolvedPathname = getResolvedPathname(pathname);

  const travelSlug = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/travels/')) return null;
    const parts = p.split('/').filter(Boolean);
    const idx = parts.indexOf('travels');
    return idx >= 0 && parts[idx + 1] ? String(parts[idx + 1]) : null;
  }, [resolvedPathname]);

  const { data: travelData } = useQuery({
    queryKey: ['travel', travelSlug],
    queryFn: () => {
      if (!travelSlug) return null;
      const idNum = Number(travelSlug);
      const isId = !Number.isNaN(idNum);
      return isId ? fetchTravel(idNum) : fetchTravelBySlug(travelSlug);
    },
    enabled: !!travelSlug,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });

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

    const isQuestDetails = p.startsWith('/quests/') && parts.length >= 3;
    if (isQuestDetails) {
      const questSlug = parts[2];
      const questBundle = getQuestById(questSlug);
      let questTitle = questBundle?.title || toTitleFromSegment(questSlug);
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
  }, [resolvedPathname, travelData?.name]);
}
