import { DESIGN_TOKENS } from '@/constants/designSystem';
import { checkPasswordStrength } from '@/utils/passwordStrength';
import { translate as i18nT } from '@/i18n'


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
    get label() { return i18nT('authStatic:utils.registrationPasswordStrength.slabyy_14e7800f') },
    color: DESIGN_TOKENS.colors.danger,
    progress: 33,
    width: '33%',
  },
  medium: {
    get label() { return i18nT('authStatic:utils.registrationPasswordStrength.sredniy_5f9e23d5') },
    color: DESIGN_TOKENS.colors.warning,
    progress: 66,
    width: '66%',
  },
  strong: {
    get label() { return i18nT('authStatic:utils.registrationPasswordStrength.silnyy_ac37343d') },
    color: DESIGN_TOKENS.colors.success,
    progress: 100,
    width: '100%',
  },
};

const STRONG_PASSWORD_MIN_LENGTH = 12;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

const getTierByScore = (score: number, password: string): RegistrationPasswordStrengthTier => {
  if (score <= 1) return 'weak';
  const isStrongByPolicy =
    score >= 4 &&
    password.length >= STRONG_PASSWORD_MIN_LENGTH &&
    SPECIAL_CHAR_REGEX.test(password);

  return isStrongByPolicy ? 'strong' : 'medium';
};

export function getRegistrationPasswordStrengthMeta(password: string): RegistrationPasswordStrengthMeta | null {
  if (!password) return null;

  const { score } = checkPasswordStrength(password);
  const tier = getTierByScore(score, password);
  return {
    tier,
    ...REGISTRATION_STRENGTH_META[tier],
  };
}
