// src/services/pdf-export/constructor/validators/ArticleValidator.ts
// ✅ АРХИТЕКТУРА: Валидатор для импорта статей

import type { Travel } from '@/src/types/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Валидатор для проверки корректности Travel объекта перед импортом
 */
export class ArticleValidator {
  /**
   * Валидирует Travel объект
   */
  validate(travel: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверка базовой структуры
    if (!travel) {
      errors.push('Travel объект не определен');
      return { valid: false, errors, warnings };
    }

    // Проверка обязательных полей
    if (!travel.name && !travel.title) {
      warnings.push('Отсутствует название статьи');
    }

    // Проверка контента
    if (!travel.content && !travel.description && !travel.text) {
      warnings.push('Отсутствует контент статьи');
    }

    // Проверка изображений
    if (travel.images && Array.isArray(travel.images)) {
      travel.images.forEach((img: any, index: number) => {
        if (!img.url && !img.src) {
          warnings.push(`Изображение ${index + 1} не имеет URL`);
        } else {
          const url = img.url || img.src;
          if (!this.isValidUrl(url)) {
            errors.push(`Некорректный URL изображения ${index + 1}: ${url}`);
          }
        }
      });
    }

    // Проверка HTML контента
    if (travel.content && typeof travel.content === 'string') {
      // Проверка на потенциально проблемные теги
      if (travel.content.includes('<script')) {
        errors.push('Обнаружен тег <script> в контенте - возможна XSS атака');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Проверяет валидность URL
   */
  private isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      // Проверка на data URL
      if (url.startsWith('data:')) {
        return true;
      }

      // Проверка на относительный путь
      if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
        return true;
      }

      // Проверка на полный URL
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Валидирует блок после создания
   */
  validateBlock(block: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!block) {
      errors.push('Блок не определен');
      return { valid: false, errors, warnings };
    }

    // Проверка типа
    if (!block.type) {
      errors.push('Блок не имеет типа');
    }

    // Проверка позиции
    if (!block.position) {
      errors.push('Блок не имеет позиции');
    } else {
      if (typeof block.position.x !== 'number' || block.position.x < 0) {
        errors.push('Некорректная позиция X');
      }
      if (typeof block.position.y !== 'number' || block.position.y < 0) {
        errors.push('Некорректная позиция Y');
      }
      if (typeof block.position.width !== 'number' || block.position.width <= 0) {
        errors.push('Некорректная ширина');
      }
      if (typeof block.position.height !== 'number' || block.position.height <= 0) {
        errors.push('Некорректная высота');
      }
    }

    // Проверка контента для изображений
    if (block.type === 'image' || block.type === 'image-with-caption' || block.type === 'image-gallery') {
      if (!block.content) {
        warnings.push('Блок изображения не имеет контента');
      } else if (typeof block.content === 'object') {
        if (block.type === 'image' || block.type === 'image-with-caption') {
          if (!block.content.url && !block.content.src) {
            errors.push('Изображение не имеет URL');
          }
        } else if (block.type === 'image-gallery') {
          if (!Array.isArray(block.content.images)) {
            errors.push('Галерея должна содержать массив изображений');
          } else if (block.content.images.length === 0) {
            warnings.push('Галерея пуста');
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

