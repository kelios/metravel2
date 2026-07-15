import {
  getPlacePopupCoordinate,
  getPlacePopupSubtitle,
} from '@/components/MapPage/Map/PlacePopupCard/placePopupModel';

describe('placePopupModel', () => {
  it('shortens long bottom-card subtitles without changing desktop text', () => {
    const subtitle = 'Podzamcze, Old Town, Краков, Малопольское, Польша';

    expect(getPlacePopupSubtitle(subtitle, true)).toBe('Краков, Малопольское, Польша');
    expect(getPlacePopupSubtitle(subtitle, false)).toBe(subtitle);
  });

  it('formats bottom-card coordinates while preserving invalid and desktop values', () => {
    expect(getPlacePopupCoordinate('50.0547001; 19.9348809', true)).toBe('50.05470, 19.93488');
    expect(getPlacePopupCoordinate('unknown', true)).toBe('unknown');
    expect(getPlacePopupCoordinate('50.0547001, 19.9348809', false)).toBe('50.0547001, 19.9348809');
  });
});
