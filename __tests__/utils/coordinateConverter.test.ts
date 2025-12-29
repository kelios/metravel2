import { CoordinateConverter } from '@/utils/coordinateConverter';

describe('CoordinateConverter.fromLooseString', () => {
  it('parses comma and semicolon separated strings', () => {
    expect(CoordinateConverter.fromLooseString('50.0619474, 19.9368564')).toEqual({
      lat: 50.0619474,
      lng: 19.9368564,
    });
    expect(CoordinateConverter.fromLooseString('50.0619474;19.9368564')).toEqual({
      lat: 50.0619474,
      lng: 19.9368564,
    });
  });

  it('returns null for invalid coordinates', () => {
    expect(CoordinateConverter.fromLooseString('not-a-coord')).toBeNull();
    expect(CoordinateConverter.fromLooseString('123,200')).toBeNull();
  });
});
