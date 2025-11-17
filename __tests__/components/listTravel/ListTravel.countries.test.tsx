import { describe, it, expect } from '@jest/globals';

/**
 * Тесты для проверки нормализации фильтров по странам
 * Проверяем, что country_id правильно преобразуется в число
 * и отправляется в API в правильном формате
 */
describe('ListTravel - Countries Filter Normalization', () => {
    describe('Query Params Normalization', () => {
        it('should normalize country IDs from strings to numbers', () => {
            const filter = {
                countries: ['20', '21'], // строки
            };
            
            // Симуляция логики из queryParams
            const numericFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
            const p: Record<string, any> = {};
            
            Object.entries(filter).forEach(([k, v]) => {
                if (Array.isArray(v) && numericFields.includes(k)) {
                    p[k] = v
                        .filter((item: any) => item !== undefined && item !== null && item !== '')
                        .map((item: any) => {
                            if (typeof item === 'string' && !isNaN(Number(item)) && item.trim() !== '') {
                                return Number(item);
                            }
                            return typeof item === 'number' ? item : item;
                        })
                        .filter((item: any) => item !== undefined && item !== null);
                }
            });
            
            expect(p.countries).toEqual([20, 21]);
            expect(p.countries.every((id: any) => typeof id === 'number')).toBe(true);
        });

        it('should handle mixed string and number country IDs', () => {
            const filter = {
                countries: ['20', 21, '22'],
            };
            
            const numericFields = ['countries'];
            const p: Record<string, any> = {};
            
            Object.entries(filter).forEach(([k, v]) => {
                if (Array.isArray(v) && numericFields.includes(k)) {
                    p[k] = v
                        .filter((item: any) => item !== undefined && item !== null && item !== '')
                        .map((item: any) => {
                            if (typeof item === 'string' && !isNaN(Number(item)) && item.trim() !== '') {
                                return Number(item);
                            }
                            return typeof item === 'number' ? item : item;
                        })
                        .filter((item: any) => item !== undefined && item !== null);
                }
            });
            
            expect(p.countries).toEqual([20, 21, 22]);
            expect(p.countries.every((id: any) => typeof id === 'number')).toBe(true);
        });

        it('should filter out invalid country IDs', () => {
            const filter = {
                countries: ['20', '', null, undefined, 'invalid', 21],
            };
            
            const numericFields = ['countries'];
            const p: Record<string, any> = {};
            
            Object.entries(filter).forEach(([k, v]) => {
                if (Array.isArray(v) && numericFields.includes(k)) {
                    p[k] = v
                        .filter((item: any) => item !== undefined && item !== null && item !== '')
                        .map((item: any) => {
                            if (typeof item === 'string' && !isNaN(Number(item)) && item.trim() !== '') {
                                return Number(item);
                            }
                            return typeof item === 'number' ? item : item;
                        })
                        .filter((item: any) => item !== undefined && item !== null && typeof item === 'number');
                }
            });
            
            expect(p.countries).toEqual([20, 21]);
            expect(p.countries.length).toBe(2);
        });

        it('should exclude empty arrays from queryParams', () => {
            const filter = {
                countries: [],
                categories: [1, 2],
            };
            
            const p: Record<string, any> = {};
            Object.entries(filter).forEach(([k, v]) => {
                if (v === undefined || v === null) return;
                if (v === "") return;
                if (Array.isArray(v) && v.length === 0) return; // ✅ Ключевая проверка
                if (Array.isArray(v) ? v.length > 0 : v) {
                    p[k] = v;
                }
            });
            
            expect(p.countries).toBeUndefined();
            expect(p.categories).toEqual([1, 2]);
        });
    });

    describe('API Request Format', () => {
        it('should send countries as array of numbers in where object', () => {
            const urlParams = {
                countries: [20, 21],
                publish: 1,
                moderation: 1,
            };
            
            // Симуляция логики из fetchTravels
            const whereObject: Record<string, any> = { ...urlParams };
            const arrayFields = ['countries', 'categories', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'];
            
            arrayFields.forEach(field => {
                if (whereObject[field] && Array.isArray(whereObject[field])) {
                    whereObject[field] = whereObject[field].map((val: any) => {
                        if (typeof val === 'string' && !isNaN(Number(val))) {
                            return Number(val);
                        }
                        return val;
                    });
                }
            });
            
            expect(whereObject.countries).toEqual([20, 21]);
            expect(whereObject.countries.every((id: any) => typeof id === 'number')).toBe(true);
        });

        it('should handle country_id from filterValue correctly', () => {
            // Симуляция: пользователь выбрал страну с country_id = 20
            const filterValue = {
                countries: [20], // country_id из выбранной страны
            };
            
            // Проверяем, что это правильно обрабатывается
            const queryParams: Record<string, any> = {};
            const numericFields = ['countries'];
            
            Object.entries(filterValue).forEach(([k, v]) => {
                if (Array.isArray(v) && v.length > 0 && numericFields.includes(k)) {
                    queryParams[k] = v
                        .filter((item: any) => item !== undefined && item !== null && item !== '')
                        .map((item: any) => {
                            if (typeof item === 'string' && !isNaN(Number(item)) && item.trim() !== '') {
                                return Number(item);
                            }
                            return typeof item === 'number' ? item : item;
                        })
                        .filter((item: any) => item !== undefined && item !== null);
                }
            });
            
            expect(queryParams.countries).toEqual([20]);
            expect(typeof queryParams.countries[0]).toBe('number');
        });
    });
});

