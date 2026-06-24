import { Platform } from 'react-native';
import {
  buildGoogleMapsUrl,
  buildOrganicMapsUrl,
  buildWazeUrl,
} from '@/components/MapPage/Map/mapLinks';

describe('mapLinks', () => {
  const originalPlatform = Platform.OS;
  afterEach(() => {
    (Platform.OS as any) = originalPlatform;
  });

  describe('buildOrganicMapsUrl (#580)', () => {
    it('native: emits the Organic Maps om:// deep-link with marker coords', () => {
      (Platform.OS as any) = 'android';
      expect(buildOrganicMapsUrl('53.9006, 27.559')).toBe('om://map?v=1&ll=53.9006,27.559');
    });

    it('native: appends an encoded name when provided', () => {
      (Platform.OS as any) = 'android';
      expect(buildOrganicMapsUrl('53.9006,27.559', 'Площадь Победы')).toBe(
        'om://map?v=1&ll=53.9006,27.559&n=%D0%9F%D0%BB%D0%BE%D1%89%D0%B0%D0%B4%D1%8C%20%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D1%8B',
      );
    });

    it('native: never returns a bare geo: scheme (would open the wrong app)', () => {
      (Platform.OS as any) = 'android';
      expect(buildOrganicMapsUrl('53.9006,27.559').startsWith('geo:')).toBe(false);
    });

    it('web: keeps the HTTPS omaps.app URL', () => {
      (Platform.OS as any) = 'web';
      expect(buildOrganicMapsUrl('53.9006,27.559')).toBe('https://omaps.app/53.9006,27.559');
    });

    it('returns empty string for invalid coords', () => {
      (Platform.OS as any) = 'android';
      expect(buildOrganicMapsUrl('not-a-coord')).toBe('');
    });
  });

  describe('platform parity for other navigators', () => {
    it('native Google Maps uses the HTTPS marker URL', () => {
      (Platform.OS as any) = 'android';
      expect(buildGoogleMapsUrl('53.9,27.5')).toBe('https://www.google.com/maps/place/53.9,27.5');
    });

    it('native Waze uses the waze:// scheme', () => {
      (Platform.OS as any) = 'android';
      expect(buildWazeUrl('53.9,27.5')).toBe('waze://?ll=53.9,27.5');
    });
  });
});
