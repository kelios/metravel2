import { type TextStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

type MapIconProps = {
  name: string;
  size: number;
  color: string;
  style?: TextStyle;
};

/**
 * Маппинг MaterialIcons -> Feather для совместимости
 */
const mapIconName = (name: string): keyof typeof Feather.glyphMap => {
  switch (name) {
    // Search & navigation
    case 'search':
      return 'search';
    case 'close':
      return 'x';
    case 'place':
      return 'map-pin';
    case 'location-on':
      return 'map-pin';
    case 'my-location':
      return 'crosshair';
    
    // Route & directions
    case 'alt-route':
      return 'git-branch';
    case 'directions':
      return 'navigation';
    case 'directions-car':
      return 'truck';
    case 'directions-walk':
      return 'user';
    case 'directions-bike':
      return 'activity';
    case 'trip-origin':
      return 'circle';
    case 'swap-vert':
      return 'refresh-cw';
    
    // Actions
    case 'refresh':
      return 'rotate-cw';
    case 'add':
      return 'plus';
    case 'remove':
      return 'minus';
    case 'download':
      return 'download';
    
    // UI controls
    case 'expand-more':
      return 'chevron-down';
    case 'expand-less':
      return 'chevron-up';
    
    // Map controls
    case 'map':
      return 'map';
    case 'zoom-out-map':
      return 'maximize';
    case 'star':
      return 'star';
    
    // Filters & categories
    case 'grid':
      return 'grid';
    case 'radio':
      return 'radio';
    case 'list':
      return 'list';
    case 'filter-list':
      return 'filter';
    
    // Default: try to use the name as-is if it exists in Feather
    default:
      return name as keyof typeof Feather.glyphMap;
  }
};

export default function MapIcon({ name, size, color, style }: MapIconProps) {
  return <Feather name={mapIconName(name)} size={size} color={color} style={style} />;
}
