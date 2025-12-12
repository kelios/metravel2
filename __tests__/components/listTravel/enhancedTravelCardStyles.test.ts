import { describe, test, expect } from '@jest/globals';
import { getResponsiveCardValues } from '../../../components/listTravel/enhancedTravelCardStyles';

describe('getResponsiveCardValues', () => {
  describe('Mobile breakpoints (< 768px)', () => {
    test('returns mobile values for small screens', () => {
      const result = getResponsiveCardValues(375);

      expect(result).toEqual({
        borderRadius: 16,
        marginBottom: 20,
        imagePadding: 12,
        imagePaddingTop: 10,
        imageGap: 8,
        titleFontSize: 16,
        titleLineHeight: 22,
        titleMarginBottom: 2,
        titleMinHeight: 44,
        metaFontSize: 12,
        metaLineHeight: 16,
        tagFontSize: 11,
        tagLineHeight: 15,
      });
    });

    test('returns mobile values for iPad portrait', () => {
      const result = getResponsiveCardValues(767);
      expect(result.borderRadius).toBe(16);
      expect(result.titleFontSize).toBe(16);
      expect(result.metaFontSize).toBe(12);
    });
  });

  describe('Desktop breakpoints (>= 768px)', () => {
    test('returns desktop values for large screens', () => {
      const result = getResponsiveCardValues(768);

      expect(result).toEqual({
        borderRadius: 20,
        marginBottom: 24,
        imagePadding: 24,
        imagePaddingTop: 21,
        imageGap: 15,
        titleFontSize: 20,
        titleLineHeight: 28,
        titleMarginBottom: 6,
        titleMinHeight: 56,
        metaFontSize: 14,
        metaLineHeight: 20,
        tagFontSize: 13,
        tagLineHeight: 18,
      });
    });

    test('returns desktop values for very large screens', () => {
      const result = getResponsiveCardValues(1920);
      expect(result.borderRadius).toBe(20);
      expect(result.titleFontSize).toBe(20);
      expect(result.metaFontSize).toBe(14);
    });
  });

  describe('Edge cases', () => {
    test('handles zero width', () => {
      const result = getResponsiveCardValues(0);
      expect(result.borderRadius).toBe(16);
      expect(result.titleFontSize).toBe(16);
    });

    test('handles negative width', () => {
      const result = getResponsiveCardValues(-100);
      expect(result.borderRadius).toBe(16);
      expect(result.titleFontSize).toBe(16);
    });

    test('handles breakpoint boundary', () => {
      const mobile = getResponsiveCardValues(767);
      const desktop = getResponsiveCardValues(768);

      expect(mobile.borderRadius).toBe(16);
      expect(desktop.borderRadius).toBe(20);
    });
  });

  describe('Consistency', () => {
    test('returns identical results for same input', () => {
      expect(getResponsiveCardValues(375)).toEqual(getResponsiveCardValues(375));
    });

    test('returns different results for different breakpoints', () => {
      const mobile = getResponsiveCardValues(375);
      const desktop = getResponsiveCardValues(768);

      expect(mobile.borderRadius).not.toBe(desktop.borderRadius);
      expect(mobile.titleFontSize).not.toBe(desktop.titleFontSize);
      expect(mobile.metaFontSize).not.toBe(desktop.metaFontSize);
    });
  });
});
