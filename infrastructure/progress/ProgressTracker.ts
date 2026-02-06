// src/infrastructure/progress/ProgressTracker.ts
// ✅ АРХИТЕКТУРА: Трекер прогресса экспорта

import { ExportProgress, ExportStage, ProgressCallback } from '@/types/pdf-export';

/**
 * Сервис для отслеживания прогресса экспорта
 */
export class ProgressTracker {
  private callbacks: Set<ProgressCallback> = new Set();
  private currentProgress: ExportProgress = {
    stage: ExportStage.VALIDATING,
    progress: 0,
  };

  /**
   * Подписывается на обновления прогресса
   */
  subscribe(callback: ProgressCallback): () => void {
    this.callbacks.add(callback);
    
    // Сразу вызываем callback с текущим прогрессом
    callback(this.currentProgress);
    
    // Возвращаем функцию отписки
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Обновляет прогресс и уведомляет подписчиков
   */
  update(stage: ExportStage, progress: number, message?: string): void {
    this.currentProgress = {
      stage,
      progress: Math.max(0, Math.min(100, progress)),
      message,
    };

    // Уведомляем всех подписчиков
    this.callbacks.forEach(callback => {
      try {
        callback(this.currentProgress);
      } catch (error) {
        console.error('[ProgressTracker] Error in callback:', error);
      }
    });
  }

  /**
   * Устанавливает прогресс для конкретного этапа
   */
  setStage(stage: ExportStage, progress: number, message?: string): void {
    this.update(stage, progress, message);
  }

  /**
   * Вычисляет общий прогресс на основе этапов
   */
  calculateOverallProgress(stage: ExportStage, stageProgress: number): number {
    const stageWeights: Record<ExportStage, number> = {
      [ExportStage.VALIDATING]: 5,
      [ExportStage.TRANSFORMING]: 5,
      [ExportStage.GENERATING_HTML]: 20,
      [ExportStage.LOADING_IMAGES]: 40,
      [ExportStage.RENDERING]: 25,
      [ExportStage.COMPLETE]: 100,
      [ExportStage.ERROR]: 0,
    };

    const weights: Record<ExportStage, number> = {
      [ExportStage.VALIDATING]: 0,
      [ExportStage.TRANSFORMING]: 5,
      [ExportStage.GENERATING_HTML]: 10,
      [ExportStage.LOADING_IMAGES]: 30,
      [ExportStage.RENDERING]: 70,
      [ExportStage.COMPLETE]: 100,
      [ExportStage.ERROR]: 0,
    };

    const baseProgress = weights[stage] || 0;
    const stageWeight = stageWeights[stage] || 0;
    const stageContribution = (stageWeight / 100) * stageProgress;

    return Math.round(baseProgress + stageContribution);
  }

  /**
   * Сбрасывает прогресс
   */
  reset(): void {
    this.currentProgress = {
      stage: ExportStage.VALIDATING,
      progress: 0,
    };
  }

  /**
   * Получает текущий прогресс
   */
  getCurrentProgress(): ExportProgress {
    return { ...this.currentProgress };
  }
}

