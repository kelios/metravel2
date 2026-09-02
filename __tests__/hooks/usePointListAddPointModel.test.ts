import { renderHook, act, waitFor } from '@testing-library/react-native';

import { usePointListAddPointModel } from '@/components/travel/hooks/usePointListAddPointModel';

const mockCreatePoint = jest.fn();
const mockShowToast = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSetQueryData = jest.fn();
const mockCancelQueries = jest.fn(async () => undefined);
const mockUseAuth = jest.fn();

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    createPoint: (...args: any[]) => mockCreatePoint(...args),
  },
}));

jest.mock('@/utils/toast', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: (...args: any[]) => mockInvalidateQueries(...args),
    setQueryData: (...args: any[]) => mockSetQueryData(...args),
    cancelQueries: (...args: any[]) => mockCancelQueries(...args),
  }),
}));

describe('usePointListAddPointModel', () => {
  beforeEach(() => {
    mockCreatePoint.mockReset();
    mockShowToast.mockReset();
    mockInvalidateQueries.mockReset();
    mockSetQueryData.mockReset();
    mockCancelQueries.mockClear();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ isAuthenticated: true, authReady: true });
  });

  it('shows auth toast when user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, authReady: true });

    const { result } = renderHook(() =>
      usePointListAddPointModel({
        baseUrl: 'https://example.com/travel',
        categoryIdToName: new Map(),
        categoryNameToIds: new Map(),
        travelName: 'Маршрут',
      })
    );

    await act(async () => {
      await result.current.handleAddPoint({
        id: '1',
        address: 'Минск',
        coord: '53.9,27.56',
      });
    });

    expect(mockCreatePoint).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        text1: 'Авторизуйтесь, чтобы сохранять точки',
      })
    );
  });

  it('shows coord parse toast when coordinates are invalid', async () => {
    const { result } = renderHook(() =>
      usePointListAddPointModel({
        baseUrl: 'https://example.com/travel',
        categoryIdToName: new Map(),
        categoryNameToIds: new Map(),
        travelName: 'Маршрут',
      })
    );

    await act(async () => {
      await result.current.handleAddPoint({
        id: '2',
        address: 'Минск',
        coord: 'bad',
      });
    });

    expect(mockCreatePoint).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        text1: 'Невозможно распознать координаты',
      })
    );
  });

  it('падает на рефетч коллекции, когда сервер не вернул координаты новой точки', async () => {
    mockCreatePoint.mockResolvedValue({ id: 11 });

    const { result } = renderHook(() =>
      usePointListAddPointModel({
        baseUrl: 'https://example.com/travel',
        categoryIdToName: new Map([
          ['10', 'Озёра'],
          ['99', 'Беларусь'],
        ]),
        categoryNameToIds: new Map([
          ['озёра', ['10']],
          ['беларусь', ['99']],
        ]),
        travelName: 'Маршрут',
      })
    );

    await act(async () => {
      await result.current.handleAddPoint({
        id: '3',
        address: 'Минск, Беларусь',
        coord: '53.9,27.56',
        description: 'Описание',
        articleUrl: 'https://example.com/article',
        travelImageThumbUrl: 'https://example.com/photo.jpg',
        categoryName: 'Озёра, Беларусь',
      });
    });

    await waitFor(() => {
      expect(mockCreatePoint).toHaveBeenCalledTimes(1);
    });

    expect(mockCreatePoint).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Минск, Беларусь',
        address: 'Минск, Беларусь',
        description: 'Описание',
        latitude: 53.9,
        longitude: 27.56,
        category: 'Озёра',
        categoryIds: ['10'],
        photo: 'https://example.com/photo.jpg',
        tags: {
          travelUrl: 'https://example.com/travel',
          articleUrl: 'https://example.com/article',
          travelName: 'Маршрут',
        },
      })
    );

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['userPointsAll'] });
  });

  /**
   * #1706: коллекция точек читается постранично (серверный потолок 200), поэтому
   * безусловный рефетч после каждого добавления стоил бы ceil(count/200)
   * запросов. Клиентский лимитер считает `/user-points/` одним ключом
   * (`utils/rateLimiter.ts:58`, 60 запросов в минуту), и серия сохранений
   * упиралась бы в ложное 429. Серверная запись уже легла в кэш — рефетч лишний.
   */
  /**
   * Поле `color` на бэке — CharField(max_length=16). На web `DESIGN_TOKENS` отдаёт
   * `var(--color-travelPoint, #ff922b)` (33 символа), из-за чего POST падал 400
   * и «Сохранить» в списке точек путешествия не работало вовсе.
   */
  it('шлёт цвет сырым hex, а не CSS-переменной темы', async () => {
    mockCreatePoint.mockResolvedValue({ id: 12, latitude: 53.9, longitude: 27.56 });

    const { result } = renderHook(() =>
      usePointListAddPointModel({
        baseUrl: 'https://example.com/travel',
        categoryIdToName: new Map(),
        categoryNameToIds: new Map(),
        travelName: 'Маршрут',
      })
    );

    await act(async () => {
      await result.current.handleAddPoint({ id: '4', address: 'Минск', coord: '53.9,27.56' });
    });

    await waitFor(() => expect(mockCreatePoint).toHaveBeenCalledTimes(1));
    const { color } = mockCreatePoint.mock.calls[0][0];
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(color.length).toBeLessThanOrEqual(16);
  });

  it('не рефетчит всю коллекцию, когда серверная запись уже записана в кэш', async () => {
    mockCreatePoint.mockResolvedValue({ id: 11, latitude: 53.9, longitude: 27.56 });

    const { result } = renderHook(() =>
      usePointListAddPointModel({
        baseUrl: 'https://example.com/travel',
        categoryIdToName: new Map(),
        categoryNameToIds: new Map(),
        travelName: 'Маршрут',
      })
    );

    await act(async () => {
      await result.current.handleAddPoint({
        id: '3',
        address: 'Минск, Беларусь',
        coord: '53.9,27.56',
      });
    });

    await waitFor(() => {
      expect(mockCreatePoint).toHaveBeenCalledTimes(1);
    });

    expect(mockSetQueryData).toHaveBeenCalledWith(['userPointsAll'], expect.any(Function));
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
    // Летящее постраничное чтение обязано быть отменено ДО оптимистичной записи,
    // иначе его ответ затрёт только что созданную точку (#1706).
    expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: ['userPointsAll'] });
    expect(mockCancelQueries.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetQueryData.mock.invocationCallOrder[0],
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        text1: 'Точка добавлена в «Мои точки»',
      })
    );
  });
});
