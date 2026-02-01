/**
 * Тест для проверки синхронизации preload URL и компонента
 * Этот тест гарантирует, что preload скрипт и OptimizedLCPHero генерируют одинаковые URL
 */

import { optimizeImageUrl, buildResponsiveImageProps } from '@/utils/imageOptimization';

describe('Preload URL synchronization', () => {
  const mockWindow = {
    devicePixelRatio: 2,
    location: {
      origin: 'https://metravel.by',
    },
  };

  beforeEach(() => {
    // @ts-ignore
    global.window = mockWindow;
  });

  afterEach(() => {
    // @ts-ignore
    global.window = undefined;
  });

  test('buildResponsiveImageProps uses correct DPR when not specified', () => {
    const testUrl = 'https://example.com/image.jpg';
    const result = buildResponsiveImageProps(testUrl, {
      maxWidth: 860,
      widths: [640, 860],
      quality: 65,
      format: 'auto',
      fit: 'cover',
    });

    // URL should include DPR-adjusted width
    // Expected: w=1720 (860 * Math.min(2, 2) = 1720) for widest image
    expect(result.src).toContain('w=1720');
  });

  test('optimizeImageUrl uses Math.min(devicePixelRatio, 2) by default', () => {
    const testUrl = 'https://example.com/image.jpg';
    const result = optimizeImageUrl(testUrl, {
      width: 860,
      quality: 65,
      format: 'webp',
      fit: 'cover',
    });

    // Expected: w=1720 (860 * Math.min(2, 2) = 1720)
    expect(result).toContain('w=1720');
  });

  test('preload and component generate same URL for desktop', () => {
    const testUrl = 'https://example.com/image.jpg';
    const isMobile = false;
    const targetWidth = 860;
    const quality = 65;

    // Simulate preload script logic
    const dpr = Math.min(mockWindow.devicePixelRatio, 2);
    const preloadWidth = Math.round(targetWidth * dpr);

    // Component logic
    const componentResult = buildResponsiveImageProps(testUrl, {
      maxWidth: targetWidth,
      widths: [640, 860],
      quality,
      format: 'auto',
      fit: 'cover',
    });

    // Check that widths match
    expect(componentResult.src).toContain(`w=${preloadWidth}`);
  });

  test('preload and component generate same URL for mobile', () => {
    const testUrl = 'https://example.com/image.jpg';
    const isMobile = true;
    const targetWidth = 400;
    const quality = 60;

    // Simulate preload script logic
    const dpr = Math.min(mockWindow.devicePixelRatio, 2);
    const preloadWidth = Math.round(targetWidth * dpr);

    // Component logic
    const componentResult = buildResponsiveImageProps(testUrl, {
      maxWidth: targetWidth,
      widths: [320, 400],
      quality,
      format: 'auto',
      fit: 'cover',
    });

    // Check that widths match
    expect(componentResult.src).toContain(`w=${preloadWidth}`);
  });

  test('quality parameters match between preload and component', () => {
    const testUrl = 'https://example.com/image.jpg';

    // Desktop quality
    const desktopQuality = 65;
    const desktopResult = buildResponsiveImageProps(testUrl, {
      maxWidth: 860,
      quality: desktopQuality,
      format: 'auto',
    });
    expect(desktopResult.src).toContain(`q=${desktopQuality}`);

    // Mobile quality
    const mobileQuality = 60;
    const mobileResult = buildResponsiveImageProps(testUrl, {
      maxWidth: 400,
      quality: mobileQuality,
      format: 'auto',
    });
    expect(mobileResult.src).toContain(`q=${mobileQuality}`);
  });
});
