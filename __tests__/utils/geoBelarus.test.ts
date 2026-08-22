import { isBelarusByCoords } from '@/utils/geoBelarus';

describe('isBelarusByCoords', () => {
    it.each([
        ['Минск', 53.9, 27.56],
        ['Витебск', 55.1904, 30.2049],
    ])('recognizes %s inside Belarus', (_city, lat, lng) => {
        expect(isBelarusByCoords(lat, lng)).toBe(true);
    });

    it('does not include Vilnius from the overlapping Belarus bbox', () => {
        expect(isBelarusByCoords(54.6872, 25.2797)).toBe(false);
    });
});
