// api/achievements.ts
// Слой системы достижений (значки + ранг XP). Контракт зеркалит
// docs/ACHIEVEMENTS_DESIGN.md (§5). Пока бэкенд (BE-A4) не готов, fetch-функции
// отдают моки под флагом EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true (или при 404 в DEV).

import { apiClient, ApiError } from '@/api/client';
import { devWarn } from '@/utils/logger';
import {
  MOCK_BADGES,
  MOCK_MY_ACHIEVEMENTS,
  MOCK_PUBLIC_ACHIEVEMENTS,
  MOCK_PEER_CATALOG,
  MOCK_TRAVEL_PEER_RECEIVED,
  MOCK_RARE_AWARDS,
  MOCK_RARE_AWARD_CATALOG,
} from '@/api/achievementsMock';

// ── Доменные типы (camelCase) ──────────────────────────────────────────────

export type BadgeTier =
  | 'none'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'legendary';

export interface Badge {
  id: number;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  tier: BadgeTier;
  /** URL картинки значка в S3. null до готовности DES-A1 — рисуем процедурную медаль. */
  imageUrl: string | null;
  points: number;
  isSecret: boolean;
  order: number;
}

export interface UserBadge {
  badge: Badge;
  earnedAt: string;
}

export interface BadgeProgress {
  badge: Badge;
  current: number;
  threshold: number;
}

export interface UserRank {
  level: number;
  title: string;
  totalPoints: number;
  badgesCount: number;
  currentLevelMinPoints: number;
  nextLevelMinPoints: number | null;
  nextLevelTitle: string | null;
  /** true — достигнут максимальный уровень; false при null-порогах = пороги неизвестны
   * (публичный эндпоинт не отдаёт rank_levels). */
  isMaxLevel: boolean;
}

export interface MyAchievements {
  rank: UserRank;
  earned: UserBadge[];
  locked: BadgeProgress[];
  recentlyEarned: UserBadge[];
}

export interface PublicAchievements {
  rank: UserRank;
  earned: UserBadge[];
  peerReceived: PeerBadgeReceived[];
}

// ── Peer-awarded badges (награды от сообщества, §10) ─────────────────────────

export type PeerBadgeTarget = 'user' | 'travel';

export interface PeerBadge extends Badge {
  target: PeerBadgeTarget;
}

export interface PeerBadgeReceived {
  badge: PeerBadge;
  count: number;
  /** Выдал ли текущий зритель этот значок. */
  grantedByMe: boolean;
}

export interface GrantResult {
  granted: boolean;
  count: number;
}

export interface GrantInput {
  badgeSlug: string;
  recipientId?: string | number;
  travelId?: string | number;
}

// ── Сырые DTO бэкенда (snake_case DRF) ──────────────────────────────────────

interface BadgeCategoryDto {
  id?: number;
  slug?: string | null;
  name?: string | null;
  order?: number | null;
  icon?: string | null;
}

interface BadgeDto {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  category?: BadgeCategoryDto | null;
  tier?: string | null;
  image_url?: string | null;
  image_status?: string | null;
  points?: number | null;
  is_secret?: boolean | null;
  order?: number | null;
}

interface UserBadgeDto {
  badge: BadgeDto;
  earned_at: string;
}

interface BadgeProgressDto {
  badge: BadgeDto;
  current?: number | null;
  threshold?: number | null;
}

interface RankSummaryDto {
  level?: number | null;
  title?: string | null;
  total_points?: number | null;
  badges_count?: number | null;
  recomputed_at?: string | null;
}

interface RankLevelDto {
  level: number;
  title: string;
  min_points: number;
}

interface MyAchievementsDto {
  rank: RankSummaryDto;
  rank_levels?: RankLevelDto[];
  earned_badges: UserBadgeDto[];
  progress: BadgeProgressDto[];
  recently_earned?: UserBadgeDto[];
}

interface PublicAchievementsDto {
  rank: RankSummaryDto;
  earned_badges: UserBadgeDto[];
  peer_received?: PeerBadgeReceivedDto[];
}

interface PeerBadgeDto extends BadgeDto {
  target?: string | null;
}

interface PeerBadgeReceivedDto {
  badge: PeerBadgeDto;
  count?: number | null;
  granted_by_me?: boolean | null;
}

interface TravelPeerBadgesDto {
  peer_received?: PeerBadgeReceivedDto[];
}

interface GrantResponseDto {
  granted?: boolean | null;
  count?: number | null;
}

// ── Мапперы DTO → домен ─────────────────────────────────────────────────────

const TIERS: readonly BadgeTier[] = [
  'none',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'legendary',
];

const normalizeTier = (raw: string | null | undefined): BadgeTier =>
  TIERS.includes(raw as BadgeTier) ? (raw as BadgeTier) : 'none';

const mapBadge = (dto: BadgeDto): Badge => ({
  id: dto.id,
  slug: dto.slug,
  name: dto.name,
  description: dto.description ?? '',
  categorySlug: dto.category?.slug ?? 'other',
  categoryName: dto.category?.name ?? 'Достижения',
  tier: normalizeTier(dto.tier),
  // Бэк отдаёт '' когда картинки нет — нормализуем в null (BadgeMedal рисует фолбэк).
  imageUrl: dto.image_url ? dto.image_url : null,
  points: dto.points ?? 0,
  isSecret: Boolean(dto.is_secret),
  order: dto.order ?? dto.id,
});

const mapUserBadge = (dto: UserBadgeDto): UserBadge => ({
  badge: mapBadge(dto.badge),
  earnedAt: dto.earned_at,
});

const mapProgress = (dto: BadgeProgressDto): BadgeProgress => ({
  badge: mapBadge(dto.badge),
  current: dto.current ?? 0,
  threshold: dto.threshold ?? 0,
});

// Бэк отдаёт rank БЕЗ порогов уровней (level/title/total_points/badges_count) +
// отдельный список rank_levels (только в /me/). Пороги к текущему/следующему уровню
// и флаг максимума вычисляем здесь. Без rank_levels (публичный эндпоинт) пороги
// остаются null, isMaxLevel=false — RankBar показывает уровень без XP-полосы.
const mapRank = (dto: RankSummaryDto, levels?: RankLevelDto[]): UserRank => {
  const totalPoints = dto.total_points ?? 0;
  let currentLevelMinPoints = 0;
  let nextLevelMinPoints: number | null = null;
  let nextLevelTitle: string | null = null;
  let isMaxLevel = false;

  if (levels && levels.length > 0) {
    const sorted = [...levels].sort((a, b) => a.min_points - b.min_points);
    const reached = sorted.filter((l) => l.min_points <= totalPoints);
    const current = reached.length > 0 ? reached[reached.length - 1] : sorted[0];
    const next = sorted.find((l) => l.min_points > totalPoints) ?? null;
    currentLevelMinPoints = current?.min_points ?? 0;
    nextLevelMinPoints = next ? next.min_points : null;
    nextLevelTitle = next ? next.title : null;
    isMaxLevel = next === null;
  }

  return {
    level: dto.level ?? 1,
    title: dto.title ?? 'Новичок',
    totalPoints,
    badgesCount: dto.badges_count ?? 0,
    currentLevelMinPoints,
    nextLevelMinPoints,
    nextLevelTitle,
    isMaxLevel,
  };
};

const mapMy = (dto: MyAchievementsDto): MyAchievements => ({
  rank: mapRank(dto.rank, dto.rank_levels),
  earned: (dto.earned_badges ?? []).map(mapUserBadge),
  locked: (dto.progress ?? []).map(mapProgress),
  recentlyEarned: (dto.recently_earned ?? []).map(mapUserBadge),
});

const normalizePeerTarget = (raw: string | null | undefined): PeerBadgeTarget =>
  raw === 'travel' ? 'travel' : 'user';

const mapPeerBadge = (dto: PeerBadgeDto): PeerBadge => ({
  ...mapBadge(dto),
  target: normalizePeerTarget(dto.target),
});

const mapPeerReceived = (dto: PeerBadgeReceivedDto): PeerBadgeReceived => ({
  badge: mapPeerBadge(dto.badge),
  count: dto.count ?? 0,
  grantedByMe: Boolean(dto.granted_by_me),
});

const mapPublic = (dto: PublicAchievementsDto): PublicAchievements => ({
  rank: mapRank(dto.rank),
  earned: (dto.earned_badges ?? []).map(mapUserBadge),
  peerReceived: (dto.peer_received ?? []).map(mapPeerReceived),
});

// ── Мок-фолбэк (до готовности BE-A4) ────────────────────────────────────────

const USE_MOCK = process.env.EXPO_PUBLIC_ACHIEVEMENTS_MOCK === 'true';

/** Бэкенд ещё не задеплоен → 404/501/0. В DEV или под флагом отдаём мок. */
const shouldFallbackToMock = (error: unknown): boolean => {
  if (USE_MOCK) return true;
  if (!__DEV__) return false;
  return error instanceof ApiError && [0, 404, 501].includes(error.status);
};

// ── Публичные fetch-функции ─────────────────────────────────────────────────

export async function fetchBadgeCatalog(): Promise<Badge[]> {
  if (USE_MOCK) return MOCK_BADGES;
  try {
    const dto = await apiClient.get<BadgeDto[]>('/achievements/badges/');
    return (dto ?? []).map(mapBadge);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] badges catalog → mock fallback');
      return MOCK_BADGES;
    }
    throw error;
  }
}

export async function fetchMyAchievements(): Promise<MyAchievements> {
  if (USE_MOCK) return MOCK_MY_ACHIEVEMENTS;
  try {
    const dto = await apiClient.get<MyAchievementsDto>('/achievements/me/');
    return mapMy(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] me → mock fallback');
      return MOCK_MY_ACHIEVEMENTS;
    }
    throw error;
  }
}

export async function fetchUserAchievements(
  userId: string | number,
): Promise<PublicAchievements> {
  if (USE_MOCK) return MOCK_PUBLIC_ACHIEVEMENTS;
  try {
    const dto = await apiClient.get<PublicAchievementsDto>(
      `/achievements/user/${userId}/`,
      undefined,
      { skipAuth: true },
    );
    return mapPublic(dto);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] user → mock fallback');
      return MOCK_PUBLIC_ACHIEVEMENTS;
    }
    throw error;
  }
}

// ── Peer-awarded badges (§10) ───────────────────────────────────────────────

/** Каталог grantable peer-значков (для пикера выдачи). */
export async function fetchPeerBadgeCatalog(): Promise<PeerBadge[]> {
  if (USE_MOCK) return MOCK_PEER_CATALOG;
  try {
    const dto = await apiClient.get<PeerBadgeDto[]>('/achievements/peer-badges/');
    return (dto ?? []).map(mapPeerBadge);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] peer catalog → mock fallback');
      return MOCK_PEER_CATALOG;
    }
    throw error;
  }
}

/** Peer-значки, полученные конкретным travel (для travel-detail). */
export async function fetchTravelPeerBadges(
  travelId: string | number,
): Promise<PeerBadgeReceived[]> {
  if (USE_MOCK) return MOCK_TRAVEL_PEER_RECEIVED;
  try {
    const dto = await apiClient.get<TravelPeerBadgesDto>(
      `/achievements/travel/${travelId}/`,
      undefined,
      { skipAuth: true },
    );
    return (dto?.peer_received ?? []).map(mapPeerReceived);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] travel peer → mock fallback');
      return MOCK_TRAVEL_PEER_RECEIVED;
    }
    throw error;
  }
}

/** Toggle-выдача peer-значка (дал/забрал). Возвращает новое состояние + счётчик. */
export async function grantPeerBadge(input: GrantInput): Promise<GrantResult> {
  const body = {
    badge_slug: input.badgeSlug,
    ...(input.recipientId != null ? { recipient_id: input.recipientId } : {}),
    ...(input.travelId != null ? { travel_id: input.travelId } : {}),
  };
  try {
    const dto = await apiClient.post<GrantResponseDto>(
      '/achievements/peer-badges/grant/',
      body,
    );
    return { granted: Boolean(dto?.granted), count: dto?.count ?? 0 };
  } catch (error) {
    // Без бэка (mock/DEV-404) — симулируем «выдал», чтобы UI-toggle работал в превью.
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] grant → mock simulate');
      return { granted: true, count: 1 };
    }
    throw error;
  }
}

// ── Редкие награды (Sprint 11 / блок B, §«Гейм-3») ───────────────────────────
// Ручные награды, которые вручает только админ/модератор; ценнее авто-достижений.
// Контракт зеркалит тикеты борда #376/#377/#379/#380. Пока BE-rare-awards-model
// не задеплоен — fetch отдаёт моки тем же мок-фолбэком, что и остальные ачивки.

/** Кто вручил награду (лёгкий профиль для подписи на карточке). */
export interface RareAwardGranter {
  id: number;
  name: string;
}

/** Полученная редкая награда (для зоны «Редкие награды» в профиле). */
export interface RareAward {
  id: number;
  slug: string;
  /** Категория: ambassador / story-creator / first-wave / community-heart / legendary. */
  category: string;
  title: string;
  /** Уровень редкости (метка). Маппим в tier для премиум-визуала медали. */
  level: string;
  reason: string;
  grantedAt: string;
  grantedByProfile: RareAwardGranter | null;
  /** Лимит владельцев категории (null = без лимита). */
  ownerLimit: number | null;
  isRare: true;
  shareTemplate: string;
}

/** Элемент каталога для админ-пикера выдачи. */
export interface RareAwardCatalogItem {
  slug: string;
  category: string;
  title: string;
  level: string;
  description: string;
  ownerLimit: number | null;
  ownersCount: number;
}

/** Ответ на POST-выдачу (для оптимистичного обновления + аудита). */
export interface RareAwardGrant {
  id: number;
  userId: number;
  awardSlug: string;
  category: string;
  title: string;
  level: string;
  reason: string;
  grantedAt: string;
  grantedBy: number | null;
  journalEventId: number | null;
}

export interface GrantRareAwardInput {
  userId: string | number;
  awardSlug: string;
  reason: string;
}

interface RareAwardGranterDto {
  id?: number | null;
  name?: string | null;
  display_name?: string | null;
}

interface RareAwardDto {
  id: number;
  slug: string;
  category?: string | null;
  title?: string | null;
  level?: string | null;
  reason?: string | null;
  granted_at?: string | null;
  granted_by_profile?: RareAwardGranterDto | null;
  owner_limit?: number | null;
  is_rare?: boolean | null;
  share_template?: string | null;
}

interface RareAwardCatalogItemDto {
  slug: string;
  category?: string | null;
  title?: string | null;
  level?: string | null;
  description?: string | null;
  owner_limit?: number | null;
  owners_count?: number | null;
}

interface RareAwardGrantDto {
  id: number;
  user_id?: number | null;
  award_slug?: string | null;
  category?: string | null;
  title?: string | null;
  level?: string | null;
  reason?: string | null;
  granted_at?: string | null;
  granted_by?: number | null;
  journal_event_id?: number | null;
}

const mapRareGranter = (
  dto: RareAwardGranterDto | null | undefined,
): RareAwardGranter | null => {
  if (!dto || dto.id == null) return null;
  return { id: dto.id, name: dto.name ?? dto.display_name ?? '' };
};

const mapRareAward = (dto: RareAwardDto): RareAward => ({
  id: dto.id,
  slug: dto.slug,
  category: dto.category ?? 'other',
  title: dto.title ?? '',
  level: dto.level ?? 'legendary',
  reason: dto.reason ?? '',
  grantedAt: dto.granted_at ?? '',
  grantedByProfile: mapRareGranter(dto.granted_by_profile),
  ownerLimit: dto.owner_limit ?? null,
  isRare: true,
  shareTemplate: dto.share_template ?? 'rare',
});

const mapRareCatalogItem = (dto: RareAwardCatalogItemDto): RareAwardCatalogItem => ({
  slug: dto.slug,
  category: dto.category ?? 'other',
  title: dto.title ?? '',
  level: dto.level ?? 'legendary',
  description: dto.description ?? '',
  ownerLimit: dto.owner_limit ?? null,
  ownersCount: dto.owners_count ?? 0,
});

const mapRareGrant = (dto: RareAwardGrantDto): RareAwardGrant => ({
  id: dto.id,
  userId: dto.user_id ?? 0,
  awardSlug: dto.award_slug ?? '',
  category: dto.category ?? 'other',
  title: dto.title ?? '',
  level: dto.level ?? 'legendary',
  reason: dto.reason ?? '',
  grantedAt: dto.granted_at ?? '',
  grantedBy: dto.granted_by ?? null,
  journalEventId: dto.journal_event_id ?? null,
});

// Уровень редкости → BadgeTier для процедурной медали (BadgeMedal). Редкие награды
// премиальны по умолчанию, поэтому неизвестный уровень рисуем как legendary.
const RARE_LEVEL_TIERS: Record<string, BadgeTier> = {
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
  platinum: 'platinum',
  legendary: 'legendary',
};

/** Строит Badge-форму редкой награды для рендера в BadgeMedal. */
export const rareAwardToBadge = (award: RareAward): Badge => ({
  id: award.id,
  slug: award.slug,
  name: award.title,
  description: award.reason,
  categorySlug: award.category,
  categoryName: 'Редкие награды',
  tier: RARE_LEVEL_TIERS[award.level] ?? 'legendary',
  imageUrl: null,
  points: 0,
  isSecret: false,
  order: award.id,
});

/** Редкие награды текущего пользователя. */
export async function fetchMyRareAwards(): Promise<RareAward[]> {
  if (USE_MOCK) return MOCK_RARE_AWARDS;
  try {
    const dto = await apiClient.get<RareAwardDto[]>('/achievements/rare-awards/me/');
    return (dto ?? []).map(mapRareAward);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] rare-awards me → mock fallback');
      return MOCK_RARE_AWARDS;
    }
    throw error;
  }
}

/** Публичные редкие награды автора. */
export async function fetchUserRareAwards(
  userId: string | number,
): Promise<RareAward[]> {
  if (USE_MOCK) return MOCK_RARE_AWARDS;
  try {
    const dto = await apiClient.get<RareAwardDto[]>(
      `/achievements/user/${userId}/rare-awards/`,
      undefined,
      { skipAuth: true },
    );
    return (dto ?? []).map(mapRareAward);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] rare-awards user → mock fallback');
      return MOCK_RARE_AWARDS;
    }
    throw error;
  }
}

/** Каталог редких наград для админ-пикера выдачи (staff-only эндпоинт). */
export async function fetchRareAwardCatalog(): Promise<RareAwardCatalogItem[]> {
  if (USE_MOCK) return MOCK_RARE_AWARD_CATALOG;
  try {
    const dto = await apiClient.get<RareAwardCatalogItemDto[]>(
      '/achievements/rare-awards/catalog/',
    );
    return (dto ?? []).map(mapRareCatalogItem);
  } catch (error) {
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] rare-awards catalog → mock fallback');
      return MOCK_RARE_AWARD_CATALOG;
    }
    throw error;
  }
}

/** Выдача редкой награды админом/модератором. 400/403/404/409 пробрасываем в UI. */
export async function grantRareAward(
  input: GrantRareAwardInput,
): Promise<RareAwardGrant> {
  const body = {
    user_id: input.userId,
    award_slug: input.awardSlug,
    reason: input.reason,
  };
  try {
    const dto = await apiClient.post<RareAwardGrantDto>(
      '/achievements/rare-awards/grants/',
      body,
    );
    return mapRareGrant(dto);
  } catch (error) {
    // Без бэка (mock/DEV-404) — симулируем выдачу, чтобы превью работало.
    // Ролевые/валидационные ошибки (400/403/404/409) пробрасываем как есть.
    if (shouldFallbackToMock(error)) {
      devWarn('[achievements] rare grant → mock simulate');
      return {
        id: Date.now(),
        userId: Number(input.userId) || 0,
        awardSlug: input.awardSlug,
        category: 'other',
        title: input.awardSlug,
        level: 'legendary',
        reason: input.reason,
        grantedAt: new Date().toISOString(),
        grantedBy: null,
        journalEventId: null,
      };
    }
    throw error;
  }
}
