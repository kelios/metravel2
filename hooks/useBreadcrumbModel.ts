import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { useGlobalSearchParams, useLocalSearchParams, usePathname } from 'expo-router';
import { hashKey, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Article, Travel } from '@/types/types';
import { HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { hasListFilterQuery, needsGlobalBackAffordance } from '@/components/layout/topLevelSections';
import { extractArticleIdFromParam, fetchArticle, fetchArticleBySlug } from '@/api/articles';
import { consumePreloadedTravel } from '@/hooks/useTravelDetails';
// #1552: крошки живут в шапке КАЖДОГО маршрута, поэтому статический импорт
// их route-специфичных фетчеров держал в стартовом графе всего сайта слои
// квестов и поездок. На travel-детали покрытие прода показывало `__shared-7`
// (145 КБ, слой поездок + xmldom/GPX) как использованный на 0%.
// Фетчер нужен только внутри `queryFn`, а он выполняется лишь при `enabled`,
// поэтому `await import(...)` — настоящая async-граница, а не условный require.
import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests';
import { questsListQueryOptions } from '@/hooks/questsListQuery';
import { resolveQuestCitySegment } from '@/utils/questCityAlias';
import { resolveQuestCountryAlias } from '@/utils/questCountryLanding';
import { fetchUserProfile, resolveProfileFullName, type UserProfileDto } from '@/api/user';
import type { PlannedTrip } from '@/api/plannedTrips';
import type { PublicTrip } from '@/api/publicTrips';
import { queryKeys } from '@/queryKeys';
import { normalizeTravelRouteSegment } from '@/utils/travelRouteSegment';
import { getActiveLocale, translate as i18nT } from '@/i18n'


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
  get offline() { return i18nT('offline:title') },
};

const PROFILE_CRUMB: BreadcrumbModelItem = { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.profil_6d96d80b') }, path: '/profile' };
const SETTINGS_CRUMB: BreadcrumbModelItem = { get label() { return i18nT('sharedStatic:hooks.useBreadcrumbModel.nastroyki_ef971c38') }, path: '/settings' };

// Одноуровневые страницы личного кабинета БЕЗ собственной шапки — крошки строятся
// через «Профиль» (при необходимости — ещё и через «Настройки»).
// Экраны с собственной шапкой (ProfileCollectionHeader): /favorites, /history,
// /calendar — здесь НЕ перечислены, чтобы не было двойной шапки
// (их бар подавляется через SELF_HEADED_COLLECTION_PATHS в
// components/layout/topLevelSections.ts).
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

/**
 * #1801: подписка на кэш travel-деталей БЕЗ создания наблюдателя запроса.
 *
 * `useQuery` на чужом ключе — это не только чтение: наблюдатель пишет свои
 * опции в сам запрос и может первым запустить загрузку. Крошкам достаточно
 * значения, поэтому подписка идёт напрямую на кэш.
 */
function useCachedTravelData(cacheKey: number | string | null): Travel | undefined {
  const queryClient = useQueryClient();
  const queryHash = useMemo(
    () => (cacheKey != null ? hashKey(queryKeys.travel(cacheKey)) : null),
    [cacheKey],
  );
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (queryHash == null) return () => {};
      return queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === queryHash) onStoreChange();
      });
    },
    [queryClient, queryHash],
  );
  const getSnapshot = useCallback(
    () => (queryHash == null
      ? undefined
      : queryClient.getQueryCache().get<Travel>(queryHash)?.state.data),
    [queryClient, queryHash],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useBreadcrumbModel(): BreadcrumbModel {
  const pathname = usePathname();
  const resolvedPathname = getResolvedPathname(pathname);
  // expo-router mocks in unit tests often provide only useLocalSearchParams.
  // Prefer global search params when available; otherwise fall back to local params.
  const globalParams = useGlobalSearchParamsSafe();
  const localParams = useLocalSearchParamsSafe();
  const returnTo = globalParams.returnTo ?? localParams.returnTo;

  // #1725: `/search?categoryTravelAddress=33,43` — это подборка, открытая
  // переходом, а не раздел «Маршруты»: ей нужна крошка «Главная › Маршруты».
  const hasFilterQuery = hasListFilterQuery(globalParams as Record<string, unknown>)
    || hasListFilterQuery(localParams as Record<string, unknown>);

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
    // #1801: ключ обязан совпасть с ключом владельца — экрана деталей, поэтому
    // сегмент считается тем же хелпером, включая однократное декодирование.
    return raw ? (normalizeTravelRouteSegment(raw) || null) : null;
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

  // #1801: ключом `travel:<id|slug>` владеет экран деталей — он один умеет
  // читать локальный офлайн-пакет (`networkMode: 'always'` + офлайн-ветка в
  // `queryFn`). Крошки держали на ТОМ ЖЕ ключе второго наблюдателя со своим
  // сетевым `queryFn` и дефолтным `networkMode: 'online'`. Шапка монтируется
  // раньше содержимого маршрута, поэтому офлайн-переход стартовал загрузку
  // именно её опциями: query-core парковал retryer в `fetchStatus: 'paused'`,
  // а `queryFn` экрана деталей после этого не исполнялся уже никогда — страница
  // висела на skeleton до возврата сети.
  //
  // Крошкам данные нужны только ради подписи, поэтому здесь остаётся ЧТЕНИЕ
  // кэша без собственного наблюдателя: своих опций у ключа больше нет, а
  // заголовок появляется ровно тогда, когда экран деталей положил данные.
  const cachedTravel = useCachedTravelData(travelCacheKey);
  const travelData = cachedTravel ?? initialTravelData ?? null;

  // Quest title from API (for breadcrumbs on quest detail pages)
  const questSlugForBreadcrumb = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/quests/')) return null;
    const parts = p.split('/').filter(Boolean);
    return parts.length >= 3 && parts[1] !== 'country' ? parts[2] : null;
  }, [resolvedPathname]);

  const { data: questApiData } = useQuery<ApiQuestBundle | null>({
    queryKey: queryKeys.questBundle(questSlugForBreadcrumb),
    queryFn: async () => {
      if (!questSlugForBreadcrumb) return null;
      const { fetchQuestByQuestId } = await import('@/api/quests');
      return fetchQuestByQuestId(questSlugForBreadcrumb);
    },
    enabled: !!questSlugForBreadcrumb,
    staleTime: 600_000,
    gcTime: 10 * 60 * 1000,
  });
  const questApiTitle = questApiData?.title || '';

  // City landing /quests/<cityId|alias>: the crumb must show the localized city
  // name («Минск»), not the titleized URL segment («Minsk»). Shares the quests
  // list query with the screen itself, so this costs no extra request.
  const questCitySegment = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/quests/')) return null;
    const parts = p.split('/').filter(Boolean);
    return parts.length === 2 ? parts[1] : null;
  }, [resolvedPathname]);

  const questCountryAlias = useMemo(() => {
    const p = resolvedPathname;
    if (!p || !p.startsWith('/quests/country/')) return null;
    const parts = p.split('/').filter(Boolean);
    return parts.length === 3 ? parts[2] : null;
  }, [resolvedPathname]);

  // #1393: крошка читает СЫРОЙ ответ `/quests/`, а не адаптированный список из
  // `useQuestsList`. Крошки живут в шапке каждого маршрута, поэтому импорт
  // `useQuestsApi` тянул в стартовый граф всего сайта `utils/questAdapters` →
  // `utils/geoCountry` → таблицу контуров стран (47 КБ raw) — ради двух полей,
  // `city_id` и `city_name`, которые есть в ответе как есть.
  //
  // Ключ, queryFn и времена кеша совпадают с `useQuestsList`, поэтому экран
  // квестов и крошка по-прежнему дедуплицируются в один запрос `/quests/`.
  const { data: questsForLocationCrumb } = useQuery<ApiQuestMeta[]>({
    ...questsListQueryOptions(),
    enabled: !!questCitySegment || !!questCountryAlias,
  });

  const questCityName = useMemo(() => {
    if (!questCitySegment) return '';
    const quests = questsForLocationCrumb ?? [];
    // `resolveQuestCitySegment` читает `city_id ?? cityId`, поэтому сырой список
    // ему подходит так же, как адаптированный.
    const resolved = resolveQuestCitySegment(questCitySegment, quests);
    if (!resolved) return '';
    return quests.find((q) => String(q.city_id) === resolved.cityId)?.city_name || '';
  }, [questCitySegment, questsForLocationCrumb]);

  const activeLocale = getActiveLocale();
  const questCountryName = useMemo(() => {
    if (!questCountryAlias) return '';
    return resolveQuestCountryAlias(questCountryAlias, questsForLocationCrumb ?? [], {
      locale: activeLocale,
    })?.countryName || '';
  }, [activeLocale, questCountryAlias, questsForLocationCrumb]);

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
    queryFn: async () => {
      if (plannedTripIdForBreadcrumb == null) return null;
      const { fetchPlannedTrip } = await import('@/api/plannedTrips');
      return fetchPlannedTrip(plannedTripIdForBreadcrumb);
    },
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
    queryFn: async () => {
      if (publicTripIdForBreadcrumb == null) return null;
      const { fetchPublicTrip } = await import('@/api/publicTrips');
      return fetchPublicTrip(publicTripIdForBreadcrumb);
    },
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

      // Одна крошка под «Главная» — информационным/правовым страницам и любому
      // одноуровневому экрану, которого нет в навигации: попасть туда можно
      // только переходом, значит вернуться должно быть куда (#1725). Кабинетные
      // коллекции со своей шапкой сюда не попадают — у них свой «Назад».
      if (INFO_ROUTES.has(p) || needsGlobalBackAffordance(p, hasFilterQuery)) {
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

      // Разделы навигации без параметров крошек не показывают: их идентичность
      // уже несут меню и нижний док.
      return {
        items: [],
        depth: 1,
        currentTitle: pageContextTitle,
        pageContextTitle,
        backToPath: '/',
        showBreadcrumbs: false,
      };
    }

    const isTravelUpsert = parts[0] === 'travel' && parts.length === 2;
    if (isTravelUpsert) {
      const currentLabel = parts[1] === 'new'
        ? pageTranslations.new
        : i18nT('travel:components.travel.UpsertTravel.redaktirovat_puteshestvie_de5a1d0f');
      const items: BreadcrumbModelItem[] = [
        { label: pageTranslations.travel, path: '/metravel' },
        { label: currentLabel, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: currentLabel,
        pageContextTitle: pageTranslations.travel,
        backToPath: '/metravel',
        showBreadcrumbs: true,
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

    // Static /quests/<segment> landings that are not cities — without this the
    // city branch below titleizes the raw segment into «Scenario».
    if (p === '/quests/scenario') {
      const label = truncateLabel(i18nT('quests:screens.tabs.QuestScenarioScreen.breadcrumb'));
      const items = [
        { label: i18nT('shared:hooks.useBreadcrumbModel.kvesty_91edef10'), path: '/quests' },
        { label, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: label,
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.kvesty_91edef10'),
        backToPath: '/quests',
        showBreadcrumbs: true,
      };
    }

    const isQuestCountryLanding =
      parts[0] === 'quests' && parts[1] === 'country' && parts.length === 3;
    if (isQuestCountryLanding) {
      const countryLabel = truncateLabel(questCountryName || toTitleFromSegment(parts[2]));
      const items = [
        { label: i18nT('shared:hooks.useBreadcrumbModel.kvesty_91edef10'), path: '/quests' },
        { label: countryLabel, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: countryLabel,
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.kvesty_91edef10'),
        backToPath: '/quests',
        showBreadcrumbs: true,
      };
    }

    const isQuestCityLanding = p.startsWith('/quests/') && parts.length === 2;
    if (isQuestCityLanding) {
      const cityLabel = truncateLabel(questCityName || toTitleFromSegment(parts[1]));
      const items = [
        { label: i18nT('shared:hooks.useBreadcrumbModel.kvesty_91edef10'), path: '/quests' },
        { label: cityLabel, path: p },
      ];

      return {
        items,
        depth: items.length + 1,
        currentTitle: cityLabel,
        pageContextTitle: i18nT('shared:hooks.useBreadcrumbModel.kvesty_91edef10'),
        backToPath: '/quests',
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

    // Заголовок статьи в шапке — только реальное название. Пока данных нет
    // (загрузка) или путешествие не найдено, слаг-сегмент показывать нельзя:
    // на 404-ветке в шапке оставалась транслитерация вида «Gde Kupatsia Pod...».
    const isTravelDetails = p.startsWith('/travels/');
    if (isTravelDetails && computed.length > 0) {
      const lastIdx = computed.length - 1;
      computed[lastIdx] = {
        ...computed[lastIdx],
        label: travelData?.name
          ? truncateLabel(String(travelData.name))
          : i18nT('sharedStatic:breadcrumb.travelFallback'),
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
  }, [resolvedPathname, hasFilterQuery, normalizedReturnToParam, travelData, travelSlug, questApiTitle, questCityName, questCountryName, userProfileName, articleTitle, plannedTripData, publicTripData]);
}

export default useBreadcrumbModel;
