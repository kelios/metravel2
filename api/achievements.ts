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
}

// ── Сырые DTO бэкенда (snake_case DRF) ──────────────────────────────────────

interface BadgeDto {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  category_slug?: string | null;
  category_name?: string | null;
  tier?: string | null;
  image_url?: string | null;
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
  current: number;
  threshold: number;
}

interface UserRankDto {
  level?: number | null;
  title?: string | null;
  total_points?: number | null;
  badges_count?: number | null;
  current_level_min_points?: number | null;
  next_level_min_points?: number | null;
  next_level_title?: string | null;
}

interface MyAchievementsDto {
  rank: UserRankDto;
  earned: UserBadgeDto[];
  locked: BadgeProgressDto[];
  recently_earned?: UserBadgeDto[];
}

interface PublicAchievementsDto {
  rank: UserRankDto;
  earned: UserBadgeDto[];
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
  categorySlug: dto.category_slug ?? 'other',
  categoryName: dto.category_name ?? 'Достижения',
  tier: normalizeTier(dto.tier),
  imageUrl: dto.image_url ?? null,
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

const mapRank = (dto: UserRankDto): UserRank => ({
  level: dto.level ?? 1,
  title: dto.title ?? 'Новичок',
  totalPoints: dto.total_points ?? 0,
  badgesCount: dto.badges_count ?? 0,
  currentLevelMinPoints: dto.current_level_min_points ?? 0,
  nextLevelMinPoints: dto.next_level_min_points ?? null,
  nextLevelTitle: dto.next_level_title ?? null,
});

const mapMy = (dto: MyAchievementsDto): MyAchievements => ({
  rank: mapRank(dto.rank),
  earned: (dto.earned ?? []).map(mapUserBadge),
  locked: (dto.locked ?? []).map(mapProgress),
  recentlyEarned: (dto.recently_earned ?? []).map(mapUserBadge),
});

const mapPublic = (dto: PublicAchievementsDto): PublicAchievements => ({
  rank: mapRank(dto.rank),
  earned: (dto.earned ?? []).map(mapUserBadge),
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
