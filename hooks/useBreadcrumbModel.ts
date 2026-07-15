import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useGlobalSearchParams, useLocalSearchParams, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { Article, Travel } from '@/types/types';
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';
import { extractArticleIdFromParam, fetchArticle, fetchArticleBySlug } from '@/api/articles';
import { consumePreloadedTravel } from '@/hooks/useTravelDetails';
import { fetchQuestByQuestId, type ApiQuestBundle } from '@/api/quests';
import { fetchUserProfile, resolveProfileFullName, type UserProfileDto } from '@/api/user';
import { fetchPlannedTrip, type PlannedTrip } from '@/api/plannedTrips';
import { fetchPublicTrip, type PublicTrip } from '@/api/publicTrips';
import { queryKeys } from '@/queryKeys';
import { translate as i18nT } from '@/i18n'


type SearchParamsWithReturnTo = { returnTo?: string | string[] };

const readGlobalSearchParams =
  typeof useGlobalSearchParams === 'function'
    ? useGlobalSearchParams
    : (<T extends SearchParamsWithReturnTo>() => ({} as T));

const readLocalSearchParams =
  typeof useLocalSearchParams === 'function'
    ? useLocalSearchParams
    : (<T extends SearchParamsWithReturnTo>() => ({} as T));

function useGlobalSearchParamsSafe(): SearchParamsWithReturnTo {
  return readGlobalSearchParams<SearchParamsWithReturnTo>() ?? {};
}

function useLocalSearchParamsSafe(): SearchParamsWithReturnTo {
  return readLocalSearchParams<SearchParamsWithReturnTo>() ?? {};
}

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
  get travelsby() { return i18nT('navigationStatic:breadcrumb.travelsby') },
  get map() { return i18nT('navigationStatic:breadcrumb.map') },
  get quests() { return i18nT('navigationStatic:breadcrumb.quests') },
  get roulette() { return i18nT('navigationStatic:breadcrumb.roulette') },
  get article() { return i18nT('navigationStatic:breadcrumb.article') },
  get travel() { return i18nT('navigationStatic:breadcrumb.travel') },
  get profile() { return i18nT('navigationStatic:breadcrumb.profile') },
  get login() { return i18nT('navigationStatic:breadcrumb.login') },
  get registration() { return i18nT('navigationStatic:breadcrumb.registration') },
  get metravel() { return i18nT('navigationStatic:breadcrumb.metravel') },
  get about() { return i18nT('navigationStatic:breadcrumb.about') },
  get export() { return i18nT('navigationStatic:breadcrumb.export') },
  get settings() { return i18nT('navigationStatic:breadcrumb.settings') },
  get history() { return i18nT('navigationStatic:breadcrumb.history') },
  get favorites() { return i18nT('navigationStatic:breadcrumb.favorites') },
  get accountconfirmation() { return i18nT('navigationStatic:breadcrumb.accountconfirmation') },
  get 'set-password'() { return i18nT('navigationStatic:breadcrumb.setPassword') },
  get new() { return i18nT('navigationStatic:breadcrumb.newTravel') },
  get userpoints() { return i18nT('navigationStatic:breadcrumb.userpoints') },
  get messages() { return i18nT('navigationStatic:breadcrumb.messages') },
  get subscriptions() { return i18nT('navigationStatic:breadcrumb.subscriptions') },
  get contact() { return i18nT('navigationStatic:breadcrumb.contact') },
  get places() { return i18nT('navigationStatic:breadcrumb.places') },
  get articles() { return i18nT('navigationStatic:breadcrumb.articles') },
  get calendar() { return i18nT('navigationStatic:breadcrumb.calendar') },
  get search() { return i18nT('navigationStatic:breadcrumb.search') },
  get cookies() { return i18nT('navigationStatic:breadcrumb.cookies') },
  get privacy() { return i18nT('navigationStatic:breadcrumb.privacy') },
  get register() { return i18nT('navigationStatic:breadcrumb.register') },
  get terms() { return i18nT('navigationStatic:breadcrumb.terms') },
  get disclaimer() { return i18nT('navigationStatic:breadcrumb.disclaimer') },
  get 'community-rules'() { return i18nT('navigationStatic:breadcrumb.communityRules') },
  get 'trip-rules'() { return i18nT('navigationStatic:breadcrumb.tripRules') },
  get 'security-journal'() { return i18nT('navigationStatic:breadcrumb.securityJournal') },
  get 'privacy-settings'() { return i18nT('navigationStatic:breadcrumb.privacySettings') },
  get trips() { return i18nT('navigationStatic:breadcrumb.trips') },
  get plan() { return i18nT('navigationStatic:breadcrumb.plan') },
  get create() { return i18nT('navigationStatic:breadcrumb.create') },
  get app() { return i18nT('navigationStatic:breadcrumb.app') },
};

const PROFILE_CRUMB: BreadcrumbModelItem = { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.profil_6d96d80b') }, path: '/profile' };
const SETTINGS_CRUMB: BreadcrumbModelItem = { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.nastroyki_ef971c38') }, path: '/settings' };

// Одноуровневые страницы личного кабинета БЕЗ собственной шапки — крошки строятся
// через «Профиль» (при необходимости — ещё и через «Настройки»).
// Экраны с собственной шапкой (ProfileCollectionHeader): /favorites, /history,
// /calendar — здесь НЕ перечислены, чтобы не было двойной шапки
// (их бар подавляется в customHeaderModel.TOP_LEVEL_PATHS_NO_CONTEXT_BAR).
// /userpoints свою шапку убрал — крошки «Профиль › Мои точки» показывает бар.
const CABINET_ROUTE_CRUMBS: Record<string, BreadcrumbModelItem[]> = {
  '/profile': [PROFILE_CRUMB],
  '/userpoints': [PROFILE_CRUMB, { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.moi_tochki_c4f7a9e4') }, path: '/userpoints' }],
  '/settings': [PROFILE_CRUMB, SETTINGS_CRUMB],
  '/messages': [PROFILE_CRUMB, { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.soobscheniya_3dee5716') }, path: '/messages' }],
  '/subscriptions': [PROFILE_CRUMB, { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.podpiski_81e9f04b') }, path: '/subscriptions' }],
  '/export': [PROFILE_CRUMB, { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.eksport_33d30a64') }, path: '/export' }],
  '/security-journal': [
    PROFILE_CRUMB,
    SETTINGS_CRUMB,
    { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.zhurnal_bezopasnosti_c75b6d48') }, path: '/security-journal' },
  ],
  '/privacy-settings': [
    PROFILE_CRUMB,
    SETTINGS_CRUMB,
    { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.nastroyki_privatnosti_b8161b9e') }, path: '/privacy-settings' },
  ],
};

// Информационные/правовые одноуровневые страницы — одна крошка под «Главная».
const INFO_ROUTES = new Set<string>([
  '/app',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/cookies',
  '/disclaimer',
  '/community-rules',
  '/trip-rules',
]);

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
  const cleanedSegment = String(segment ?? '').split('?')[0].split('#')[0];
  const translated = pageTranslations[cleanedSegment];
  const base = translated
    ? translated
    : cleanedSegment
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
  return i18nT('shared:hooks.useBreadcrumbModel.puteshestviya_7be089c0');
}

function isBelarusCountryName(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized.includes('беларус') || normalized.includes('belarus');
}

function getTravelReturnContext(normalizedReturnTo: string, travelData: Travel | null | undefined) {
  if (normalizedReturnTo === '/travelsby' && travelData?.countryName && !isBelarusCountryName(travelData.countryName)) {
    return {
      label: truncateLabel(travelData.countryName),
      path: '/search',
    };
  }

  const rootContext = HEADER_NAV_ITEMS.find((i) => i.path === normalizedReturnTo);
  return {
    label: rootContext?.label || toTitleFromSegment(normalizedReturnTo.replace(/^\//, '')),
    path: normalizedReturnTo,
  };
}

export function useBreadcrumbModel(): BreadcrumbModel {
  const pathname = usePathname();
  const resolvedPathname = getResolvedPathname(pathname);
  // expo-router mocks in unit tests often provide only useLocalSearchParams.
  // Prefer global search params when available; otherwise fall back to local params.
  const globalParams = useGlobalSearchParamsSafe();
  const localParams = useLocalSearchParamsSafe();
  const returnTo = globalParams.returnTo ?? localParams.returnTo;

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

  const initialTravelData = useMemo(() => {
    if (!travelSlug) return undefined;
    const idNum = Number(travelSlug);
    const isId = Number.isFinite(idNum) && idNum > 0;
    return consumePreloadedTravel(travelSlug, isId, idNum, { consume: false });
  }, [travelSlug]);

  const { data: travelData } = useQuery<Travel | null>({
    queryKey: travelCacheKey != null ? queryKeys.travel(travelCacheKey) : queryKeys.travel('missing'),
    queryFn: ({ signal }) => {
      if (!travelSlug) return null;
      const idNum = Number(travelSlug);
      const isId = !Number.isNaN(idNum);
      return isId ? fetchTravel(idNum, { signal }) : fetchTravelBySlug(travelSlug, { signal });
    },
    enabled: travelCacheKey != null,
    initialData: initialTravelData,
    initialDataUpdatedAt: initialTravelData ? Date.now() : undefined,
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

  const { data: questApiData } = useQuery<ApiQuestBundle | null>({
    queryKey: queryKeys.questBundle(questSlugForBreadcrumb),
    queryFn: () => questSlugForBreadcrumb ? fetchQuestByQuestId(questSlugForBreadcrumb) : null,
    enabled: !!questSlugForBreadcrumb,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });
  const questApiTitle = questApiData?.title || '';

  // Article title from API (for header/breadcrumbs on /article/[id] pages — F-19)
  const articleParamForBreadcrumb = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/article/')) return null;
    const parts = p.split('/').filter(Boolean);
    return parts.length >= 2 ? normalizeSlugPart(parts[1]) : null;
  }, [resolvedPathname]);

  const articleIdForBreadcrumb = useMemo(
    () => (articleParamForBreadcrumb ? extractArticleIdFromParam(articleParamForBreadcrumb) : null),
    [articleParamForBreadcrumb],
  );

  const { data: articleData } = useQuery<Article | null>({
    queryKey: queryKeys.article(articleIdForBreadcrumb ?? articleParamForBreadcrumb ?? undefined),
    queryFn: ({ signal }) => {
      if (!articleParamForBreadcrumb) return null;
      return articleIdForBreadcrumb
        ? fetchArticle(articleIdForBreadcrumb, { signal })
        : fetchArticleBySlug(articleParamForBreadcrumb, { signal });
    },
    enabled: !!articleParamForBreadcrumb,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });
  const articleTitle = articleData?.name ? truncateLabel(String(articleData.name)) : '';

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

  const { data: userProfileData } = useQuery<UserProfileDto | null>({
    queryKey: queryKeys.userProfile(userIdForBreadcrumb),
    queryFn: () => userIdForBreadcrumb ? fetchUserProfile(userIdForBreadcrumb) : null,
    enabled: !!userIdForBreadcrumb,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });
  const userProfileName = useMemo(() => {
    return resolveProfileFullName(userProfileData);
  }, [userProfileData]);

  const plannedTripIdForBreadcrumb = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/trips/plan/')) return null;
    const parts = p.split('/').filter(Boolean);
    if (parts.length < 3 || parts[0] !== 'trips' || parts[1] !== 'plan') return null;
    const n = Number(parts[2]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [resolvedPathname]);

  const { data: plannedTripData } = useQuery<PlannedTrip | null>({
    queryKey: queryKeys.plannedTrip(plannedTripIdForBreadcrumb),
    queryFn: () => plannedTripIdForBreadcrumb ? fetchPlannedTrip(plannedTripIdForBreadcrumb) : null,
    enabled: plannedTripIdForBreadcrumb != null,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });

  const publicTripIdForBreadcrumb = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/trips/')) return null;
    const parts = p.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'trips' || parts[1] === 'plan') return null;
    const n = Number(parts[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [resolvedPathname]);

  const { data: publicTripData } = useQuery<PublicTrip | null>({
    queryKey: queryKeys.publicTrip(publicTripIdForBreadcrumb),
    queryFn: () => publicTripIdForBreadcrumb ? fetchPublicTrip(publicTripIdForBreadcrumb) : null,
    enabled: publicTripIdForBreadcrumb != null,
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

      // Личный кабинет: вложенность через «Профиль» (при необходимости — «Настройки»).
      const cabinetCrumbs = CABINET_ROUTE_CRUMBS[p];
      if (cabinetCrumbs) {
        const currentLabel = cabinetCrumbs[cabinetCrumbs.length - 1]?.label || pageContextTitle;
        const backToPath = cabinetCrumbs.length >= 2 ? cabinetCrumbs[cabinetCrumbs.length - 2].path : '/';

        return {
          items: cabinetCrumbs,
          depth: cabinetCrumbs.length + 1,
          currentTitle: currentLabel,
          pageContextTitle: cabinetCrumbs.length >= 2 ? cabinetCrumbs[0].label : getRootTitle('/'),
          backToPath,
          showBreadcrumbs: true,
        };
      }

      // Информационные/правовые страницы: одна крошка под «Главная».
      if (INFO_ROUTES.has(p)) {
        const items: BreadcrumbModelItem[] = [{ label: pageContextTitle, path: p }];
        return {
          items,
          depth: items.length + 1,
          currentTitle: pageContextTitle,
          pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.glavnaya_6804642b'),
          backToPath: '/',
          showBreadcrumbs: true,
        };
      }

      // По умолчанию одноуровневые страницы (топ-навигация) не показывают breadcrumbs.
      return {
        items: [],
        depth: 1,
        currentTitle: pageContextTitle,
        pageContextTitle,
        backToPath: '/',
        showBreadcrumbs: false,
      };
    }

    const isTravelDetailsWithReturn =
      p.startsWith('/travels/') && typeof normalizedReturnToParam === 'string' && !!normalizedReturnToParam.trim();
    if (isTravelDetailsWithReturn) {
      const normalizedReturnTo = normalizedReturnToParam.startsWith('/')
        ? normalizedReturnToParam
        : `/${normalizedReturnToParam}`;
      const returnContext = getTravelReturnContext(normalizedReturnTo, travelData);

      if (travelSlug && !travelData?.name) {
        return {
          items: [],
          depth: 1,
          currentTitle: returnContext.label,
          pageContextTitle: returnContext.label,
          backToPath: returnContext.path,
          showBreadcrumbs: false,
        };
      }
      const travelTitle = truncateLabel(String(travelData?.name || toTitleFromSegment(parts[parts.length - 1] || '')));

      const items: BreadcrumbModelItem[] = [
        { label: returnContext.label, path: returnContext.path },
        { label: travelTitle, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: travelTitle,
        pageContextTitle: returnContext.label,
        backToPath: returnContext.path,
        showBreadcrumbs: true,
      };
    }

    const isUserProfile = p.startsWith('/user/') && parts.length >= 2 && parts[0] === 'user';
    if (isUserProfile) {
      const userName = userProfileName || i18nT('sharedStatic:breadcrumb.profileFallback');
      const userTitle = truncateLabel(userName);

      const items: BreadcrumbModelItem[] = [
        { label: userTitle, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: userTitle,
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.glavnaya_6804642b'),
        backToPath: '/',
        showBreadcrumbs: true,
      };
    }

    const isArticleDetails = parts[0] === 'article' && parts.length >= 2;
    if (isArticleDetails) {
      const currentLabel = articleTitle || i18nT('sharedStatic:breadcrumb.articleFallback');
      const items: BreadcrumbModelItem[] = [
        { label: i18nT('shared:hooks.useBreadcrumbModel.stati_ffeec651'), path: '/articles' },
        { label: currentLabel, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: currentLabel,
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.stati_ffeec651'),
        backToPath: '/articles',
        showBreadcrumbs: true,
      };
    }

    const isPlannedTripDetails =
      parts[0] === 'trips' && parts[1] === 'plan' && parts.length >= 3 && parts[2] !== 'create';
    if (isPlannedTripDetails) {
      const currentLabel = truncateLabel(plannedTripData?.title || i18nT('sharedStatic:breadcrumb.tripFallback'));
      const items: BreadcrumbModelItem[] = [
        PROFILE_CRUMB,
        { label: i18nT('shared:hooks.useBreadcrumbModel.moi_poezdki_39aebae0'), path: '/trips/my' },
        { label: currentLabel, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: currentLabel,
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.profil_6d96d80b'),
        backToPath: '/trips/my',
        showBreadcrumbs: true,
      };
    }

    const isPublicTripDetails =
      parts[0] === 'trips' && parts.length >= 2 && Number.isFinite(Number(parts[1]));
    if (isPublicTripDetails) {
      const currentLabel = truncateLabel(publicTripData?.title || i18nT('sharedStatic:breadcrumb.tripFallback'));
      const items: BreadcrumbModelItem[] = [
        { label: i18nT('shared:hooks.useBreadcrumbModel.poezdki_e2cdc063'), path: '/trips' },
        { label: currentLabel, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: currentLabel,
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.poezdki_e2cdc063'),
        backToPath: '/trips',
        showBreadcrumbs: true,
      };
    }

    if (p === '/trips/my') {
      const items: BreadcrumbModelItem[] = [
        { label: i18nT('shared:hooks.useBreadcrumbModel.poezdki_e2cdc063'), path: '/trips' },
        { label: i18nT('shared:hooks.useBreadcrumbModel.moi_poezdki_39aebae0'), path: '/trips/my' },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: i18nT('shared:hooks.useBreadcrumbModel.moi_poezdki_39aebae0'),
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.poezdki_e2cdc063'),
        backToPath: '/trips',
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
        { label: i18nT('shared:hooks.useBreadcrumbModel.kvesty_91edef10'), path: '/quests' },
        { label: questTitle, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: questTitle,
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.kvesty_91edef10'),
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
  }, [resolvedPathname, normalizedReturnToParam, travelData, travelSlug, questApiTitle, userProfileName, articleTitle, plannedTripData, publicTripData]);
}

export default useBreadcrumbModel;
