// __tests__/components/MapPage/map-mobile-layout.test.tsx
import { Platform } from 'react-native';
import { getStyles } from '@/screens/tabs/map.styles';
import { LAYOUT } from '@/constants/layout';

// Mock themed colors
const mockThemedColors = {
  primary: '#7a9d8f',
  surface: '#ffffff',
  text: '#3a3a3a',
  textMuted: '#6a6a6a',
  textInverse: '#ffffff',
  border: '#e0e0e0',
  surfaceLight: '#f5f4f2',
  surfaceMuted: '#f9f8f6',
  primaryLight: '#f0f5f3',
  overlayLight: 'rgba(0,0,0,0.05)',
  shadows: {
    light: '0 2px 4px rgba(0,0,0,0.1)',
    medium: '0 4px 8px rgba(0,0,0,0.15)',
    heavy: '0 8px 16px rgba(0,0,0,0.2)',
  },
  boxShadows: {
    light: '0 2px 4px rgba(0,0,0,0.1)',
    medium: '0 4px 8px rgba(0,0,0,0.15)',
    heavy: '0 8px 16px rgba(0,0,0,0.2)',
  },
};

describe('Map Mobile Layout Styles', () => {
  beforeEach(() => {
    Platform.OS = 'web';
  });

  describe('Bottom Sheet Panel', () => {
    it('should position panel at bottom on mobile', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanel.position).toBe('absolute');
      expect(styles.rightPanel.bottom).toBe(LAYOUT.tabBarHeight);
      expect(styles.rightPanel.left).toBe(0);
      expect(styles.rightPanel.right).toBe(0);
      expect(styles.rightPanel.top).toBeUndefined();
    });

    it('should have full width on mobile', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanel.width).toBe('100%');
      expect(styles.rightPanel.maxWidth).toBe('100%');
    });

    it('should have 75vh max height on mobile', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanel.maxHeight).toBe('75vh');
    });

    it('should have rounded top corners on mobile', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanel.borderTopLeftRadius).toBe(20);
      expect(styles.rightPanel.borderTopRightRadius).toBe(20);
    });

    it('should have left border-radius on desktop for visual integration', () => {
      const styles = getStyles(false, 0, 0, 1024, mockThemedColors as any);
      
      expect(styles.rightPanel.borderTopLeftRadius).toBe(24);
      expect(styles.rightPanel.borderTopRightRadius).toBe(24);
    });

    it('should position panel on right side on desktop', () => {
      const styles = getStyles(false, 0, 0, 1024, mockThemedColors as any);
      
      expect(styles.rightPanel.position).toBe('relative');
      expect(styles.rightPanel.top).toBe(0);
      expect(styles.rightPanel.bottom).toBeUndefined();
      expect(styles.rightPanel.left).toBeUndefined();
      expect(styles.rightPanel.right).toBeUndefined();
    });
  });

  describe('Bottom Sheet Animation', () => {
    it('should use translateY for mobile open state', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanelMobileOpen.transform).toEqual([{ translateY: 0 }]);
      expect(styles.rightPanelMobileOpen.pointerEvents).toBe('auto');
    });

    it('should use translateY 100% for mobile closed state', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanelMobileClosed.transform).toEqual([{ translateY: '100%' }]);
      expect(styles.rightPanelMobileClosed.pointerEvents).toBe('none');
    });

    it('should use translateX for desktop closed state', () => {
      const styles = getStyles(false, 0, 0, 1024, mockThemedColors as any);
      
      expect(styles.rightPanelDesktopClosed.transform).toEqual([{ translateX: -16 }]);
      expect(styles.rightPanelDesktopClosed.opacity).toBe(0);
    });
  });

  describe('Compact Navigation', () => {
    it('should have compact padding on mobile header', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.tabsContainer.paddingTop).toBe(10); // Math.max(10, 0+2)
      expect(styles.tabsContainer.paddingBottom).toBe(7);
      expect(styles.tabsContainer.paddingHorizontal).toBe(10);
    });

    it('should have fixed min height on mobile header', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.tabsContainer.minHeight).toBe(46);
    });

    it('should have compact column gap on mobile', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.tabsContainer.columnGap).toBe(8);
    });

    it('should have standard padding on desktop header', () => {
      const styles = getStyles(false, 0, 0, 1024, mockThemedColors as any);
      
      expect(styles.tabsContainer.paddingTop).toBe(7);
      expect(styles.tabsContainer.paddingBottom).toBe(7);
      expect(styles.tabsContainer.paddingHorizontal).toBe(10);
    });

    it('should not have min height on desktop header', () => {
      const styles = getStyles(false, 0, 0, 1024, mockThemedColors as any);
      
      expect(styles.tabsContainer.minHeight).toBeUndefined();
    });
  });

  describe('Accessibility', () => {
    it('should maintain minimum touch target size on mobile', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      // Header min height should be at least 44px for touch targets
      expect(styles.tabsContainer.minHeight).toBeGreaterThanOrEqual(44);
      
      // Padding should provide adequate touch area
      expect(styles.tabsContainer.paddingHorizontal).toBeGreaterThanOrEqual(10);
    });

    it('should have adequate spacing for touch targets', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      // Column gap should provide spacing between interactive elements
      expect(styles.tabsContainer.columnGap).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Visual Hierarchy', () => {
    it('should use light shadow on panel for elevation on mobile', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      // rightPanel has heavy shadow on mobile
      expect(styles.rightPanel.boxShadow).toBe(mockThemedColors.boxShadows.heavy);
    });

    it('should have heavy shadow on panel for elevation', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanel.boxShadow).toBe(mockThemedColors.boxShadows.heavy);
    });

    it('should have proper z-index stacking', () => {
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      // Panel should have z-index
      expect(styles.rightPanel.zIndex).toBe(1000);
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to different mobile widths', () => {
      const smallStyles = getStyles(true, 0, 0, 320, mockThemedColors as any);
      const largeStyles = getStyles(true, 0, 0, 414, mockThemedColors as any);
      
      // Both should have full width
      expect(smallStyles.rightPanel.width).toBe('100%');
      expect(largeStyles.rightPanel.width).toBe('100%');
      
      // Both should have same max height
      expect(smallStyles.rightPanel.maxHeight).toBe('75vh');
      expect(largeStyles.rightPanel.maxHeight).toBe('75vh');
    });

    it('should maintain consistent styling across mobile sizes', () => {
      const styles320 = getStyles(true, 0, 0, 320, mockThemedColors as any);
      const styles375 = getStyles(true, 0, 0, 375, mockThemedColors as any);
      const styles414 = getStyles(true, 0, 0, 414, mockThemedColors as any);
      
      // All should have same border radius
      expect(styles320.rightPanel.borderTopLeftRadius).toBe(20);
      expect(styles375.rightPanel.borderTopLeftRadius).toBe(20);
      expect(styles414.rightPanel.borderTopLeftRadius).toBe(20);

      // All should have same min height
      expect(styles320.tabsContainer.minHeight).toBe(46);
      expect(styles375.tabsContainer.minHeight).toBe(46);
      expect(styles414.tabsContainer.minHeight).toBe(46);
    });
  });

  describe('Platform Consistency', () => {
    it('should have consistent styles on iOS', () => {
      Platform.OS = 'ios';
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanel.position).toBe('absolute');
      expect(styles.rightPanel.bottom).toBe(0);
      expect(styles.rightPanel.maxHeight).toBe('75vh');
    });

    it('should have consistent styles on Android', () => {
      Platform.OS = 'android';
      const styles = getStyles(true, 0, 0, 375, mockThemedColors as any);
      
      expect(styles.rightPanel.position).toBe('absolute');
      expect(styles.rightPanel.bottom).toBe(0);
      expect(styles.rightPanel.maxHeight).toBe('75vh');
    });
  });
});
