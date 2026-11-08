import type React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type Feather from '@expo/vector-icons/Feather'
import type { PlaceRating } from '@/utils/placesCatalog'
import type { PlaceSourcePagerProps } from '@/components/MapPage/Map/PlacePopupCard/PlaceSourcePager'

type WebCardStyle = Omit<ViewStyle, 'width' | 'maxWidth'> & {
  width?: ViewStyle['width'] | string
  maxWidth?: ViewStyle['maxWidth'] | string
}

export type ActionChip = {
  key: string
  label: string
  icon: keyof typeof Feather.glyphMap
  onPress: () => void
  accessibilityLabel?: string
  title?: string
  /** Разрушительное действие (удалить): красный пункт «⋯» последним, с разделителем (#2101). */
  destructive?: boolean
}

export type PlaceListCardProps = {
  title: string
  imageUrl?: string | null
  /**
   * Поля letterbox под `contain`-снимком заливает `dominant_color` из
   * медиа-манифеста (owner decision 2026-08-02, #1208 — docs/RULES.md). Без него
   * карточка с портретным фото оставляет по бокам пустой фон. `blurhash` идёт
   * тем же манифестом и используется только на native.
   */
  placeholderColor?: string | null
  placeholderBlurhash?: string | null
  categoryLabel?: string | null
  coord?: string | null
  badges?: string[]
  onCardPress?: () => void
  onMediaPress?: () => void
  onCopyCoord?: () => void
  onShare?: () => void
  mapActions?: ActionChip[]
  inlineActions?: ActionChip[]
  /**
   * Действия над объектом карточки (правка, удаление): пункты «⋯» на любой раскладке,
   * удаление последним с `destructive` (#2101). Подписанные пункты листа, не чипы ряда.
   */
  menuActions?: ActionChip[]
  quickActions?: ActionChip[]
  /** Сохранить/убрать ЭТУ точку в «Мои точки»; рисуется как ♥ на фото (08.11.2026). */
  onAddPoint?: () => void | Promise<void>
  addDisabled?: boolean
  isAdding?: boolean
  isSaved?: boolean
  width?: number
  imageHeight?: number
  eagerImage?: boolean
  testID?: string
  style?: StyleProp<WebCardStyle>
  /**
   * Карточка заполняет высоту родительской ячейки (ряд сетки растянут по самой
   * высокой карточке), ряд действий прижат к низу — плитки соседних карточек на
   * одной линии. Родитель обязан иметь определённую высоту.
   */
  fillHeight?: boolean
  showActionRow?: boolean
  webTouchAction?: string
  compact?: boolean
  titleLayout?: 'overlay' | 'content'
  titleNumberOfLines?: number
  popupAligned?: boolean
  /**
   * #2778: не больше трёх подписанных действий в ряду (главное + вторичные,
   * включая «Сохранить»); координаты, Telegram и навигаторы — пункты «⋯».
   */
  actionBudget?: boolean
  relatedTravelUrl?: string | null
  /** The place's related travel remains the target of the corner controls while paging. */
  relatedTravelImageUrl?: string | null
  /** Название связанной статьи, если `title` карточки — имя места (#2776). */
  relatedTravelTitle?: string | null
  relatedTravelId?: number | null
  /** Exact TravelAddress source of this physical point; never a grouped placeId or article id. */
  sourcePointId?: number | null
  relatedTravelCountry?: string | null
  relatedTravelCity?: string | null
  /** External rating (2GIS/TripAdvisor/…). When present, a gold rating pill is
   *  shown over the top-left of the photo. Ignored in popup-aligned layout. */
  rating?: PlaceRating | null
  /** Interactive rating row rendered in the card body (own MeTravel rating). */
  ratingSlot?: React.ReactNode
  sourcePager?: Omit<PlaceSourcePagerProps, 'colors' | 'compact' | 'inline'>
}
