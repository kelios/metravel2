/**
 * VideoSection.redesign.test.tsx
 *
 * Тесты для редизайна секции видео маршрута
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VideoSection } from '@/components/travel/details/redesign/VideoSection.redesign';

// Мок для хука темной темы
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: jest.fn(() => ({
    surface: '#1a1a1a',
    surfaceElevated: '#2a2a2a',
    text: '#ffffff',
    textMuted: '#9ca3af',
    primary: '#3b82f6',
    borderLight: '#374151',
    backgroundSecondary: '#262626',
  })),
}));

describe('VideoSection.redesign', () => {
  const validYouTubeUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Рендеринг', () => {
    it('должен корректно отобразить базовую структуру', () => {
      const { getByTestId, getByText } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      expect(getByTestId('video-section-redesign')).toBeTruthy();
      expect(getByText('Видео')).toBeTruthy();
    });

    it('должен отобразить кастомный заголовок', () => {
      const { getByText } = render(
        <VideoSection url={validYouTubeUrls[0]} title="Наше видео" />
      );

      expect(getByText('Наше видео')).toBeTruthy();
    });

    it('должен отобразить кастомный подзаголовок', () => {
      const { getByText } = render(
        <VideoSection
          url={validYouTubeUrls[0]}
          subtitle="Смотрите наше путешествие"
        />
      );

      expect(getByText('Смотрите наше путешествие')).toBeTruthy();
    });

    it('должен отобразить превью по умолчанию', () => {
      const { getByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      expect(getByTestId('video-preview')).toBeTruthy();
    });

    it('не должен отображаться с невалидным URL', () => {
      const { queryByTestId } = render(
        <VideoSection url="invalid-url" />
      );

      expect(queryByTestId('video-section-redesign')).toBeNull();
    });

    it('не должен отображаться с пустым URL', () => {
      const { queryByTestId } = render(
        <VideoSection url="" />
      );

      expect(queryByTestId('video-section-redesign')).toBeNull();
    });
  });

  describe('Извлечение YouTube ID', () => {
    it('должен работать с youtube.com/watch?v=', () => {
      const { getByTestId } = render(
        <VideoSection url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
      );

      expect(getByTestId('video-section-redesign')).toBeTruthy();
    });

    it('должен работать с youtu.be/', () => {
      const { getByTestId } = render(
        <VideoSection url="https://youtu.be/dQw4w9WgXcQ" />
      );

      expect(getByTestId('video-section-redesign')).toBeTruthy();
    });

    it('должен работать с youtube.com/embed/', () => {
      const { getByTestId } = render(
        <VideoSection url="https://www.youtube.com/embed/dQw4w9WgXcQ" />
      );

      expect(getByTestId('video-section-redesign')).toBeTruthy();
    });
  });

  describe('Воспроизведение видео', () => {
    it('должен показать iframe при клике на превью', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'web';

      const { getByTestId, queryByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      expect(getByTestId('video-preview')).toBeTruthy();

      fireEvent.press(getByTestId('video-preview'));

      // После клика превью должно исчезнуть
      expect(queryByTestId('video-preview')).toBeNull();
    });

    it('должен изменить состояние при клике', () => {
      const { getByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      const preview = getByTestId('video-preview');

      fireEvent.press(preview);

      // Проверяем, что компонент изменился
      expect(getByTestId('video-container')).toBeTruthy();
    });
  });

  describe('Темная тема', () => {
    it('должен использовать темные цвета', () => {
      const { useThemedColors } = require('@/hooks/useTheme');

      render(<VideoSection url={validYouTubeUrls[0]} />);

      expect(useThemedColors).toHaveBeenCalled();
    });

    it('должен применить темный фон к контейнеру', () => {
      const { getByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      const container = getByTestId('video-section-redesign');
      expect(container.props.style).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#1a1a1a' })
        ])
      );
    });
  });

  describe('Доступность (A11y)', () => {
    it('должен иметь корректную метку доступности', () => {
      const { getByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      const container = getByTestId('video-section-redesign');
      expect(container.props.accessible).toBe(true);
      expect(container.props.accessibilityLabel).toBe('Видео маршрута');
    });

    it('должен иметь header role', () => {
      const { getByText } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      const header = getByText('Видео');
      expect(header.props.accessibilityRole).toBe('header');
    });

    it('должен иметь кнопку с корректными атрибутами', () => {
      const { getByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      const preview = getByTestId('video-preview');
      expect(preview.props.accessibilityRole).toBe('button');
      expect(preview.props.accessibilityLabel).toBe('Смотреть видео');
      expect(preview.props.accessibilityHint).toBe('Нажмите, чтобы запустить видео');
    });
  });

  describe('Адаптивность', () => {
    it('должен корректно работать на web', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'web';

      const { getByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      expect(getByTestId('video-section-redesign')).toBeTruthy();
    });

    it('должен корректно работать на iOS', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'ios';

      const { getByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      expect(getByTestId('video-section-redesign')).toBeTruthy();
    });

    it('должен корректно работать на Android', () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'android';

      const { getByTestId } = render(
        <VideoSection url={validYouTubeUrls[0]} />
      );

      expect(getByTestId('video-section-redesign')).toBeTruthy();
    });
  });

  describe('Мемоизация', () => {
    it('должен быть обернут в memo', () => {
      expect(VideoSection.displayName).toBe('VideoSection');
    });
  });
});

