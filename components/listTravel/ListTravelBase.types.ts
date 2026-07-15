import type Feather from '@expo/vector-icons/Feather';

export type ListTravelBaseProps = {
  primaryAction?: {
    accessibilityHint?: string;
    iconName: keyof typeof Feather.glyphMap;
    label: string;
    onPress: () => void;
    testID: string;
  };
};
