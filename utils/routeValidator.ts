import type { RoutePoint, ValidationResult } from '@/types/route';
import { CoordinateConverter } from './coordinateConverter';

/**
 * Route validation utilities
 */
export class RouteValidator {
  static readonly MIN_DISTANCE = 100; // meters
  static readonly MAX_DISTANCE = 500_000; // 500 km
  static readonly MAX_POINTS = 10;
  static readonly WARNING_DISTANCE = 200_000; // 200 km

  /**
   * Validate route points
   */
  static validate(points: RoutePoint[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check minimum points
    if (points.length < 2) {
      errors.push('Добавьте минимум 2 точки для построения маршрута');
      return { valid: false, errors, warnings };
    }

    // 2. Check maximum points
    if (points.length > this.MAX_POINTS) {
      errors.push(`Максимальное количество точек: ${this.MAX_POINTS}`);
    }

    // 3. Check for invalid coordinates
    for (let i = 0; i < points.length; i++) {
      if (!CoordinateConverter.isValid(points[i].coordinates)) {
        errors.push(`Точка ${i + 1} имеет некорректные координаты`);
      }
    }

    // 4. Check for duplicate points (too close)
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const distance = CoordinateConverter.distance(
          points[i].coordinates,
          points[j].coordinates
        );
        
        if (distance < this.MIN_DISTANCE) {
          errors.push(
            `Точки "${points[i].address}" и "${points[j].address}" слишком близко (${Math.round(distance)} м)`
          );
        }
      }
    }

    // 5. Check total route distance
    const totalDistance = CoordinateConverter.pathDistance(
      points.map(p => p.coordinates)
    );

    if (totalDistance > this.MAX_DISTANCE) {
      errors.push(
        `Маршрут слишком длинный (${CoordinateConverter.formatDistance(totalDistance)}). ` +
        `Максимум: ${CoordinateConverter.formatDistance(this.MAX_DISTANCE)}`
      );
    }

    // 6. Warnings
    if (totalDistance > this.WARNING_DISTANCE) {
      warnings.push(
        `Длинный маршрут (${CoordinateConverter.formatDistance(totalDistance)}) может содержать много точек интереса`
      );
    }

    if (points.length > 5) {
      warnings.push('Большое количество точек может увеличить время построения маршрута');
    }

    // Check for points crossing country borders (simplified check for Belarus)
    if (this.crossesBelarusBorder(points)) {
      warnings.push('Маршрут может пересекать границу Беларуси');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Quick validation for adding a single point
   */
  static canAddPoint(existingPoints: RoutePoint[], newPoint: RoutePoint): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check max points
    if (existingPoints.length >= this.MAX_POINTS) {
      errors.push(`Достигнуто максимальное количество точек (${this.MAX_POINTS})`);
      return { valid: false, errors, warnings };
    }

    // Check for duplicates
    for (const point of existingPoints) {
      const distance = CoordinateConverter.distance(
        point.coordinates,
        newPoint.coordinates
      );
      
      if (distance < this.MIN_DISTANCE) {
        errors.push(
          `Точка слишком близко к "${point.address}" (${Math.round(distance)} м)`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Simplified check if route crosses Belarus border
   * Belarus approximate bounds: 51.3-56.2°N, 23.2-32.8°E
   */
  private static crossesBelarusBorder(points: RoutePoint[]): boolean {
    const BELARUS_BOUNDS = {
      north: 56.2,
      south: 51.3,
      east: 32.8,
      west: 23.2,
    };

    let hasInside = false;
    let hasOutside = false;

    for (const point of points) {
      const isInside = CoordinateConverter.isInBounds(
        point.coordinates,
        BELARUS_BOUNDS
      );

      if (isInside) hasInside = true;
      else hasOutside = true;

      if (hasInside && hasOutside) return true;
    }

    return false;
  }

  /**
   * Get user-friendly error message
   */
  static getErrorMessage(validation: ValidationResult): string {
    if (validation.valid) return '';
    return validation.errors.join('. ');
  }

  /**
   * Get user-friendly warning message
   */
  static getWarningMessage(validation: ValidationResult): string {
    if (validation.warnings.length === 0) return '';
    return validation.warnings.join('. ');
  }
}
