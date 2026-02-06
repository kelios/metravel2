// src/utils/passwordStrength.ts
// ✅ Утилита для проверки силы пароля

import { DESIGN_TOKENS } from '@/constants/designSystem';

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
    feedback.push('Пароль должен содержать минимум 8 символов');
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Проверка наличия строчных букв
  if (/[a-zа-яё]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Добавьте строчные буквы');
  }

  // Проверка наличия заглавных букв
  if (/[A-ZА-ЯЁ]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Добавьте заглавные буквы');
  }

  // Проверка наличия цифр
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Добавьте цифры');
  }

  // Проверка наличия специальных символов
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Добавьте специальные символы (!@#$%^&* и т.д.)');
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
      return 'Очень слабый';
    case 2:
      return 'Слабый';
    case 3:
      return 'Средний';
    case 4:
      return 'Сильный';
    default:
      return 'Очень слабый';
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
