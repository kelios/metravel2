/**
 * #1516: выбор контракта фонового сохранения.
 *
 * Узкий `PATCH /travels/{id}/content/` берётся только тогда, когда относительно
 * подтверждённого сервером состояния изменился ИСКЛЮЧИТЕЛЬНО текст существующей
 * статьи. Любая структурная правка (точки, галерея, обложка, справочники) и любое
 * сомнение — полное `PUT /travels/upsert/` со всеми его валидациями.
 */
import type { TravelFormData } from '@/types/types';
import { planTravelContentSave } from '@/utils/travelContentSaveDelta';

const baseTravel = (overrides: Partial<TravelFormData> = {}): TravelFormData =>
  ({
    id: 619,
    slug: 'minsk',
    name: 'Минск за один день',
    description: '<p>Длинное описание маршрута по городу с деталями.</p>',
    plus: '<p>Плюсы</p>',
    minus: '<p>Минусы</p>',
    recommendation: '<p>Рекомендации</p>',
    youtube_link: '',
    categories: [1, 2],
    countries: [3],
    coordsMeTravel: [{ id: 15904, lat: 53.9, lng: 27.56, address: 'Точка A', categories: [1] }],
    gallery: [{ id: 77, url: 'https://cdn/1.jpg' }],
    travel_image_thumb_url: 'https://cdn/cover.jpg',
    publish: false,
    moderation: false,
    ...overrides,
  }) as unknown as TravelFormData;

describe('planTravelContentSave', () => {
  it('уводит правку только описания на узкий путь и шлёт единственное поле', () => {
    const baseline = baseTravel();
    const next = baseTravel({ description: '<p>Дописанный абзац.</p>' });

    const plan = planTravelContentSave(next, baseline);

    expect(plan).toEqual({
      kind: 'content',
      travelId: 619,
      fields: { description: '<p>Дописанный абзац.</p>' },
    });
  });

  it('шлёт все изменившиеся текстовые поля и ни одного неизменившегося', () => {
    const baseline = baseTravel();
    const next = baseTravel({ name: 'Минск за выходные', plus: '<p>Новые плюсы</p>' });

    const plan = planTravelContentSave(next, baseline);

    expect(plan).toEqual({
      kind: 'content',
      travelId: 619,
      fields: { name: 'Минск за выходные', plus: '<p>Новые плюсы</p>' },
    });
  });

  it.each([
    ['добавление точки маршрута', {
      coordsMeTravel: [
        { id: 15904, lat: 53.9, lng: 27.56, address: 'Точка A', categories: [1] },
        { id: null, lat: 53.91, lng: 27.57, address: 'Точка B', categories: [] },
      ],
    }],
    ['изменение галереи', { gallery: [{ id: 77, url: 'https://cdn/1.jpg' }, { id: 78, url: 'https://cdn/2.jpg' }] }],
    ['замену обложки', { travel_image_thumb_url: 'https://cdn/cover-2.jpg' }],
    ['изменение справочников', { categories: [1, 2, 5] }],
    ['правку youtube_link вне текстового контракта', { youtube_link: 'https://youtu.be/x' }],
  ])('оставляет %s на полном сохранении', (_label, overrides) => {
    const plan = planTravelContentSave(
      baseTravel(overrides as Partial<TravelFormData>),
      baseTravel(),
    );

    expect(plan).toEqual({ kind: 'full' });
  });

  it('оставляет на полном пути правку текста ВМЕСТЕ со структурной', () => {
    const plan = planTravelContentSave(
      baseTravel({ description: '<p>Новый текст</p>', categories: [9] }),
      baseTravel(),
    );

    expect(plan).toEqual({ kind: 'full' });
  });

  it('оставляет на полном пути новую статью без id', () => {
    const plan = planTravelContentSave(
      baseTravel({ id: null as unknown as number, description: '<p>Новый текст</p>' }),
      baseTravel({ id: null as unknown as number }),
    );

    expect(plan).toEqual({ kind: 'full' });
  });

  it('оставляет на полном пути первый сейв после появления id', () => {
    const plan = planTravelContentSave(
      baseTravel({ description: '<p>Новый текст</p>' }),
      baseTravel({ id: null as unknown as number }),
    );

    expect(plan).toEqual({ kind: 'full' });
  });

  it('оставляет на полном пути отсутствующее подтверждённое состояние', () => {
    expect(planTravelContentSave(baseTravel(), null)).toEqual({ kind: 'full' });
  });

  it('оставляет на полном пути содержательно пустую форму у статьи с id', () => {
    // Непрогидратированная форма (инцидент 2026-07-21, travel 641): узкий путь
    // не должен становиться обходом анти-обнуления полного пути.
    const blank = {
      id: 641,
      name: '',
      description: '',
      plus: '',
      minus: '',
      recommendation: '',
      categories: [],
      countries: [],
      coordsMeTravel: [],
      gallery: [],
    } as unknown as TravelFormData;

    expect(planTravelContentSave(blank, baseTravel({ id: 641 }))).toEqual({ kind: 'full' });
  });

  it.each([
    ['очистку описания', { description: '   ' }],
    ['очистку плюсов', { plus: '' }],
    ['очистку названия', { name: '' }],
    ['слишком короткое название черновика', { name: 'Ми' }],
  ])('оставляет %s на полном пути с его draft-плейсхолдерами', (_label, overrides) => {
    // Узкий сериализатор не принимает пустую строку у description/plus/minus/
    // recommendation, а имя короче трёх символов у черновика полный путь
    // заменяет плейсхолдером. Узкий путь такой подмены не делает.
    const plan = planTravelContentSave(
      baseTravel(overrides as Partial<TravelFormData>),
      baseTravel(),
    );

    expect(plan).toEqual({ kind: 'full' });
  });

  it('оставляет на полном пути обнуление текстового поля в null', () => {
    const plan = planTravelContentSave(
      baseTravel({ plus: null as unknown as string }),
      baseTravel(),
    );

    expect(plan).toEqual({ kind: 'full' });
  });

  it('оставляет на полном пути снимок без реальных отличий', () => {
    expect(planTravelContentSave(baseTravel(), baseTravel())).toEqual({ kind: 'full' });
  });

  it('берёт id из подтверждённого состояния через fallback, когда его нет в снимке', () => {
    const baseline = baseTravel();
    const next = baseTravel({ description: '<p>Правка</p>' });
    delete (next as unknown as Record<string, unknown>).id;
    delete (baseline as unknown as Record<string, unknown>).id;

    const plan = planTravelContentSave(next, baseline, 619);

    expect(plan).toEqual({
      kind: 'content',
      travelId: 619,
      fields: { description: '<p>Правка</p>' },
    });
  });
});
