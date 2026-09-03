import { renderHook, act, waitFor } from '@testing-library/react-native';

import { translate as i18nT } from '@/i18n';

const mockBigDataCloudReverse = jest.fn();
const mockNominatimReverse = jest.fn();

jest.mock('@/api/external/bigdatacloud', () => ({
  bigDataCloudReverse: (...args: unknown[]) => mockBigDataCloudReverse(...args),
}));

jest.mock('@/api/external/nominatim', () => ({
  nominatimReverse: (...args: unknown[]) => mockNominatimReverse(...args),
}));

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    createPoint: jest.fn(),
    updatePoint: jest.fn(),
  },
}));

import { usePointsManualForm } from '@/components/UserPoints/usePointsManualForm';

const NEW_POINT_LABEL = i18nT('map:components.UserPoints.usePointsManualForm.novaya_tochka_4d3f685d');

const COORDS = { lat: 53.451, lng: 26.473 };

const renderManualForm = () =>
  renderHook(() =>
    usePointsManualForm({
      blurActiveElementForModal: jest.fn(),
      setShowActions: jest.fn(),
      resolveCategoryIdsForEdit: jest.fn(() => []),
      queryClient: { setQueryData: jest.fn(), invalidateQueries: jest.fn() } as any,
    })
  );

/** Ответ геокодера отдаётся только вторым источником — bigdatacloud «падает». */
const answerWith = (payload: unknown) => {
  mockBigDataCloudReverse.mockResolvedValue({ ok: false });
  mockNominatimReverse.mockResolvedValue({ ok: true, json: async () => payload });
};

describe('usePointsManualForm — автоимя ручной точки', () => {
  beforeEach(() => {
    mockBigDataCloudReverse.mockReset();
    mockNominatimReverse.mockReset();
  });

  it('берёт имя объекта тем же разбором, что и точки маршрута', async () => {
    answerWith({
      address: {
        tourism: 'Мирский замок',
        village: 'Мир',
        state: 'Гродненская область',
        country: 'Беларусь',
      },
      display_name: 'Мирский замок, Мир, Гродненская область, Беларусь',
    });

    const { result } = renderManualForm();
    await act(async () => {
      result.current.handleMapPress(COORDS);
    });

    await waitFor(() => expect(result.current.manualName).toBe('Мирский замок'));
  });

  it('без имени объекта подписывает точку населённым пунктом, а не номером дома', async () => {
    answerWith({
      address: { house_number: '332', village: 'Soblówka', country: 'Polska' },
      display_name: '332, Soblówka, Polska',
    });

    const { result } = renderManualForm();
    await act(async () => {
      result.current.handleMapPress(COORDS);
    });

    await waitFor(() => expect(result.current.manualName).toBe('Soblówka'));
  });

  // Прежняя реализация в этой ветке отдавала строку координат из
  // `buildAddressFromGeocode` — пользователь получал точку с именем
  // «53.451, 26.473» (#1736).
  it('пустой ответ геокодера даёт «Новая точка», а не строку координат', async () => {
    answerWith({ address: {} });

    const { result } = renderManualForm();
    await act(async () => {
      result.current.handleMapPress(COORDS);
    });

    await waitFor(() => expect(result.current.manualName).toBe(NEW_POINT_LABEL));
    expect(result.current.manualName).not.toBe(`${COORDS.lat}, ${COORDS.lng}`);
  });

  it('не перебивает имя, которое пользователь уже правил руками', async () => {
    // Геокодер отвечает ПОСЛЕ правки имени — иначе проверялся бы не гейт
    // `manualNameTouchedRef`, а порядок промисов.
    let releaseGeocode: (() => void) | undefined;
    const geocodePending = new Promise<void>((resolve) => {
      releaseGeocode = resolve;
    });
    mockBigDataCloudReverse.mockResolvedValue({ ok: false });
    mockNominatimReverse.mockResolvedValue({
      ok: true,
      json: async () => {
        await geocodePending;
        return { address: { tourism: 'Мирский замок' } };
      },
    });

    const { result } = renderManualForm();
    act(() => {
      result.current.handleMapPress(COORDS);
    });
    act(() => {
      result.current.setManualNameTouched(true);
      result.current.setManualName('Моя точка');
    });

    await act(async () => {
      releaseGeocode?.();
      await geocodePending;
    });

    await waitFor(() => expect(mockNominatimReverse).toHaveBeenCalled());
    expect(result.current.manualName).toBe('Моя точка');
  });
});
