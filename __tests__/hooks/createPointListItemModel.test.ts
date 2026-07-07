import { createPointListItemModel } from '@/components/travel/hooks/createPointListItemModel';

describe('createPointListItemModel', () => {
  it('builds web card actions and prefers onPointCardPress when provided', () => {
    const onAddPoint = jest.fn();
    const onCopy = jest.fn();
    const onOpenArticle = jest.fn();
    const onOpenMap = jest.fn();
    const onPointCardPress = jest.fn();
    const onShare = jest.fn();
    const openExternal = jest.fn();

    const model = createPointListItemModel({
      addingPointId: '2',
      baseUrl: 'https://example.com/travel',
      buildAppleMapsUrl: (coord: string) => `apple:${coord}`,
      buildMapUrl: (coord: string) => `google:${coord}`,
      buildOrganicMapsUrl: (coord: string) => `organic:${coord}`,
      buildOsmUrl: (coord: string) => `osm:${coord}`,
      buildYandexMapsUrl: (coord: string) => `yandex:${coord}`,
      getCategoryLabel: () => 'Озёра',
      getImageUrl: () => 'https://example.com/image.jpg',
      item: {
        id: '2',
        address: 'Минск',
        coord: '53.9,27.56',
        articleUrl: 'https://example.com/article',
        categoryName: 'Озёра',
      },
      onAddPoint,
      onCopy,
      onOpenArticle,
      onOpenMap,
      onPointCardPress,
      onShare,
      openExternal,
    });

    expect(model.isAdding).toBe(true);
    expect(model.addDisabled).toBe(false);
    expect(model.categoryLabel).toBe('Озёра');
    expect(model.imageUrl).toBe('https://example.com/image.jpg');
    expect(model.mapActions).toHaveLength(5);
    expect(model.inlineActions).toHaveLength(1);

    model.onCardPress?.();
    model.onMediaPress?.();
    model.onCopyCoord?.();
    model.onShareCoord?.();
    model.mapActions[0].onPress();
    model.inlineActions[0].onPress();

    expect(onPointCardPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2' })
    );
    expect(onOpenArticle).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2' })
    );
    expect(onCopy).toHaveBeenCalledWith('53.9,27.56');
    expect(onShare).toHaveBeenCalledWith('53.9,27.56');
    expect(openExternal).toHaveBeenCalledWith('google:53.9,27.56');
  });

  it('falls back to map open when point card press is absent and stops propagation for add', () => {
    const onAddPoint = jest.fn();
    const onOpenMap = jest.fn();
    const stopPropagation = jest.fn();

    const model = createPointListItemModel({
      addingPointId: null,
      baseUrl: undefined,
      buildAppleMapsUrl: (coord: string) => `apple:${coord}`,
      buildMapUrl: (coord: string) => `google:${coord}`,
      buildOrganicMapsUrl: (coord: string) => `organic:${coord}`,
      buildOsmUrl: (coord: string) => `osm:${coord}`,
      buildYandexMapsUrl: (coord: string) => `yandex:${coord}`,
      getCategoryLabel: () => '',
      getImageUrl: () => undefined,
      item: {
        id: '5',
        address: 'Брест',
        coord: '52.1,23.7',
      },
      onAddPoint,
      onCopy: jest.fn(),
      onOpenArticle: jest.fn(),
      onOpenMap,
      onPointCardPress: undefined,
      onShare: jest.fn(),
      openExternal: jest.fn(),
    });

    model.onCardPress?.();
    model.handleAddPointClick({ stopPropagation });

    expect(onOpenMap).toHaveBeenCalledWith('52.1,23.7');
    expect(stopPropagation).toHaveBeenCalled();
    expect(onAddPoint).toHaveBeenCalledWith(
      expect.objectContaining({ id: '5' })
    );
    expect(model.inlineActions).toEqual([]);
  });

  const baseArgs = (overrides: Record<string, unknown>) => ({
    addingPointId: null,
    buildAppleMapsUrl: (coord: string) => `apple:${coord}`,
    buildMapUrl: (coord: string) => `google:${coord}`,
    buildOrganicMapsUrl: (coord: string) => `organic:${coord}`,
    buildOsmUrl: (coord: string) => `osm:${coord}`,
    buildYandexMapsUrl: (coord: string) => `yandex:${coord}`,
    getCategoryLabel: () => '',
    getImageUrl: () => undefined,
    onAddPoint: jest.fn(),
    onCopy: jest.fn(),
    onOpenArticle: jest.fn(),
    onOpenMap: jest.fn(),
    onPointCardPress: undefined,
    onShare: jest.fn(),
    openExternal: jest.fn(),
    ...overrides,
  });

  // #841
  it('hides the article action when the link resolves to the current travel (baseUrl fallback)', () => {
    const model = createPointListItemModel(
      baseArgs({
        baseUrl: 'https://metravel.by/travels/minsk',
        item: { id: '1', address: 'Минск', coord: '53.9,27.56' },
      }) as any
    );
    expect(model.inlineActions).toEqual([]);
  });

  it('hides the article action when articleUrl normalizes to the current travel URL', () => {
    const model = createPointListItemModel(
      baseArgs({
        baseUrl: 'https://metravel.by/travels/minsk',
        item: {
          id: '1',
          address: 'Минск',
          coord: '53.9,27.56',
          // same path, different origin + trailing slash + query
          articleUrl: '/travels/minsk/?utm=x',
        },
      }) as any
    );
    expect(model.inlineActions).toEqual([]);
  });

  it('keeps the article action when the point links to a different article', () => {
    const model = createPointListItemModel(
      baseArgs({
        baseUrl: 'https://metravel.by/travels/minsk',
        item: {
          id: '1',
          address: 'Минск',
          coord: '53.9,27.56',
          articleUrl: 'https://metravel.by/travels/brest',
        },
      }) as any
    );
    expect(model.inlineActions).toHaveLength(1);
    expect(model.inlineActions[0].key).toBe('article');
  });

  // #839
  it('passes through the saved state', () => {
    const saved = createPointListItemModel(
      baseArgs({ isSaved: true, item: { id: '1', address: 'Минск', coord: '53.9,27.56' } }) as any
    );
    const notSaved = createPointListItemModel(
      baseArgs({ item: { id: '1', address: 'Минск', coord: '53.9,27.56' } }) as any
    );
    expect(saved.isSaved).toBe(true);
    expect(notSaved.isSaved).toBe(false);
  });
});
