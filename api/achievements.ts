// api/achievements.ts
// Stable public facade for achievements and gamification integrations.

export type * from '@/api/achievementsTypes';
export { mapRank, rareAwardToBadge } from '@/api/achievementsNormalizers';
export type { RankSummaryDto } from '@/api/achievementsNormalizers';
export * from '@/api/achievementsRequests';
