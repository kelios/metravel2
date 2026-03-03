import {
  getRegistrationPasswordStrengthMeta,
  type RegistrationPasswordStrengthMeta,
} from '@/utils/registrationPasswordStrength';

describe('getRegistrationPasswordStrengthMeta', () => {
  it('returns null for empty password', () => {
    expect(getRegistrationPasswordStrengthMeta('')).toBeNull();
  });

  it('returns weak meta for short simple password', () => {
    expect(getRegistrationPasswordStrengthMeta('123')?.tier).toBe('weak');
    expect(getRegistrationPasswordStrengthMeta('123')?.progress).toBe(33);
  });

  it('returns medium meta for basic compliant password', () => {
    const result = getRegistrationPasswordStrengthMeta('Password123');

    expect(result).toMatchObject<Partial<RegistrationPasswordStrengthMeta>>({
      tier: 'medium',
      label: 'Средний',
      progress: 66,
      width: '66%',
    });
  });

  it('returns strong meta for complex long password', () => {
    const result = getRegistrationPasswordStrengthMeta('Password123!Test');

    expect(result).toMatchObject<Partial<RegistrationPasswordStrengthMeta>>({
      tier: 'strong',
      label: 'Сильный',
      progress: 100,
      width: '100%',
    });
  });
});
