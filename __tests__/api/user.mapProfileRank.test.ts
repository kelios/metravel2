import { mapProfileRank, normalizeProfileName, type UserProfileDto } from '@/api/user';

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

describe('normalizeProfileName', () => {
  it('does not treat plain names as media URLs', () => {
    expect(normalizeProfileName('Елена')).toBe('Елена');
  });

  it('recovers names polluted by the metravel.by media URL normalizer', () => {
    expect(normalizeProfileName('https://metravel.by/Елена')).toBe('Елена');
    expect(normalizeProfileName('https://metravel.by/%D0%95%D0%BB%D0%B5%D0%BD%D0%B0')).toBe('Елена');
  });
});
