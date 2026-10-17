/**
 * #2453 — invalidateSize native-карты: только на изменение размера, каскад
 * коалесцируется, движение карты его не запускает.
 */
import { buildInvalidateSchedulerScript } from '@/components/map-core/leafletWebViewHtml';
import { buildNativeMapHtml } from '@/components/MapPage/Map/nativeMapHtml';

const themeColorsStub = {
  surface: '#ffffff',
  text: '#111111',
  textOnDark: '#ffffff',
  primary: '#0a84ff',
  primaryDark: '#0060df',
  success: '#34c759',
  warning: '#f0a020',
  warningDark: '#b87513',
  textOnPrimary: '#ffffff',
  accent: '#ff6a00',
} as never;

describe('#2453 invalidate scheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a repeated call restarts the cascade instead of stacking a second one', () => {
    const invalidateSize = jest.fn();
    const win: Record<string, unknown> = {};
    const script = buildInvalidateSchedulerScript({
      schedulerName: '__metravelScheduleInvalidate',
      helperName: '__metravelInvalidateMapSize',
      mode: 'window-prop',
      emitRegistration: false,
    });
    new Function('map', 'window', script)({ invalidateSize }, win);
    const schedule = win.__metravelScheduleInvalidate as (stage: string) => void;

    schedule('rn-layout');
    jest.advanceTimersByTime(50);
    schedule('ready');
    jest.advanceTimersByTime(1000);

    // 1 немедленный + 1 немедленный + один полный каскад (80/240/600), а не два.
    expect(invalidateSize).toHaveBeenCalledTimes(5);
    expect(win.__metravelInvalidateCount).toBe(5);
  });

  it('map movement does not trigger the invalidate cascade in the shipped native HTML', () => {
    const html = buildNativeMapHtml({ themeColors: themeColorsStub, markerShadowColor: 'rgba(0,0,0,0.2)' });
    expect(html).not.toMatch(/map\.on\('moveend'[^;]*\n[^;]*ScheduleInvalidate/);
    expect(html).not.toContain("__metravelScheduleInvalidate('moveend')");
    expect(html).not.toContain("__metravelScheduleInvalidate('zoomend')");
    expect(html).not.toContain("__metravelScheduleInvalidate('renderPoints')");
    // Движение кладёт в мост одно дебаунснутое сообщение вьюпорта.
    expect(html).toContain("map.on('moveend', __metravelScheduleViewport);");
    expect(html).toContain("map.on('zoomend', __metravelScheduleViewport);");
    expect(html).not.toContain("type: 'MAP_MOVED'");
  });
});
