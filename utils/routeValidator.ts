import type { RoutePoint, ValidationResult } from '@/types/route';
import { CoordinateConverter } from './coordinateConverter';
import { translate as i18nT } from '@/i18n'


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
      errors.push(i18nT('shared:utils.routeValidator.dobavte_minimum_2_tochki_dlya_postroeniya_ma_452331ce'));
      return { valid: false, errors, warnings };
    }

    // 2. Check maximum points
    if (points.length > this.MAX_POINTS) {
      errors.push(i18nT('shared:utils.routeValidator.maksimalnoe_kolichestvo_tochek_value1_b74f0b85', { value1: this.MAX_POINTS }));
    }

    // 3. Check for invalid coordinates
    for (let i = 0; i < points.length; i++) {
      if (!CoordinateConverter.isValid(points[i].coordinates)) {
        errors.push(i18nT('shared:utils.routeValidator.tochka_value1_imeet_nekorrektnye_koordinaty_1164d491', { value1: i + 1 }));
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
            i18nT('shared:utils.routeValidator.tochki_value1_i_value2_slishkom_blizko_value_b5a84d9d', { value1: points[i].address, value2: points[j].address, value3: Math.round(distance) })
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
        i18nT('shared:utils.routeValidator.dlinnyy_marshrut_value1_mozhet_soderzhat_mno_59e35fbe', { value1: CoordinateConverter.formatDistance(totalDistance) })
      );
    }

    if (points.length > 5) {
      warnings.push(i18nT('shared:utils.routeValidator.bolshoe_kolichestvo_tochek_mozhet_uvelichit__0276fba8'));
    }

    // Check for points crossing country borders (simplified check for Belarus)
    if (this.crossesBelarusBorder(points)) {
      warnings.push(i18nT('shared:utils.routeValidator.marshrut_mozhet_peresekat_granitsu_belarusi_d4c365cc'));
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
      errors.push(i18nT('shared:utils.routeValidator.dostignuto_maksimalnoe_kolichestvo_tochek_va_877de0cc', { value1: this.MAX_POINTS }));
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
          i18nT('shared:utils.routeValidator.tochka_slishkom_blizko_k_value1_value2_m_9383282b', { value1: point.address, value2: Math.round(distance) })
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
