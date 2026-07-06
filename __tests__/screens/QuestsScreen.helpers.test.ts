import { COUNTRY_NAMES } from '@/screens/tabs/QuestsScreen.helpers';

describe('QuestsScreen helpers', () => {
  it('maps quest country codes shown in the catalog to country names', () => {
    expect(COUNTRY_NAMES.DE).toBe('Германия');
    expect(COUNTRY_NAMES.FR).toBe('Франция');
    expect(COUNTRY_NAMES.NL).toBe('Нидерланды');
  });
});
