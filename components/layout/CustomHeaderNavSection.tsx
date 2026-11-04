import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DESKTOP_BAR_NAV_ITEMS, type HeaderNavItem } from '@/constants/headerNavigation';
import NavigationLink from '@/components/ui/NavigationLink';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { handleHeaderNavPress } from './customHeaderNavModel';
import NavigationIcon from './NavigationIcon';
import { webDataSetProps } from '@/utils/webProps';

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

  const books = Platform.OS === 'web' ? DESKTOP_BAR_NAV_ITEMS.find(item => item.path === '/books') : undefined;
  const renderItem = (item: HeaderNavItem) => {
    const isActive = !item.external && activePath === item.path;
    const navigate = () => handleHeaderNavPress(router, item.path, item.external);
    const children = (
      <>
        <View style={styles.iconSlot18} {...(Platform.OS === 'web' ? webDataSetProps({ travelNavIcon: item.icon }) : {})}>
          <NavigationIcon
            name={item.icon}
            size={18}
            color={isActive ? colors.brandText : colors.textMuted}
          />
        </View>
        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
          {item.label}
        </Text>
      </>
    );
    if (Platform.OS === 'web') {
      const destination = item.external
        ? { external: true as const, href: item.path }
        : { href: item.path as Href }
      return (
        <NavigationLink
          key={item.path}
          {...destination}
          style={[styles.navItem, isActive && styles.navItemActive]}
          selected={isActive}
          accessibilityLabel={item.label}
          dataSet={{ travelNavActive: String(isActive) }}
          onNavigate={navigate}
        >
          {children}
        </NavigationLink>
      );
    }
    return (
      <Pressable
        key={item.path}
        onPress={navigate}
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
        {children}
      </Pressable>
    );
  };
  const scroll = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.navContainer}
      style={books ? styles.navRowScroll : styles.navScroll}
      alwaysBounceHorizontal={false}
    >
      {DESKTOP_BAR_NAV_ITEMS.filter(item => item !== books).map(renderItem)}
    </ScrollView>
  );
  return books ? <View style={[styles.navScroll, styles.navRow]}>{scroll}{renderItem(books)}</View> : scroll;
}
