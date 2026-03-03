import { DESIGN_TOKENS } from '@/constants/designSystem';
import { checkPasswordStrength } from '@/utils/passwordStrength';

export type RegistrationPasswordStrengthTier = 'weak' | 'medium' | 'strong';

export interface RegistrationPasswordStrengthMeta {
  tier: RegistrationPasswordStrengthTier;
  label: string;
  color: string;
  progress: number;
  width: `${number}%`;
}

const REGISTRATION_STRENGTH_META: Record<
  RegistrationPasswordStrengthTier,
  Omit<RegistrationPasswordStrengthMeta, 'tier'>
> = {
  weak: {
    label: 'Слабый',
    color: DESIGN_TOKENS.colors.danger,
    progress: 33,
    width: '33%',
  },
  medium: {
    label: 'Средний',
    color: DESIGN_TOKENS.colors.warning,
    progress: 66,
    width: '66%',
  },
  strong: {
    label: 'Сильный',
    color: DESIGN_TOKENS.colors.success,
    progress: 100,
    width: '100%',
  },
};

const getTierByScore = (score: number): RegistrationPasswordStrengthTier => {
  if (score <= 1) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
};

export function getRegistrationPasswordStrengthMeta(password: string): RegistrationPasswordStrengthMeta | null {
  if (!password) return null;

  const { score } = checkPasswordStrength(password);
  const tier = getTierByScore(score);
  return {
    tier,
    ...REGISTRATION_STRENGTH_META[tier],
  };
}
