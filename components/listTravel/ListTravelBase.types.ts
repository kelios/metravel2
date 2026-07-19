import type Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';

export type ListTravelBaseProps = {
  catalogIntro?: ReactNode;
  initialViewportWidth?: number;
  primaryAction?: {
    accessibilityHint?: string;
    iconName: keyof typeof Feather.glyphMap;
    label: string;
    onPress: () => void;
    testID: string;
  };
};
