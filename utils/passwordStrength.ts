// src/utils/passwordStrength.ts
// ✅ Утилита для проверки силы пароля

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { translate as i18nT } from '@/i18n'


export interface PasswordStrength {
  score: number; // 0-4 (0 = очень слабый, 4 = очень сильный)
  feedback: string[];
  isValid: boolean;
}

/**
 * Проверяет силу пароля и возвращает оценку и рекомендации
 */
export function checkPasswordStrength(password: string): PasswordStrength {
  if (!password || password.length === 0) {
    return {
      score: 0,
      feedback: [],
      isValid: false,
    };
  }

  let score = 0;
  const feedback: string[] = [];

  // Проверка длины
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push(i18nT('auth:utils.passwordStrength.parol_dolzhen_soderzhat_minimum_8_simvolov_be72e44d'));
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Проверка наличия строчных букв
  if (/[a-zа-яё]/.test(password)) {
    score += 1;
  } else {
    feedback.push(i18nT('auth:utils.passwordStrength.dobavte_strochnye_bukvy_e00bac42'));
  }

  // Проверка наличия заглавных букв
  if (/[A-ZА-ЯЁ]/.test(password)) {
    score += 1;
  } else {
    feedback.push(i18nT('auth:utils.passwordStrength.dobavte_zaglavnye_bukvy_03b32fce'));
  }

  // Проверка наличия цифр
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push(i18nT('auth:utils.passwordStrength.dobavte_tsifry_e055c31d'));
  }

  // Проверка наличия специальных символов
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push(i18nT('auth:utils.passwordStrength.dobavte_spetsialnye_simvoly_i_t_d_b4748276'));
  }

  // Ограничиваем максимальный score до 4
  score = Math.min(score, 4);

  // Пароль валиден если score >= 3 и длина >= 8
  const isValid = score >= 3 && password.length >= 8;

  return {
    score,
    feedback: feedback.length > 0 ? feedback : [],
    isValid,
  };
}

/**
 * Получает текстовое описание силы пароля
 */
export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return i18nT('auth:utils.passwordStrength.ochen_slabyy_7fa58b46');
    case 2:
      return i18nT('auth:utils.passwordStrength.slabyy_a24c1b95');
    case 3:
      return i18nT('auth:utils.passwordStrength.sredniy_35ee0e24');
    case 4:
      return i18nT('auth:utils.passwordStrength.silnyy_2a67b36c');
    default:
      return i18nT('auth:utils.passwordStrength.ochen_slabyy_7fa58b46');
  }
}

/**
 * Получает цвет для индикатора силы пароля
 */
export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return DESIGN_TOKENS.colors.danger;
    case 2:
      return DESIGN_TOKENS.colors.warning;
    case 3:
      return DESIGN_TOKENS.colors.accent;
    case 4:
      return DESIGN_TOKENS.colors.success;
    default:
      return DESIGN_TOKENS.colors.textMuted;
  }
}

/**
 * Проверяет, соответствует ли пароль минимальным требованиям
 */
export function meetsMinimumRequirements(password: string): boolean {
  if (!password || password.length < 8) {
    return false;
  }

  const hasLowercase = /[a-zа-яё]/.test(password);
  const hasUppercase = /[A-ZА-ЯЁ]/.test(password);
  const hasNumber = /\d/.test(password);

  return hasLowercase && hasUppercase && hasNumber;
}
