import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

type ReservedSpaceProps = {
  testID?: string;
  width?: number | string;
  height: number;
  style?: StyleProp<ViewStyle>;
};

export default function ReservedSpace({ testID, width = '100%', height, style }: ReservedSpaceProps) {
  return <View testID={testID} style={[{ width, height }, style]} />;
}
