import { TabRouter, integrateWithRouter, type TabRouterOptions } from 'expo-router'
import { createJSTabsProps, createStandardBottomTabNavigator, type BottomTabNavigationOptions, type BottomTabNavigationEventMap, type JSTabsProps } from 'expo-router/js-tabs'

// The web dock owns its links. Expo's placeholder tab items only serve a
// visible JS tab bar; navigation itself already knows every declared route.
// Supply the real routes to the stock view so only visited/preloaded screens
// get descriptors, hrefs and animated values during document hydration.
const RouteTabs = integrateWithRouter<
  BottomTabNavigationOptions,
  Parameters<typeof createJSTabsProps>[0]['state'],
  BottomTabNavigationEventMap,
  Pick<JSTabsProps, 'tabBar'>,
  TabRouterOptions,
  ReturnType<typeof createJSTabsProps>
>(createStandardBottomTabNavigator, TabRouter, {
  activityDefaultThreshold: 1,
  createProps: createJSTabsProps,
})

export default RouteTabs
