import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

type ReservedSpaceProps = {
  testID?: string;
  width?: ViewStyle['width'];
  height: number;
  style?: StyleProp<ViewStyle>;
};

export default function ReservedSpace({ testID, width, height, style }: ReservedSpaceProps) {
  return <View testID={testID} style={[{ width, height }, style]} />;
}
