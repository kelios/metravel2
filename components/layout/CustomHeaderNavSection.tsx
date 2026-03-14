import React from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { PRIMARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';

type CustomHeaderNavSectionProps = {
  activePath: string;
  styles: any;
};

export default function CustomHeaderNavSection({
  activePath,
  styles,
}: CustomHeaderNavSectionProps) {
  const router = useRouter();
  const colors = useThemedColors();

  const handleNavPress = (path: string, external?: boolean) => {
    if (external) {
      if (Platform.OS === 'web') {
        openExternalUrlInNewTab(path);
      } else {
        openExternalUrl(path);
      }
      return;
    }
    router.push(path as any);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.navContainer}
      style={styles.navScroll}
      alwaysBounceHorizontal={false}
    >
      {(PRIMARY_HEADER_NAV_ITEMS ?? []).map((item) => {
        const isActive = !item.external && activePath === item.path;
        return (
          <Pressable
            key={item.path}
            onPress={() => handleNavPress(item.path, item.external)}
            style={({ hovered, pressed }) => [
              styles.navItem,
              (hovered || pressed) && !isActive && styles.navItemHover,
              isActive && styles.navItemActive,
              globalFocusStyles.focusable,
            ]}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.iconSlot18}>
              <Feather
                name={item.icon as any}
                size={18}
                color={isActive ? colors.brandText : colors.textMuted}
              />
            </View>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
