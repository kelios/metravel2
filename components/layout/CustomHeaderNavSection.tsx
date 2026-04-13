import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { PRIMARY_HEADER_NAV_ITEMS } from '@/constants/headerNavigation';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { handleHeaderNavPress } from './customHeaderNavModel';

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
            onPress={() => handleHeaderNavPress(router, item.path, item.external)}
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
