import { matchCountryId, buildAddressFromGeocode } from '@/components/travel/WebMapComponent';

describe('WebMapComponent helpers', () => {
    describe('matchCountryId', () => {
        it('should return country ID when matching by code', () => {
            const countryList = [
                { country_id: 1, code: 'US', title_ru: 'США' },
                { country_id: 2, code: 'RU', title_ru: 'Россия' },
            ];
            
            expect(matchCountryId('США', countryList, 'US')).toBe(1);
            expect(matchCountryId('Россия', countryList, 'RU')).toBe(2);
        });

        it('should return country ID when matching by name', () => {
            const countryList = [
                { country_id: 1, title_ru: 'США', title_en: 'USA' },
                { country_id: 2, title_ru: 'Россия', title_en: 'Russia' },
            ];
            
            expect(matchCountryId('США', countryList)).toBe(1);
            expect(matchCountryId('Россия', countryList)).toBe(2);
        });

        it('should return null when no match found', () => {
            const countryList = [
                { country_id: 1, title_ru: 'США' },
                { country_id: 2, title_ru: 'Россия' },
            ];
            
            expect(matchCountryId('Франция', countryList)).toBeNull();
            expect(matchCountryId('', countryList)).toBeNull();
        });

        it('should handle various code formats', () => {
            const countryList = [
                { country_id: 1, iso2: 'US', alpha2: 'US' },
                { country_id: 2, countryCode: 'RU', alpha_2: 'RU' },
            ];
            
            expect(matchCountryId('США', countryList, 'US')).toBe(1);
            expect(matchCountryId('Россия', countryList, 'RU')).toBe(2);
        });
    });

    describe('buildAddressFromGeocode', () => {
        it('should build address from BigDataCloud format', () => {
            const geocodeData = {
                address: {
                    road: 'Main St',
                    house_number: '123'
                },
                city: 'New York',
                principalSubdivision: 'NY',
                countryName: 'USA'
            };
            const latlng = { lat: 40.7128, lng: -74.0060 };
            
            const result = buildAddressFromGeocode(geocodeData, latlng);
            
            expect(result).toContain('Main St 123');
            expect(result).toContain('New York');
            expect(result).toContain('NY');
            expect(result).toContain('USA');
        });

        it('should build address from Nominatim format', () => {
            const geocodeData = {
                address: {
                    road: 'Lenin St',
                    house_number: '45',
                    city: 'Moscow',
                    state: 'Moscow Oblast',
                    country: 'Russia'
                }
            };
            const latlng = { lat: 55.7558, lng: 37.6173 };
            
            const result = buildAddressFromGeocode(geocodeData, latlng);
            
            expect(result).toContain('Lenin St 45');
            expect(result).toContain('Moscow');
            expect(result).toContain('Moscow Oblast');
            expect(result).toContain('Russia');
        });

        it('should handle minimal data', () => {
            const geocodeData = {
                city: 'Berlin'
            };
            const latlng = { lat: 52.5200, lng: 13.4050 };
            
            const result = buildAddressFromGeocode(geocodeData, latlng);
            
            expect(result).toContain('Berlin');
        });

        it('should use matched country when provided', () => {
            const geocodeData = {
                city: 'Paris'
            };
            const latlng = { lat: 48.8566, lng: 2.3522 };
            const matchedCountry = { title_ru: 'Франция' };
            
            const result = buildAddressFromGeocode(geocodeData, latlng, matchedCountry);
            
            expect(result).toContain('Paris');
            expect(result).toContain('Франция');
        });
    });
});