// DTO adapters and pure domain normalizers for the achievements API.

import { translate as i18nT } from '@/i18n';
import type { CharacterStateDto, ProgressionLineDto } from '@/api/gamification';
import type {
  ActivityType,
  Badge,
  BadgeProgress,
  BadgeTier,
  MyAchievements,
  PeerBadge,
  PeerBadgeReceived,
  PeerBadgeTarget,
  PublicAchievements,
  RareAward,
  RareAwardCatalogItem,
  RareAwardGrant,
  RareAwardGranter,
  UserBadge,
  UserRank,
} from '@/api/achievementsTypes';

// ── Сырые DTO бэкенда (snake_case DRF) ──────────────────────────────────────

interface BadgeCategoryDto {
  id?: number;
  slug?: string | null;
  name?: string | null;
  order?: number | null;
  icon?: string | null;
}

export interface BadgeDto {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  category?: BadgeCategoryDto | null;
  tier?: string | null;
  image_url?: string | null;
  image_status?: string | null;
  award_type?: string | null;
  target?: string | null;
  points?: number | null;
  is_secret?: boolean | null;
  order?: number | null;
}

interface UserBadgeDto {
  id: number;
  badge: BadgeDto;
  earned_at: string;
  period?: string | null;
  discovery?: string | null;
}

interface ActivityTypeDto {
  type: string;
  label?: string | null;
  score?: number | null;
  level?: number | null;
  next_threshold?: number | null;
  progress_percent?: number | null;
  metrics?: Record<string, number> | null;
}

interface BadgeProgressDto {
  badge: BadgeDto;
  current?: number | null;
  threshold?: number | null;
}

export interface RankSummaryDto {
  level?: number | null;
  title?: string | null;
  total_points?: number | null;
  badges_count?: number | null;
  // Готовый rank-progress summary (#721): бэк отдаёт пороги/прогресс уже посчитанными
  // на обоих эндпоинтах (/me/ и /user/{id}/). До rollout этих полей может не быть —
  // тогда падаем на legacy-вычисление из rank_levels.
  current_level_min_points?: number | null;
  next_level_min_points?: number | null;
  next_level_title?: string | null;
  is_max_level?: boolean | null;
  progress_ratio?: number | null;
  remaining_points?: number | null;
  recomputed_at?: string | null;
}

interface RankLevelDto {
  level: number;
  title: string;
  min_points: number;
}

export interface MyAchievementsDto {
  rank: RankSummaryDto;
  rank_levels?: RankLevelDto[];
  earned_badges: UserBadgeDto[];
  progress: BadgeProgressDto[];
  recently_earned?: UserBadgeDto[];
  // Живой BE отдаёт top-level типы активности и редкие награды одним ответом —
  // читаем их, чтобы не терять смысловые поля и не делать лишних запросов.
  activity_types?: ActivityTypeDto[] | null;
  rare_awards?: RareAwardDto[] | null;
  // Консолидированный эндпоинт уже отдаёт персонажа и линейки прогрессии —
  // тем же payload'ом, что и /achievements/character/me/ и /progression/me/.
  // Пробрасываем сырые DTO, чтобы засеять их кэши и не делать повторных запросов
  // (#588: «Ваш путь» дублировал два медленных вызова).
  character?: CharacterStateDto | null;
  progression_lines?: ProgressionLineDto[] | null;
}

export interface PublicAchievementsDto {
  rank: RankSummaryDto;
  // Публичный эндпоинт теперь тоже отдаёт rank_levels (#721) — оставляем как legacy
  // fallback, если rank без summary; canonical path — поля прямо в rank.
  rank_levels?: RankLevelDto[];
  earned_badges: UserBadgeDto[];
  peer_received?: PeerBadgeReceivedDto[];
  // Живой /user/{id}/ отдаёт те же top-level ключи, что и /me/ — читаем их, чтобы
  // чужой профиль сеялся из ОДНОГО ответа (без /progression-lines/, /character/,
  // /rare-awards/ отдельными запросами; те остаются только как fallback).
  activity_types?: ActivityTypeDto[] | null;
  rare_awards?: RareAwardDto[] | null;
  character?: CharacterStateDto | null;
  progression_lines?: ProgressionLineDto[] | null;
}

export interface PeerBadgeDto extends BadgeDto {
  target?: string | null;
}

interface PeerBadgeReceivedDto {
  badge: PeerBadgeDto;
  count?: number | null;
  granted_by_me?: boolean | null;
}

export interface TravelPeerBadgesDto {
  peer_received?: PeerBadgeReceivedDto[];
}

export interface GrantResponseDto {
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

export const mapBadge = (dto: BadgeDto): Badge => ({
  id: dto.id,
  slug: dto.slug,
  name: dto.name,
  description: dto.description ?? '',
  categoryId: dto.category?.id ?? null,
  categorySlug: dto.category?.slug ?? 'other',
  categoryName: dto.category?.name ?? i18nT('achievements:api.achievements.badgeCategoryFallback'),
  categoryIcon: dto.category?.icon ?? null,
  tier: normalizeTier(dto.tier),
  // Бэк отдаёт '' когда картинки нет — нормализуем в null (BadgeMedal рисует фолбэк).
  imageUrl: dto.image_url ? dto.image_url : null,
  imageStatus: dto.image_status ?? null,
  awardType: dto.award_type ?? null,
  target: dto.target ?? null,
  points: dto.points ?? 0,
  isSecret: Boolean(dto.is_secret),
  order: dto.order ?? dto.id,
});
const mapUserBadge = (dto: UserBadgeDto): UserBadge => ({
  id: dto.id,
  badge: mapBadge(dto.badge),
  earnedAt: dto.earned_at,
  period: dto.period ?? null,
  discovery: dto.discovery ?? null,
});

const mapActivityType = (dto: ActivityTypeDto): ActivityType => ({
  type: dto.type,
  label: dto.label ?? '',
  score: dto.score ?? 0,
  level: dto.level ?? 0,
  nextThreshold: dto.next_threshold ?? null,
  progressPercent: dto.progress_percent ?? null,
  metrics: dto.metrics ?? {},
});

const mapProgress = (dto: BadgeProgressDto): BadgeProgress => ({
  badge: mapBadge(dto.badge),
  current: dto.current ?? 0,
  threshold: dto.threshold ?? 0,
});

// Canonical path (#721): бэк отдаёт rank-progress summary уже посчитанным на обоих
// эндпоинтах — пороги, is_max_level, progress_ratio и remaining_points читаем как есть.
// Legacy fallback: старый деплой отдавал rank БЕЗ порогов + отдельный rank_levels
// (только в /me/) → вычисляем пороги клиентом, progress_ratio/remaining оставляем null
// (RankBar посчитает сам). Без summary И без rank_levels (старый публичный ответ)
// пороги остаются null, isMaxLevel=false — RankBar рисует уровень без XP-полосы.
const hasServerSummary = (dto: RankSummaryDto): boolean =>
  dto.is_max_level != null ||
  dto.progress_ratio != null ||
  dto.next_level_min_points != null ||
  dto.current_level_min_points != null;

export const mapRank = (dto: RankSummaryDto, levels?: RankLevelDto[]): UserRank => {
  const totalPoints = dto.total_points ?? 0;
  const base = {
    level: dto.level ?? 1,
    title: dto.title ?? i18nT('achievements:api.achievements.rankTitleFallback'),
    totalPoints,
    badgesCount: dto.badges_count ?? 0,
    recomputedAt: dto.recomputed_at ?? null,
  };

  if (hasServerSummary(dto)) {
    const isMaxLevel = Boolean(dto.is_max_level);
    return {
      ...base,
      currentLevelMinPoints: dto.current_level_min_points ?? 0,
      nextLevelMinPoints: dto.next_level_min_points ?? null,
      nextLevelTitle: dto.next_level_title ?? null,
      isMaxLevel,
      progressRatio: dto.progress_ratio != null ? dto.progress_ratio : isMaxLevel ? 1 : null,
      remainingPoints: dto.remaining_points != null ? dto.remaining_points : isMaxLevel ? 0 : null,
    };
  }

  // ── legacy fallback: вычисление из rank_levels ──
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
    ...base,
    currentLevelMinPoints,
    nextLevelMinPoints,
    nextLevelTitle,
    isMaxLevel,
    // legacy: summary с бэка нет → RankBar считает ratio/remaining из порогов сам.
    progressRatio: null,
    remainingPoints: null,
  };
};
export const mapMy = (dto: MyAchievementsDto): MyAchievements => ({
  rank: mapRank(dto.rank, dto.rank_levels),
  earned: (dto.earned_badges ?? []).map(mapUserBadge),
  locked: (dto.progress ?? []).map(mapProgress),
  recentlyEarned: (dto.recently_earned ?? []).map(mapUserBadge),
  activityTypes: (dto.activity_types ?? []).map(mapActivityType),
  // null (не []) когда поля не было — хук отличает «пусто» от «не пришло» и делает fallback-запрос.
  rareAwards: dto.rare_awards != null ? dto.rare_awards.map(mapRareAward) : null,
  characterDto: dto.character ?? null,
  progressionDto: dto.progression_lines ?? null,
});

const normalizePeerTarget = (raw: string | null | undefined): PeerBadgeTarget =>
  raw === 'travel' ? 'travel' : 'user';

export const mapPeerBadge = (dto: PeerBadgeDto): PeerBadge => ({
  ...mapBadge(dto),
  target: normalizePeerTarget(dto.target),
});

export const mapPeerReceived = (dto: PeerBadgeReceivedDto): PeerBadgeReceived => ({
  badge: mapPeerBadge(dto.badge),
  count: dto.count ?? 0,
  grantedByMe: Boolean(dto.granted_by_me),
});

export const mapPublic = (dto: PublicAchievementsDto): PublicAchievements => ({
  rank: mapRank(dto.rank, dto.rank_levels),
  earned: (dto.earned_badges ?? []).map(mapUserBadge),
  peerReceived: (dto.peer_received ?? []).map(mapPeerReceived),
  activityTypes: (dto.activity_types ?? []).map(mapActivityType),
  // null (не []) когда поля не было — хук делает fallback-запрос за rare-awards.
  rareAwards: dto.rare_awards != null ? dto.rare_awards.map(mapRareAward) : null,
  // Сеем gamification-кэши из этого же ответа; null → отдельный запрос как fallback.
  characterDto: dto.character ?? null,
  progressionDto: dto.progression_lines ?? null,
});

interface RareAwardGranterDto {
  id?: number | null;
  name?: string | null;
  display_name?: string | null;
}

export interface RareAwardDto {
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

export interface RareAwardCatalogItemDto {
  slug: string;
  category?: string | null;
  title?: string | null;
  level?: string | null;
  description?: string | null;
  owner_limit?: number | null;
  owners_count?: number | null;
}

export interface RareAwardGrantDto {
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

export const mapRareAward = (dto: RareAwardDto): RareAward => ({
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

export const mapRareCatalogItem = (dto: RareAwardCatalogItemDto): RareAwardCatalogItem => ({
  slug: dto.slug,
  category: dto.category ?? 'other',
  title: dto.title ?? '',
  level: dto.level ?? 'legendary',
  description: dto.description ?? '',
  ownerLimit: dto.owner_limit ?? null,
  ownersCount: dto.owners_count ?? 0,
});

export const mapRareGrant = (dto: RareAwardGrantDto): RareAwardGrant => ({
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
  categoryId: null,
  categorySlug: award.category,
  categoryName: i18nT('achievements:api.achievements.rareAwardsCategory'),
  categoryIcon: null,
  tier: RARE_LEVEL_TIERS[award.level] ?? 'legendary',
  imageUrl: null,
  imageStatus: null,
  awardType: 'rare',
  target: 'user',
  points: 0,
  isSecret: false,
  order: award.id,
});
