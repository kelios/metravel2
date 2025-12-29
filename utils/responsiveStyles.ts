import { StyleSheet, Platform, StatusBar, Dimensions, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { METRICS, getSpacing, getBreakpoint } from '@/constants/layout';
import { useResponsive } from '@/hooks/useResponsive';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function createResponsiveStyleSheet<T extends NamedStyles<T> | NamedStyles<any>>(
  styles: T | NamedStyles<T>,
  options: {
    // Additional options can be added here
    scaleFactor?: number;
  } = {}
): T {
  const { scaleFactor = 1 } = options;
  
  // Scale spacing values if needed
  const scale = (value: number): number => Math.round(value * scaleFactor);
  
  const processedStyles: any = {};
  
  for (const [key, style] of Object.entries(styles)) {
    processedStyles[key] = Object.entries(style).reduce((acc, [prop, value]) => {
      // Handle spacing scale (e.g., s, m, l) or direct numbers
      if (typeof value === 'string' && value in METRICS.spacing) {
        return { ...acc, [prop]: getSpacing(value as any) };
      }
      
      // Handle responsive values (e.g., { phone: 16, tablet: 24 })
      if (typeof value === 'object' && value !== null) {
        return { ...acc, [prop]: value };
      }
      
      // Scale numeric values if needed
      if (typeof value === 'number' && prop !== 'flex' && prop !== 'opacity' && prop !== 'zIndex') {
        return { ...acc, [prop]: scale(value) };
      }
      
      return { ...acc, [prop]: value };
    }, {} as any);
  }
  
  return StyleSheet.create(processedStyles);
}

/**
 * Hook to get responsive styles based on screen size
 */
export function useResponsiveStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  styles: T | NamedStyles<T>
): T {
  const responsive = useResponsive();
  
  return StyleSheet.create(
    Object.entries(styles).reduce((acc, [key, style]) => {
      acc[key] = Object.entries(style).reduce((styleAcc, [prop, value]) => {
        // Handle responsive values (e.g., { phone: 16, tablet: 24 })
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          if ('phone' in value || 'tablet' in value || 'desktop' in value) {
            const responsiveValue = responsive.isDesktop ? value.desktop :
                                 responsive.isTablet ? value.tablet :
                                 value.phone;
            
            if (responsiveValue !== undefined) {
              styleAcc[prop] = responsiveValue;
            }
            return styleAcc;
          }
        }
        
        // Handle spacing scale (e.g., 's', 'm', 'l')
        if (typeof value === 'string' && value in METRICS.spacing) {
          styleAcc[prop] = getSpacing(value as any);
          return styleAcc;
        }
        
        // Handle direct values
        styleAcc[prop] = value;
        return styleAcc;
      }, {} as any);
      
      return acc;
    }, {} as any)
  );
}

/**
 * Get safe area insets for the current device
 */
export function useSafeAreaInsets() {
  const { isIphoneX } = useDevice();
  
  return {
    top: Platform.OS === 'ios' ? (isIphoneX ? 44 : 20) : StatusBar.currentHeight || 0,
    bottom: Platform.OS === 'ios' ? (isIphoneX ? 34 : 0) : 0,
    left: 0,
    right: 0,
  };
}

/**
 * Get device information
 */
function useDevice() {
  const { width, height } = Dimensions.get('window');
  const aspectRatio = height / width;
  
  // iPhone X, XS, 11 Pro, 12 Mini, 13 Mini
  const isIphoneX = 
    Platform.OS === 'ios' && 
    !(Platform as any).isPad && 
    !(Platform as any).isTV && 
    (height === 812 || width === 812 || height === 896 || width === 896 ||
     height === 844 || width === 844 || height === 926 || width === 926);
  
  // iPhone 12/13/14, 12/13/14 Pro, 12/13/14 Pro Max
  const isIphone12 = 
    Platform.OS === 'ios' && 
    !(Platform as any).isPad && 
    !(Platform as any).isTV && 
    (height === 844 || width === 844 || height === 926 || width === 926);
  
  return {
    isIphoneX,
    isIphone12,
    isTablet: (Platform.OS === 'ios' && (Platform as any).isPad) || 
             (Platform.OS === 'android' && (width >= 600 || (width > height && width >= 600 && height >= 480))),
    isAndroid: Platform.OS === 'android',
    isIOS: Platform.OS === 'ios',
    aspectRatio,
    isSmallDevice: width < 375,
    isLargeDevice: width >= 414,
  };
}

/**
 * Get responsive font size based on screen width
 */
export function responsiveFontSize(baseSize: number, factor = 0.5): number {
  const { width } = Dimensions.get('window');
  return baseSize + (width / getBreakpoint('desktop')) * factor;
}

/**
 * Get responsive padding/margin based on screen size
 */
export function responsiveSpacing(
  base: number,
  options: {
    scaleFactor?: number;
    min?: number;
    max?: number;
  } = {}
): number {
  const { scaleFactor = 0.5, min, max } = options;
  const { width } = Dimensions.get('window');
  const scaledValue = base + (width / getBreakpoint('desktop')) * scaleFactor * base;
  
  if (min !== undefined && scaledValue < min) return min;
  if (max !== undefined && scaledValue > max) return max;
  return Math.round(scaledValue);
}

/**
 * Get responsive width/height based on screen size
 */
export function responsiveSize(
  base: number,
  options: {
    min?: number;
    max?: number;
    factor?: number;
  } = {}
): number {
  const { min, max, factor = 0.1 } = options;
  const { width } = Dimensions.get('window');
  const scaledValue = base + (width / getBreakpoint('desktop')) * factor * base;
  
  if (min !== undefined && scaledValue < min) return min;
  if (max !== undefined && scaledValue > max) return max;
  return Math.round(scaledValue);
}
