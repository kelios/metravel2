import React from 'react';
import { type TextStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type MapIconProps = {
  name: string;
  size: number;
  color: string;
  style?: TextStyle;
};

/**
 * Транспортные режимы рисуем настоящими глифами MaterialCommunityIcons —
 * у Feather нет узнаваемых машины/велосипеда (раньше были truck и «пульс»).
 */
const MCI_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  'directions-car': 'car',
  'directions-walk': 'walk',
  'directions-bike': 'bike',
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
    case 'view-list':
    case 'view_list':
      return 'list';
    case 'filter-list':
      return 'filter';
    case 'hiking':
      return 'activity';
    
    // Default: try to use the name as-is if it exists in Feather
    default:
      return name as keyof typeof Feather.glyphMap;
  }
};

function MapIcon({ name, size, color, style }: MapIconProps) {
  const mciName = MCI_ICONS[name];
  if (mciName) {
    return <MaterialCommunityIcons name={mciName} size={size} color={color} style={style} />;
  }
  return <Feather name={mapIconName(name)} size={size} color={color} style={style} />;
}

export default React.memo(MapIcon);
