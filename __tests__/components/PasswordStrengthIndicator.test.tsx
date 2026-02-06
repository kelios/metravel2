import React from 'react';
import { render } from '@testing-library/react-native';
import { PasswordStrengthIndicator } from '@/components/forms/PasswordStrengthIndicator';

// Mock password strength utilities
jest.mock('@/src/utils/passwordStrength', () => ({
  checkPasswordStrength: jest.fn((password: string) => {
    if (password.length < 4) {
      return { score: 0, feedback: ['Слишком короткий пароль'] };
    }
    if (password.length < 8) {
      return { score: 1, feedback: ['Пароль должен быть длиннее'] };
    }
    if (password === 'password123') {
      return { score: 2, feedback: ['Добавьте заглавные буквы'] };
    }
    if (password === 'Password123') {
      return { score: 3, feedback: ['Добавьте специальные символы'] };
    }
    return { score: 4, feedback: [] };
  }),
  getPasswordStrengthLabel: jest.fn((score: number) => {
    const labels = ['Очень слабый', 'Слабый', 'Средний', 'Сильный', 'Очень сильный'];
    return labels[score] || 'Неизвестно';
  }),
  getPasswordStrengthColor: jest.fn((score: number) => {
    const colors = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'];
    return colors[score] || '#6b7280';
  }),
}));

describe('PasswordStrengthIndicator', () => {
  it('should not render when password is empty', () => {
    const { toJSON } = render(<PasswordStrengthIndicator password="" />);
    const tree = toJSON();
    expect(tree).toBeNull();
  });

  it('should not render when password is not provided', () => {
    const { toJSON } = render(<PasswordStrengthIndicator password={undefined as any} />);
    const tree = toJSON();
    expect(tree).toBeNull();
  });

  it('should render with weak password', () => {
    const { toJSON } = render(<PasswordStrengthIndicator password="123" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Очень слабый');
  });

  it('should render with medium password', () => {
    const { toJSON } = render(<PasswordStrengthIndicator password="password123" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Средний');
  });

  it('should render with strong password', () => {
    const { toJSON } = render(<PasswordStrengthIndicator password="Password123" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Сильный');
  });

  it('should display feedback when showFeedback is true', () => {
    const { toJSON } = render(
      <PasswordStrengthIndicator password="password123" showFeedback={true} />
    );
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Добавьте заглавные буквы');
  });

  it('should not display feedback when showFeedback is false', () => {
    const { toJSON } = render(
      <PasswordStrengthIndicator password="password123" showFeedback={false} />
    );
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('Добавьте заглавные буквы');
  });

  it('should render strength bars', () => {
    const { toJSON } = render(<PasswordStrengthIndicator password="test123" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should display correct strength label', () => {
    const { toJSON } = render(<PasswordStrengthIndicator password="weak" />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Сила пароля');
  });
});

