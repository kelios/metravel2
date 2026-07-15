import type { CharacterStateDto, ProgressionLineDto } from '@/api/gamification';

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
  categoryId: number | null;
  categorySlug: string;
  categoryName: string;
  categoryIcon: string | null;
  tier: BadgeTier;
  imageUrl: string | null;
  imageStatus: string | null;
  awardType: string | null;
  target: string | null;
  points: number;
  isSecret: boolean;
  order: number;
}

export interface UserBadge {
  id: number;
  badge: Badge;
  earnedAt: string;
  period: string | null;
  discovery: string | null;
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
  isMaxLevel: boolean;
  progressRatio: number | null;
  remainingPoints: number | null;
  recomputedAt: string | null;
}

export interface ActivityType {
  type: string;
  label: string;
  score: number;
  level: number;
  nextThreshold: number | null;
  progressPercent: number | null;
  metrics: Record<string, number>;
}

export interface RareAwardGranter {
  id: number;
  name: string;
}

export interface RareAward {
  id: number;
  slug: string;
  category: string;
  title: string;
  level: string;
  reason: string;
  grantedAt: string;
  grantedByProfile: RareAwardGranter | null;
  ownerLimit: number | null;
  isRare: true;
  shareTemplate: string;
}

export interface RareAwardCatalogItem {
  slug: string;
  category: string;
  title: string;
  level: string;
  description: string;
  ownerLimit: number | null;
  ownersCount: number;
}

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

export interface MyAchievements {
  rank: UserRank;
  earned: UserBadge[];
  locked: BadgeProgress[];
  recentlyEarned: UserBadge[];
  activityTypes: ActivityType[];
  rareAwards?: RareAward[] | null;
  characterDto?: CharacterStateDto | null;
  progressionDto?: ProgressionLineDto[] | null;
}

export interface PublicAchievements {
  rank: UserRank;
  earned: UserBadge[];
  peerReceived: PeerBadgeReceived[];
  activityTypes: ActivityType[];
  rareAwards?: RareAward[] | null;
  characterDto?: CharacterStateDto | null;
  progressionDto?: ProgressionLineDto[] | null;
}

export type PeerBadgeTarget = 'user' | 'travel';

export interface PeerBadge extends Badge {
  target: PeerBadgeTarget;
}

export interface PeerBadgeReceived {
  badge: PeerBadge;
  count: number;
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

export interface GrantRareAwardInput {
  userId: string | number;
  awardSlug: string;
  reason: string;
}
