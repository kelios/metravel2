// src/infrastructure/error/ErrorHandler.ts
// ✅ АРХИТЕКТУРА: Обработчик ошибок для PDF экспорта

import { ExportError, ExportErrorType } from '@/src/types/pdf-export';

/**
 * Сервис для обработки и классификации ошибок
 */
export class ErrorHandler {
  /**
   * Классифицирует ошибку и создает структурированный ExportError
   */
  handle(error: unknown, context?: Record<string, any>): ExportError {
    if (error instanceof ExportError) {
      return error;
    }

    const originalError = error instanceof Error ? error : new Error(String(error));
    
    // Определяем тип ошибки по сообщению или типу
    let errorType = ExportErrorType.UNKNOWN_ERROR;
    
    if (originalError.message.includes('validation') || originalError.message.includes('валидация')) {
      errorType = ExportErrorType.VALIDATION_ERROR;
    } else if (originalError.message.includes('transform') || originalError.message.includes('преобразование')) {
      errorType = ExportErrorType.TRANSFORMATION_ERROR;
    } else if (originalError.message.includes('HTML') || originalError.message.includes('html')) {
      errorType = ExportErrorType.HTML_GENERATION_ERROR;
    } else if (originalError.message.includes('image') || originalError.message.includes('изображение') || originalError.message.includes('CORS')) {
      errorType = ExportErrorType.IMAGE_LOAD_ERROR;
    } else if (originalError.message.includes('render') || originalError.message.includes('pdf') || originalError.message.includes('canvas')) {
      errorType = ExportErrorType.RENDERING_ERROR;
    }

    // Логируем ошибку (structured logging)
    this.logError(errorType, originalError, context);

    return new ExportError(
      errorType,
      this.getUserFriendlyMessage(errorType, originalError),
      originalError,
      context
    );
  }

  /**
   * Получает понятное пользователю сообщение об ошибке
   */
  private getUserFriendlyMessage(type: ExportErrorType, _error: Error): string {
    const messages: Record<ExportErrorType, string> = {
      [ExportErrorType.VALIDATION_ERROR]: 'Ошибка валидации данных. Проверьте выбранные путешествия.',
      [ExportErrorType.TRANSFORMATION_ERROR]: 'Ошибка преобразования данных. Попробуйте еще раз.',
      [ExportErrorType.HTML_GENERATION_ERROR]: 'Ошибка генерации содержимого. Попробуйте еще раз.',
      [ExportErrorType.IMAGE_LOAD_ERROR]: 'Ошибка загрузки изображений. Некоторые изображения могут отсутствовать.',
      [ExportErrorType.RENDERING_ERROR]: 'Ошибка создания PDF. Попробуйте еще раз или выберите меньше путешествий.',
      [ExportErrorType.UNKNOWN_ERROR]: 'Произошла неизвестная ошибка. Попробуйте еще раз.',
    };

    return messages[type] || messages[ExportErrorType.UNKNOWN_ERROR];
  }

  /**
   * Структурированное логирование ошибок
   */
  private logError(type: ExportErrorType, error: Error, context?: Record<string, any>): void {
    const logData = {
      type,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };

    // ✅ УЛУЧШЕНИЕ: Используем новый logger с поддержкой мониторинга
    const { logError } = require('@/src/utils/logger');
    logError(error, {
      ...logData,
      ...(context && { context }),
    });
  }

  /**
   * Проверяет, можно ли повторить операцию после ошибки
   */
  isRetryable(error: ExportError): boolean {
    return [
      ExportErrorType.IMAGE_LOAD_ERROR,
      ExportErrorType.RENDERING_ERROR,
    ].includes(error.type);
  }

  /**
   * Получает задержку перед повторной попыткой (exponential backoff)
   */
  getRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000); // Максимум 10 секунд
  }
}
