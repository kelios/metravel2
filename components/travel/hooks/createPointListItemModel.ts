import Feather from '@expo/vector-icons/Feather';

// #841: нормализуем URL для сравнения «ведёт ли ссылка на текущее путешествие».
// Игнорируем origin (относит./абсолют.), query, hash и trailing slash — сравниваем
// только путь (slug/id), в нижнем регистре.
const normalizeUrlPath = (raw?: string | null): string => {
  const url = String(raw ?? '').trim();
  if (!url) return '';
  const path = url
    .replace(/^[a-z]+:\/\/[^/]+/i, '') // origin
    .replace(/[?#].*$/, '') // query + hash
    .replace(/\/+$/, ''); // trailing slash
  return path.toLowerCase();
};

type PointLike = {
  id: string;
  address: string;
  coord: string;
  articleUrl?: string;
  urlTravel?: string;
  updated_at?: string;
  travelImageThumbUrl?: string;
  categoryName?: string | { name?: string } | Array<string | { name?: string }>;
};

export function createPointListItemModel({
  addingPointId,
  baseUrl,
  buildAppleMapsUrl,
  buildOrganicMapsUrl,
  buildMapUrl,
  buildOsmUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
  getCategoryLabel,
  getImageUrl,
  isSaved = false,
  item,
  onAddPoint,
  onCopy,
  onOpenArticle,
  onOpenMap,
  onPointCardPress,
  onShare,
  openExternal,
}: {
  addingPointId: string | null;
  baseUrl?: string;
  buildAppleMapsUrl: (coordStr: string) => string;
  buildOrganicMapsUrl: (coordStr: string) => string;
  buildMapUrl: (coordStr: string) => string;
  buildOsmUrl: (coordStr: string) => string;
  buildWazeUrl?: (coordStr: string) => string;
  buildYandexMapsUrl: (coordStr: string) => string;
  buildYandexNaviUrl?: (coordStr: string) => string;
  getCategoryLabel: (raw: PointLike['categoryName'] | null | undefined) => string;
  getImageUrl: (url?: string, updatedAt?: string) => string | undefined;
  isSaved?: boolean;
  item: PointLike;
  onAddPoint: (item: PointLike) => void | Promise<void>;
  onCopy: (coordStr: string) => void | Promise<void>;
  onOpenArticle: (point: PointLike) => void | Promise<void>;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  onPointCardPress?: (point: PointLike) => void;
  onShare: (coordStr: string) => void | Promise<void>;
  openExternal: (url: string) => void | Promise<void>;
}) {
  const isAdding = addingPointId === item.id;
  const addDisabled = false;
  const handleAddPointClick = (event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    void onAddPoint(item);
  };

  const categoryLabel = getCategoryLabel(item.categoryName) || undefined;
  const imageUrl = getImageUrl(item.travelImageThumbUrl, item.updated_at);
  const onCardPress = onPointCardPress ? () => onPointCardPress(item) : () => onOpenMap(item.coord);
  const onMediaPress = onPointCardPress ? undefined : () => onOpenArticle(item);
  const onCopyCoord = item.coord ? () => onCopy(item.coord) : undefined;
  const onShareCoord = item.coord ? () => onShare(item.coord) : undefined;

  const mapActions: Array<{
    key: string;
    label: string;
    icon: keyof typeof Feather.glyphMap;
    onPress: () => void;
    title?: string;
  }> = item.coord
    ? [
        {
          key: 'google',
          label: 'Google Maps',
          icon: 'map-pin',
          onPress: () => void openExternal(buildMapUrl(item.coord)),
          title: 'Открыть в Google Maps',
        },
        {
          key: 'apple',
          label: 'Apple Maps',
          icon: 'map',
          onPress: () => void openExternal(buildAppleMapsUrl(item.coord)),
          title: 'Открыть в Apple Maps',
        },
        {
          key: 'organic',
          label: 'Organic Maps',
          icon: 'navigation',
          onPress: () => void openExternal(buildOrganicMapsUrl(item.coord)),
          title: 'Открыть в Organic Maps',
        },
        {
          key: 'yandex',
          label: 'Яндекс Карты',
          icon: 'navigation-2',
          onPress: () => void openExternal(buildYandexMapsUrl(item.coord)),
          title: 'Открыть в Яндекс Картах',
        },
        {
          key: 'osm',
          label: 'OpenStreetMap',
          icon: 'map',
          onPress: () => void openExternal(buildOsmUrl(item.coord)),
          title: 'Открыть в OpenStreetMap',
        },
        ...(buildWazeUrl
          ? [
              {
                key: 'waze',
                label: 'Waze',
                icon: 'navigation' as keyof typeof Feather.glyphMap,
                onPress: () => void openExternal(buildWazeUrl(item.coord)),
                title: 'Проложить маршрут в Waze',
              },
            ]
          : []),
        ...(buildYandexNaviUrl
          ? [
              {
                key: 'yandex-navi',
                label: 'Яндекс Навигатор',
                icon: 'navigation-2' as keyof typeof Feather.glyphMap,
                onPress: () => void openExternal(buildYandexNaviUrl(item.coord)),
                title: 'Проложить маршрут в Яндекс Навигаторе',
              },
            ]
          : []),
      ]
    : [];

  // #841: итоговая ссылка action «Статья» после fallback. Если она ведёт ровно на
  // текущую страницу путешествия (baseUrl) — action бесполезен, скрываем его.
  // Оставляем, только если точка ссылается на ДРУГУЮ статью/путешествие.
  const articleTarget = item.articleUrl || item.urlTravel || baseUrl;
  const articleLeadsElsewhere =
    !!articleTarget && normalizeUrlPath(articleTarget) !== normalizeUrlPath(baseUrl);

  const inlineActions: Array<{
    key: string;
    label: string;
    icon: keyof typeof Feather.glyphMap;
    onPress: () => void;
    title?: string;
  }> = articleLeadsElsewhere
    ? [
        {
          key: 'article',
          label: 'Статья',
          icon: 'book-open',
          onPress: () => {
            void onOpenArticle(item);
          },
          title: 'Открыть статью',
        },
      ]
    : [];

  return {
    addDisabled,
    categoryLabel,
    handleAddPointClick,
    imageUrl,
    inlineActions,
    isAdding,
    isSaved,
    mapActions,
    onCardPress,
    onCopyCoord,
    onMediaPress,
    onShareCoord,
  };
}
