import { mapProfileRank, type UserProfileDto } from '@/api/user';

const baseProfile = {
  id: 1,
  first_name: 'Julia',
  last_name: 'I',
} as unknown as UserProfileDto;

describe('mapProfileRank (#847)', () => {
  it('maps the profile-embedded rank_summary into the UserRank domain model', () => {
    const profile: UserProfileDto = {
      ...baseProfile,
      rank_summary: {
        level: 5,
        title: 'Эксперт',
        total_points: 1200,
        badges_count: 8,
        current_level_min_points: 1000,
        next_level_min_points: 1500,
        next_level_title: 'Мастер',
        is_max_level: false,
        progress_ratio: 0.4,
        remaining_points: 300,
        recomputed_at: '2026-07-01T00:00:00Z',
      },
    };

    expect(mapProfileRank(profile)).toEqual({
      level: 5,
      title: 'Эксперт',
      totalPoints: 1200,
      badgesCount: 8,
      currentLevelMinPoints: 1000,
      nextLevelMinPoints: 1500,
      nextLevelTitle: 'Мастер',
      isMaxLevel: false,
      progressRatio: 0.4,
      remainingPoints: 300,
      recomputedAt: '2026-07-01T00:00:00Z',
    });
  });

  it('returns null when rank_summary is absent (graceful fallback)', () => {
    expect(mapProfileRank(baseProfile)).toBeNull();
    expect(mapProfileRank(null)).toBeNull();
    expect(mapProfileRank(undefined)).toBeNull();
  });
});
