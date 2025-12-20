import { buildAddressFromGeocode, matchCountryId } from '@/components/travel/WebMapComponent';

describe('WebMapComponent helpers', () => {
    const countrylist = [
        { country_id: 10, title_ru: 'Франция', title_en: 'France', title: 'France' },
        { country_id: 11, title_ru: 'Швейцария', title_en: 'Switzerland', title: 'Switzerland' },
        { country_id: 12, title_ru: 'Германия', title_en: 'Germany', title: 'Germany' },
    ];

    describe('matchCountryId', () => {
        it('matches russian names against title_ru', () => {
            expect(matchCountryId('Франция', countrylist)).toBe(10);
            expect(matchCountryId('Швейцария', countrylist)).toBe(11);
        });

        it('matches english names and fallbacks', () => {
            expect(matchCountryId('France, metropolitan France', countrylist)).toBe(10);
            expect(matchCountryId('germany', countrylist)).toBe(12);
            expect(matchCountryId(' Switzerland ', countrylist)).toBe(11);
        });

        it('returns null when nothing matches', () => {
            expect(matchCountryId('Atlantis', countrylist)).toBeNull();
            expect(matchCountryId('', countrylist)).toBeNull();
        });
    });

    describe('buildAddressFromGeocode', () => {
        const latlng = { lat: 48.8566, lng: 2.3522 };
        const geocodeData = {
            display_name: 'Paris',
            address: { road: 'Rue de Rivoli', city: 'Paris', country: 'France' },
            localityInfo: {
                locality: [{ name: 'Paris' }],
                administrative: [
                    { order: 2, name: 'Île-de-France' },
                    { order: 4, name: 'Paris Region' },
                ],
            },
        };

        it('prefers matchedCountry title_ru in the country slot', () => {
            const address = buildAddressFromGeocode(geocodeData, latlng, countrylist[0]);
            expect(address).toContain('Франция');
        });

        it('concatenates base address, locality and admin names with separators', () => {
            const address = buildAddressFromGeocode(geocodeData, latlng, countrylist[0]);
            expect(address).toContain('Paris');
            expect(address).toContain('Île-de-France');
            expect(address.split(' · ').length).toBeGreaterThanOrEqual(2);
        });
    });
});
