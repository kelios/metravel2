import { renderHook, act, waitFor } from '@testing-library/react-native';

import { usePointListAddPointModel } from '@/components/travel/hooks/usePointListAddPointModel';

const mockCreatePoint = jest.fn();
const mockShowToast = jest.fn();
const mockInvalidateQueries = jest.fn();
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
  }),
}));

describe('usePointListAddPointModel', () => {
  beforeEach(() => {
    mockCreatePoint.mockReset();
    mockShowToast.mockReset();
    mockInvalidateQueries.mockReset();
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

  it('creates point, preserves payload fields and invalidates user points query', async () => {
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
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        text1: 'Точка добавлена в «Мои точки»',
      })
    );
  });
});
