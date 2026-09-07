/**
 * Guard «фото исчезнувшей точки в теле статьи» (#1834, рецидив #1088).
 *
 * `/address-image/<id точки>/…` резолвится по строке `travel_address`: удалили
 * точку — ссылка в тексте навсегда 404 (travel 586, точки 15188 и 15190).
 * Детектор сверяет id из тела с точками сохраняемого маршрута и НЕ трогает текст.
 */
jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(),
}));

import { confirmAction } from '@/utils/confirmAction';
import {
  confirmDanglingPointImagesIfNeeded,
  detectDanglingPointImages,
} from '@/utils/travelBodyPointImageGuard';

const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const point = (id: number | null) => ({
  id,
  lat: 53.9,
  lng: 27.56,
  address: 'Минск',
  categories: [],
  image: null,
});

const img = (pointId: number) =>
  `<p><img src="https://metravel.by/address-image/${pointId}/conversions/1b3ee9bba4e442e0bb2c2a204adb2f13.webp"></p>`;

describe('detectDanglingPointImages', () => {
  it('возвращает ссылку, точки которой нет в маршруте', () => {
    const found = detectDanglingPointImages({ description: img(777) }, [point(15193)]);

    expect(found).toEqual([
      expect.objectContaining({
        field: 'description',
        pointId: 777,
        url: 'https://metravel.by/address-image/777/conversions/1b3ee9bba4e442e0bb2c2a204adb2f13.webp',
      }),
    ]);
  });

  it('молчит, когда точка в маршруте есть', () => {
    expect(detectDanglingPointImages({ description: img(777) }, [point(777)])).toEqual([]);
  });

  it('сверяет id как число, а не как строку: сервер отдаёт их по-разному', () => {
    expect(detectDanglingPointImages({ description: img(777) }, [{ id: '777' }])).toEqual([]);
  });

  it('смотрит все четыре rich-text поля', () => {
    const found = detectDanglingPointImages(
      { description: img(1), plus: img(2), minus: img(3), recommendation: img(4) },
      [point(9)],
    );

    expect(found.map((item) => item.field)).toEqual([
      'description',
      'plus',
      'minus',
      'recommendation',
    ]);
  });

  it('ловит адрес внутри обёртки weserv, где слэши процентно закодированы', () => {
    const html =
      '<img src="https://images.weserv.nl/?url=metravel.by%2Faddress-image%2F15188%2Fconversions%2Fx.webp">';

    expect(detectDanglingPointImages({ description: html }, [point(15193)])).toEqual([
      expect.objectContaining({ pointId: 15188 }),
    ]);
  });

  it('не дублирует один адрес, повторённый в src и data-src того же кадра', () => {
    const html =
      '<img src="https://metravel.by/address-image/777/conversions/x.webp" ' +
      'data-src="https://metravel.by/address-image/777/conversions/x.webp">';

    expect(detectDanglingPointImages({ description: html }, [point(15193)])).toHaveLength(1);
  });

  it('различает два разных кадра одной мёртвой точки', () => {
    const html = `${img(777)}<img src="https://metravel.by/address-image/777/conversions/second.webp">`;

    expect(detectDanglingPointImages({ description: html }, [point(15193)])).toHaveLength(2);
  });

  // Маршрут без прочитанных точек — не вердикт «всё мертво»: так же выглядит
  // форма, в которой точки ещё не подгрузились, и гейт превратился бы в модалку
  // на каждое сохранение текста.
  it('не выносит вердикт по пустому маршруту', () => {
    expect(detectDanglingPointImages({ description: img(777) }, [])).toEqual([]);
    expect(detectDanglingPointImages({ description: img(777) }, undefined)).toEqual([]);
  });

  it('не считает точками ещё не сохранённые маркеры (id === null)', () => {
    expect(detectDanglingPointImages({ description: img(777) }, [point(null)])).toEqual([]);
  });

  it('не трогает картинки других семейств', () => {
    const html =
      '<img src="https://metravel.by/travel-description-image/586/description/x.webp">' +
      '<img src="https://metravel.by/gallery/901/gallery/photo.jpg">';

    expect(detectDanglingPointImages({ description: html }, [point(15193)])).toEqual([]);
  });
});

describe('confirmDanglingPointImagesIfNeeded', () => {
  beforeEach(() => mockConfirmAction.mockReset());

  it('не зовёт диалог и возвращает true, когда мёртвых ссылок нет', async () => {
    await expect(
      confirmDanglingPointImagesIfNeeded({ description: img(777) }, [point(777)]),
    ).resolves.toBe(true);
    expect(mockConfirmAction).not.toHaveBeenCalled();
  });

  it('зовёт диалог и прокидывает его ответ', async () => {
    mockConfirmAction.mockResolvedValueOnce(false);

    await expect(
      confirmDanglingPointImagesIfNeeded({ description: img(777) }, [point(15193)]),
    ).resolves.toBe(false);
    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
  });

  it('у weserv-обёртки показывает имя фотографии, а не имя чужого хоста', async () => {
    mockConfirmAction.mockResolvedValueOnce(true);
    const html =
      '<img src="https://images.weserv.nl/?url=metravel.by%2Faddress-image%2F15188%2Fconversions%2Fdead.webp">';

    await confirmDanglingPointImagesIfNeeded({ description: html }, [point(15193)]);

    const message = mockConfirmAction.mock.calls[0][0].message;
    expect(message).toContain('dead.webp');
    expect(message).not.toContain('images.weserv.nl');
  });

  // ConfirmDialog не ограничивает высоту и не скроллит: полный список из 14
  // позиций вынес обе кнопки за экран (замер на локальном стенде, travel 682 —
  // диалог 1051 px в окне 900). Список обязан быть коротким.
  it('длинный список усекается до пяти строк и хвостового счётчика', async () => {
    mockConfirmAction.mockResolvedValueOnce(true);
    const many = Array.from({ length: 14 }, (_, i) =>
      `<img src="https://metravel.by/address-image/${900 + i}/conversions/f${i}.webp">`,
    ).join('');

    await confirmDanglingPointImagesIfNeeded({ description: many }, [point(15193)]);

    const message = mockConfirmAction.mock.calls[0][0].message;
    const bullets = message.split('\n').filter((line) => line.trim().startsWith('•'));
    expect(bullets).toHaveLength(6);
    expect(bullets[5]).toContain('9');
    // Счётчик в шапке сообщения по-прежнему называет полное число.
    expect(message).toContain('(14)');
  });

  it('показывает автору имя файла и id точки, а текст не переписывает', async () => {
    mockConfirmAction.mockResolvedValueOnce(true);
    const body = { description: img(777) };

    await confirmDanglingPointImagesIfNeeded(body, [point(15193)]);

    const message = mockConfirmAction.mock.calls[0][0].message;
    expect(message).toContain('1b3ee9bba4e442e0bb2c2a204adb2f13.webp');
    expect(message).toContain('777');
    expect(body.description).toBe(img(777));
  });
});
