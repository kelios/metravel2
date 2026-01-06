import React from 'react';
import { Text, type TextStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type MapIconProps = {
  name: string;
  size: number;
  color: string;
  style?: TextStyle;
};

export default function MapIcon({ name, size, color, style }: MapIconProps) {
  return (
    <Text style={style}>
      <MaterialIcons name={name as any} size={size} color={color} />
    </Text>
  );
}
