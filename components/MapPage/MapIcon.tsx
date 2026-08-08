import React from 'react';
import { type TextStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { mapIconName } from '@/components/MapPage/mapIconName';

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

function MapIcon({ name, size, color, style }: MapIconProps) {
  const mciName = MCI_ICONS[name];
  if (mciName) {
    return <MaterialCommunityIcons name={mciName} size={size} color={color} style={style} />;
  }
  return <Feather name={mapIconName(name)} size={size} color={color} style={style} />;
}

export default React.memo(MapIcon);
