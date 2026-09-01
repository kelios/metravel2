import type Feather from '@expo/vector-icons/Feather'

/** Material-style map names mapped to the project's web/native Feather set. */
export const mapIconName = (name: string): keyof typeof Feather.glyphMap => {
  switch (name) {
    case 'search':
      return 'search'
    case 'close':
      return 'x'
    case 'place':
    case 'location-on':
      return 'map-pin'
    case 'my-location':
      return 'crosshair'
    case 'alt-route':
      return 'git-branch'
    case 'directions':
      return 'navigation'
    case 'directions-car':
      return 'truck'
    case 'directions-walk':
      return 'user'
    case 'directions-bike':
    case 'hiking':
      return 'activity'
    case 'directions-bus':
      return 'map'
    case 'directions-transit':
      return 'compass'
    case 'trip-origin':
      return 'circle'
    case 'swap-vert':
      return 'refresh-cw'
    case 'refresh':
      return 'rotate-cw'
    case 'add':
      return 'plus'
    case 'remove':
      return 'minus'
    case 'download':
      return 'download'
    case 'expand-more':
      return 'chevron-down'
    case 'expand-less':
      return 'chevron-up'
    case 'map':
      return 'map'
    case 'zoom-out-map':
      return 'maximize'
    case 'star':
      return 'star'
    case 'grid':
      return 'grid'
    case 'radio':
      return 'radio'
    case 'list':
    case 'view-list':
    case 'view_list':
      return 'list'
    case 'filter-list':
      return 'filter'
    default:
      return name as keyof typeof Feather.glyphMap
  }
}
