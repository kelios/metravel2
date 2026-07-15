import Feather from '@expo/vector-icons/Feather';
import { translate as i18nT } from '@/i18n'


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
          label: i18nT('travel:components.travel.hooks.createPointListItemModel.google_maps_e74b887a'),
          icon: 'map-pin',
          onPress: () => void openExternal(buildMapUrl(item.coord)),
          title: i18nT('travel:components.travel.hooks.createPointListItemModel.otkryt_v_google_maps_a28ee984'),
        },
        {
          key: 'apple',
          label: i18nT('travel:components.travel.hooks.createPointListItemModel.apple_maps_fafa477e'),
          icon: 'map',
          onPress: () => void openExternal(buildAppleMapsUrl(item.coord)),
          title: i18nT('travel:components.travel.hooks.createPointListItemModel.otkryt_v_apple_maps_49aaaef9'),
        },
        {
          key: 'organic',
          label: i18nT('travel:components.travel.hooks.createPointListItemModel.organic_maps_57574cd8'),
          icon: 'navigation',
          onPress: () => void openExternal(buildOrganicMapsUrl(item.coord)),
          title: i18nT('travel:components.travel.hooks.createPointListItemModel.otkryt_v_organic_maps_ccb909b2'),
        },
        {
          key: 'yandex',
          label: i18nT('travel:components.travel.hooks.createPointListItemModel.yandeks_karty_6cef7c5c'),
          icon: 'navigation-2',
          onPress: () => void openExternal(buildYandexMapsUrl(item.coord)),
          title: i18nT('travel:components.travel.hooks.createPointListItemModel.otkryt_v_yandeks_kartah_7f86c142'),
        },
        {
          key: 'osm',
          label: i18nT('travel:components.travel.hooks.createPointListItemModel.openstreetmap_ecba75ae'),
          icon: 'map',
          onPress: () => void openExternal(buildOsmUrl(item.coord)),
          title: i18nT('travel:components.travel.hooks.createPointListItemModel.otkryt_v_openstreetmap_190f1588'),
        },
        ...(buildWazeUrl
          ? [
              {
                key: 'waze',
                label: i18nT('travel:components.travel.hooks.createPointListItemModel.waze_e6bc669c'),
                icon: 'navigation' as keyof typeof Feather.glyphMap,
                onPress: () => void openExternal(buildWazeUrl(item.coord)),
                title: i18nT('travel:components.travel.hooks.createPointListItemModel.prolozhit_marshrut_v_waze_9e1c2664'),
              },
            ]
          : []),
        ...(buildYandexNaviUrl
          ? [
              {
                key: 'yandex-navi',
                label: i18nT('travel:components.travel.hooks.createPointListItemModel.yandeks_navigator_21267ba7'),
                icon: 'navigation-2' as keyof typeof Feather.glyphMap,
                onPress: () => void openExternal(buildYandexNaviUrl(item.coord)),
                title: i18nT('travel:components.travel.hooks.createPointListItemModel.prolozhit_marshrut_v_yandeks_navigatore_26115a56'),
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
          label: i18nT('travel:components.travel.hooks.createPointListItemModel.statya_3106a0af'),
          icon: 'book-open',
          onPress: () => {
            void onOpenArticle(item);
          },
          title: i18nT('travel:components.travel.hooks.createPointListItemModel.otkryt_statyu_82fbaed2'),
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
