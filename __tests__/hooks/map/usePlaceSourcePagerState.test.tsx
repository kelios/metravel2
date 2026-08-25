/**
 * #1572 — состояние source-pager'а карточки места.
 *
 * `useMapPlaceSources.lazyCache.test.tsx` закрывает сетевой слой (когда и
 * сколько раз уходит запрос). Здесь коллекция замокана, и проверяется сама
 * логика владельца данных карточки:
 * - циклические prev/next по загруженной коллекции;
 * - активный материал держится за `sourceId`, а не за индекс, поэтому переживает
 *   догрузку коллекции и новую ссылку на массив;
 * - счётчик схлопывается, когда запрос завершился и листать нечего (иначе на
 *   карточке остались бы стрелки, которые ничего не делают);
 * - под НЕ primary-материалом плоские legacy-поля записи
 *   (`imageUrl`/`articleUrl`/`urlTravel`) не подставляются: иначе карточка увела
 *   бы на чужую статью и показала чужое фото.
 */
import { act, renderHook } from '@testing-library/react-native';

import {
  resolvePlaceSourceCardFields,
  usePlaceSourcePagerState,
} from '@/components/MapPage/Map/PlacePopupCard/usePlaceSourcePagerState';
import { normalizeMapPlaceSource, readMapPlaceMarkerFields } from '@/api/mapPlaces';
import {
  RAW_GROUPED_LIBRARY_MARKER,
  RAW_LIBRARY_SOURCE_A,
  RAW_LIBRARY_SOURCE_B,
  RAW_LIBRARY_SOURCE_B_WITHOUT_MEDIA,
  RAW_NEARBY_DISTINCT_MARKER,
} from '../../fixtures/mapPlaceFixtures';

const mockUseMapPlaceSources = jest.fn();

jest.mock('@/hooks/map/useMapPlaceSources', () => ({
  __esModule: true,
  useMapPlaceSources: (args: any) => mockUseMapPlaceSources(args),
}));

const sourceA = normalizeMapPlaceSource(RAW_LIBRARY_SOURCE_A)!;
const sourceB = normalizeMapPlaceSource(RAW_LIBRARY_SOURCE_B)!;
const sourceBWithoutMedia = normalizeMapPlaceSource(RAW_LIBRARY_SOURCE_B_WITHOUT_MEDIA)!;

/** Точка карты в том виде, в каком её получает карточка после нормализации DTO. */
const toPoint = (raw: Record<string, unknown>) => ({
  id: raw.id,
  coord: `${raw.lat},${raw.lng}`,
  articleUrl: raw.urlTravel,
  urlTravel: raw.urlTravel,
  imageUrl: raw.travelImageThumbUrl,
  travelImageThumbUrl: raw.travelImageThumbUrl,
  ...readMapPlaceMarkerFields(raw),
});

const LIBRARY_POINT = toPoint(RAW_GROUPED_LIBRARY_MARKER as unknown as Record<string, unknown>);
const NEARBY_POINT = toPoint(RAW_NEARBY_DISTINCT_MARKER as unknown as Record<string, unknown>);

const loading = () => ({ data: undefined, isError: false });
const loaded = (data: unknown[]) => ({ data, isError: false });
const failed = () => ({ data: undefined, isError: true });

beforeEach(() => {
  mockUseMapPlaceSources.mockReset();
});

describe('usePlaceSourcePagerState', () => {
  it('keeps the marker counter while the collection is loading and pages only what it has', () => {
    mockUseMapPlaceSources.mockReturnValue(loading());

    const { result } = renderHook(() => usePlaceSourcePagerState(LIBRARY_POINT, true));

    expect(result.current.sourceCount).toBe(2);
    expect(result.current.activeSource?.sourceId).toBe(sourceA.sourceId);

    act(() => result.current.goNext());

    // Листать нечем, пока коллекция не пришла: активный материал не меняется.
    expect(result.current.activeSourceIndex).toBe(0);
    expect(result.current.activeSource?.sourceId).toBe(sourceA.sourceId);
  });

  it('collapses the counter when the request failed (no arrows that do nothing)', () => {
    mockUseMapPlaceSources.mockReturnValue(failed());

    const { result } = renderHook(() => usePlaceSourcePagerState(LIBRARY_POINT, true));

    expect(result.current.sourceCount).toBe(1);
    expect(result.current.isPrimarySourceActive).toBe(true);
  });

  it('pages forward and backward cyclically over the loaded collection', () => {
    mockUseMapPlaceSources.mockReturnValue(loaded([sourceA, sourceB]));

    const { result } = renderHook(() => usePlaceSourcePagerState(LIBRARY_POINT, true));

    act(() => result.current.goNext());
    expect(result.current.activeSourceIndex).toBe(1);
    expect(result.current.activeSource?.sourceId).toBe(sourceB.sourceId);
    expect(result.current.isPrimarySourceActive).toBe(false);

    act(() => result.current.goNext());
    expect(result.current.activeSourceIndex).toBe(0);

    act(() => result.current.goPrev());
    expect(result.current.activeSourceIndex).toBe(1);
  });

  it('holds the active source by id across a late collection load and a new array instance', () => {
    mockUseMapPlaceSources.mockReturnValue(loading());
    const { result, rerender } = renderHook(() =>
      usePlaceSourcePagerState(LIBRARY_POINT, true),
    );

    mockUseMapPlaceSources.mockReturnValue(loaded([sourceA, sourceB]));
    rerender({});
    // Догрузка коллекции не двигает активный материал.
    expect(result.current.activeSourceIndex).toBe(0);

    act(() => result.current.goNext());
    expect(result.current.activeSource?.sourceId).toBe(sourceB.sourceId);

    // Новая ссылка на тот же список (рефетч/пересборка кэша) не сбрасывает выбор.
    mockUseMapPlaceSources.mockReturnValue(loaded([{ ...sourceA }, { ...sourceB }]));
    rerender({});
    expect(result.current.activeSource?.sourceId).toBe(sourceB.sourceId);
  });

  it('restarts from the primary source when another place is selected', () => {
    mockUseMapPlaceSources.mockReturnValue(loaded([sourceA, sourceB]));
    let point = LIBRARY_POINT;
    const { result, rerender } = renderHook(() => usePlaceSourcePagerState(point, true));

    act(() => result.current.goNext());
    expect(result.current.activeSource?.sourceId).toBe(sourceB.sourceId);

    point = NEARBY_POINT;
    mockUseMapPlaceSources.mockReturnValue(loaded([]));
    rerender({});

    expect(result.current.activeSourceIndex).toBe(0);
    expect(result.current.activeSource?.sourceId).toBe(
      RAW_NEARBY_DISTINCT_MARKER.primary_source.source_id,
    );
    expect(result.current.isPrimarySourceActive).toBe(true);
  });

  it('never substitutes the flat legacy fields under a non-primary source', () => {
    mockUseMapPlaceSources.mockReturnValue(loaded([sourceA, sourceBWithoutMedia]));

    const { result } = renderHook(() => usePlaceSourcePagerState(LIBRARY_POINT, true));

    const primaryFields = resolvePlaceSourceCardFields(LIBRARY_POINT, result.current, true);
    expect(primaryFields.imageUrl).toBe(sourceA.thumbnailUrl);
    expect(primaryFields.articleUrl).toBe(sourceA.articleUrl);
    expect(primaryFields.articleTitle).toBe(sourceA.articleTitle);

    act(() => result.current.goNext());

    const secondFields = resolvePlaceSourceCardFields(LIBRARY_POINT, result.current, true);
    // У материала нет ни своего фото, ни своей ссылки — карточка остаётся без
    // них, а не подставляет снимок и ссылку первой статьи.
    expect(secondFields.imageUrl).toBe('');
    expect(secondFields.articleUrl).toBe('');
    expect(secondFields.articleTitle).toBe(sourceBWithoutMedia.articleTitle);
    expect(LIBRARY_POINT.imageUrl).toBeTruthy();
    expect(LIBRARY_POINT.urlTravel).toBeTruthy();
  });

  it('keeps the legacy single-source card on its flat fields', () => {
    mockUseMapPlaceSources.mockReturnValue(loading());

    const legacyPoint = { id: 4242, coord: '51.88,26.84', urlTravel: '/travels/stolin', imageUrl: '/address-image/5960.webp' };
    const { result } = renderHook(() => usePlaceSourcePagerState(legacyPoint, true));

    const fields = resolvePlaceSourceCardFields(legacyPoint, result.current, false);
    expect(result.current.sourceCount).toBe(1);
    expect(fields.imageUrl).toBe('/address-image/5960.webp');
    expect(fields.articleUrl).toBe('/travels/stolin');
    expect(fields.articleTitle).toBe('');
  });
});
