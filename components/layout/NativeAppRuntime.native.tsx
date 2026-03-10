import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { useThemedColors } from '@/hooks/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NativeAppRuntime() {
  const colors = useThemedColors();
  const currentColorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      const NavigationBar = require('expo-navigation-bar');
      NavigationBar.setBackgroundColorAsync(colors.background);
      NavigationBar.setButtonStyleAsync(
        currentColorScheme === 'dark' ? 'light' : 'dark'
      );
    } catch {
      // expo-navigation-bar not available — ok
    }
  }, [colors.background, currentColorScheme]);

  usePushNotifications({
    autoRequest: false,
  });

  return null;
}
