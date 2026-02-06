// __tests__/utils/passwordStrength.test.ts
import { 
  checkPasswordStrength, 
  getPasswordStrengthLabel, 
  getPasswordStrengthColor,
  meetsMinimumRequirements 
} from '@/utils/passwordStrength';
import { DESIGN_TOKENS } from '@/constants/designSystem';

describe('passwordStrength', () => {
  describe('checkPasswordStrength', () => {
    it('should return score 0 for empty password', () => {
      const result = checkPasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.isValid).toBe(false);
    });

    it('should return low score for short password', () => {
      const result = checkPasswordStrength('abc');
      expect(result.score).toBeLessThan(3);
      expect(result.isValid).toBe(false);
    });

    it('should return medium score for decent password', () => {
      const result = checkPasswordStrength('Password123');
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('should return high score for strong password', () => {
      const result = checkPasswordStrength('MyP@ssw0rd!2023');
      expect(result.score).toBe(4);
      expect(result.isValid).toBe(true);
    });

    it('should give feedback for missing requirements', () => {
      const result = checkPasswordStrength('password');
      expect(result.feedback.length).toBeGreaterThan(0);
      expect(result.feedback).toContain('Добавьте заглавные буквы');
      expect(result.feedback).toContain('Добавьте цифры');
    });

    it('should validate password with all requirements', () => {
      const result = checkPasswordStrength('Password123!');
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getPasswordStrengthLabel', () => {
    it('should return "Очень слабый" for score 0-1', () => {
      expect(getPasswordStrengthLabel(0)).toBe('Очень слабый');
      expect(getPasswordStrengthLabel(1)).toBe('Очень слабый');
    });

    it('should return "Слабый" for score 2', () => {
      expect(getPasswordStrengthLabel(2)).toBe('Слабый');
    });

    it('should return "Средний" for score 3', () => {
      expect(getPasswordStrengthLabel(3)).toBe('Средний');
    });

    it('should return "Сильный" for score 4', () => {
      expect(getPasswordStrengthLabel(4)).toBe('Сильный');
    });
  });

  describe('getPasswordStrengthColor', () => {
    it('should return red for weak passwords', () => {
      expect(getPasswordStrengthColor(0)).toBe(DESIGN_TOKENS.colors.danger);
      expect(getPasswordStrengthColor(1)).toBe(DESIGN_TOKENS.colors.danger);
    });

    it('should return green for strong passwords', () => {
      expect(getPasswordStrengthColor(4)).toBe(DESIGN_TOKENS.colors.success);
    });
  });

  describe('meetsMinimumRequirements', () => {
    it('should return false for short passwords', () => {
      expect(meetsMinimumRequirements('Pass1')).toBe(false);
    });

    it('should return false for passwords without uppercase', () => {
      expect(meetsMinimumRequirements('password123')).toBe(false);
    });

    it('should return false for passwords without numbers', () => {
      expect(meetsMinimumRequirements('Password')).toBe(false);
    });

    it('should return true for valid passwords', () => {
      expect(meetsMinimumRequirements('Password123')).toBe(true);
    });
  });
});
