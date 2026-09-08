// #1839 — клиент чеклиста снаряжения поверх контракта бэкенда #1837
// (`/api/trips/planned/{id}/gear/`, статусы buy|owned|packed).
import {
  addTripGearItem,
  applyTripGearTemplate,
  deleteTripGearItem,
  fetchTripGear,
  mapGearItem,
  updateTripGearItem,
} from '@/api/plannedTripsGear';

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const { apiClient } = jest.requireMock('@/api/client') as {
  apiClient: { get: jest.Mock; post: jest.Mock; patch: jest.Mock; delete: jest.Mock };
};

const serverItem = {
  id: 12,
  title: 'Треккинговые ботинки',
  category: 'footwear',
  status: 'owned',
  sort_order: 3,
  created_at: '2026-09-06T10:00:00Z',
  updated_at: '2026-09-06T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('чтение чеклиста', () => {
  it('читает приватный список поездки и переводит его в доменную форму', async () => {
    apiClient.get.mockResolvedValue([serverItem]);

    await expect(fetchTripGear(8001)).resolves.toEqual([
      { id: 12, title: 'Треккинговые ботинки', category: 'footwear', status: 'owned', sortOrder: 3 },
    ]);
    expect(apiClient.get).toHaveBeenCalledWith('/trips/planned/8001/gear/');
  });

  it('не теряет вещь из-за незнакомых status и category', () => {
    expect(mapGearItem({ id: 4, title: ' Аптечка ', category: 'unknown', status: 'lost' })).toEqual({
      id: 4,
      title: 'Аптечка',
      category: 'other',
      status: 'buy',
      sortOrder: 0,
    });
  });
});

describe('запись в чеклист', () => {
  it('добавляет вещь очищенным названием и своей категорией', async () => {
    apiClient.post.mockResolvedValue(serverItem);

    await addTripGearItem({ tripId: 8001, title: '  Дождевик  ', category: 'clothing' });

    expect(apiClient.post).toHaveBeenCalledWith('/trips/planned/8001/gear/', {
      title: 'Дождевик',
      category: 'clothing',
    });
  });

  it('просит шаблон хайкинга ровно одним полем: лишнее бэк отклоняет', async () => {
    apiClient.post.mockResolvedValue([serverItem]);

    await expect(applyTripGearTemplate(8001)).resolves.toHaveLength(1);
    expect(apiClient.post).toHaveBeenCalledWith('/trips/planned/8001/gear/', { template: 'hiking' });
  });

  it('шлёт новый статус PATCH-ом по адресу вещи', async () => {
    apiClient.patch.mockResolvedValue({ ...serverItem, status: 'packed' });

    await expect(updateTripGearItem({ tripId: 8001, itemId: 12, status: 'packed' })).resolves
      .toMatchObject({ status: 'packed' });
    expect(apiClient.patch).toHaveBeenCalledWith('/trips/planned/8001/gear/12/', { status: 'packed' });
  });

  it('удаляет вещь по её адресу', async () => {
    apiClient.delete.mockResolvedValue(null);

    await expect(deleteTripGearItem({ tripId: 8001, itemId: 12 })).resolves.toEqual({ id: 12 });
    expect(apiClient.delete).toHaveBeenCalledWith('/trips/planned/8001/gear/12/');
  });
});
