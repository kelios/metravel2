/**
 * #1440: тост «Маршрут построен» висит над той же панелью маршрута и обязан
 * печатать то же число, что и она, — через общий форматтер расстояния, а не
 * через toFixed с английской точкой.
 */

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
  showToastMessage: jest.fn(),
  setToastDockInset: jest.fn(),
}));

import { showRouteBuiltToast } from '@/utils/mapToasts';
import { showToast } from '@/utils/toast';
import { i18n } from '@/i18n';

const showToastMock = showToast as jest.MockedFunction<typeof showToast>;
const lastText2 = () => (showToastMock.mock.calls.at(-1)?.[0] as { text2?: string }).text2;

describe('showRouteBuiltToast', () => {
  beforeEach(() => {
    showToastMock.mockClear();
  });

  afterEach(async () => {
    await i18n.changeLanguage('ru');
  });

  it('печатает дробный километр по нормам локали интерфейса', () => {
    showRouteBuiltToast(11.4, 27);

    expect(lastText2()).toBe('11,4 км • 27 мин');
  });

  it('проставляет разряды у больших расстояний', () => {
    showRouteBuiltToast(2800, 2400);

    // #1468: разряды нужны обоим числам строки — и расстоянию, и минутам.
    expect(lastText2()).toBe('2\u00a0800 км • 2\u00a0400 мин');
  });

  it('переключается на метры для коротких маршрутов', () => {
    showRouteBuiltToast(0.8, 10);

    expect(lastText2()).toBe('800 м • 10 мин');
  });

  it('на EN печатает английские разделители', async () => {
    await i18n.changeLanguage('en');
    showRouteBuiltToast(11.4, 27);

    expect(lastText2()).toBe('11.4 km • 27 min');
  });
});
