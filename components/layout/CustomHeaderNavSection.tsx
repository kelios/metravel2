import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DESKTOP_BAR_NAV_ITEMS, type HeaderNavItem } from '@/constants/headerNavigation';
import NavigationLink from '@/components/ui/NavigationLink';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';
import { handleHeaderNavPress } from './customHeaderNavModel';
import NavigationIcon from './NavigationIcon';
import { webDataSetProps } from '@/utils/webProps';
import { useLocalizedNavHref } from '@/hooks/useLocalizedNavHref';
import { usePlacesCatalogNavigation } from '@/hooks/usePlacesCatalogNavigation';
import { placesCatalogHref } from '@/utils/placesCatalogAnalytics';

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
  const localizeHref = useLocalizedNavHref();
  const placesNavigation = usePlacesCatalogNavigation('/places', 'desktop_navigation');

  const books = Platform.OS === 'web' ? DESKTOP_BAR_NAV_ITEMS.find(item => item.path === '/books') : undefined;
  const renderItem = (navItem: HeaderNavItem) => {
    const localizedPath = navItem.external ? navItem.path : String(localizeHref(navItem.path as Href));
    const item = navItem.external ? navItem : { ...navItem, path: Platform.OS === 'web' && navItem.path === '/places'
      ? placesCatalogHref(localizedPath, 'desktop_navigation') : localizedPath };
    const isActive = !navItem.external && activePath === navItem.path;
    const navigate = () => {
      if (navItem.path === '/places') placesNavigation.onEntry();
      handleHeaderNavPress(router, item.path, item.external);
    };
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
          ref={navItem.path === '/places' ? placesNavigation.ref : undefined}
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
