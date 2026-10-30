import type { ComponentProps } from 'react'
import { Stack, useIsFocused } from 'expo-router'
import { Platform } from 'react-native'
import { DocumentRouteRegistrationProvider, isBookHydrationScreen, isDeniedEditorScreen, isNotFoundScreen, useDocumentView } from '@/components/layout/documentView'
import NotFoundScreen from '@/components/screens/NotFoundScreen'

type ScreenLayoutProps = Parameters<NonNullable<ComponentProps<typeof Stack>['screenLayout']>>[0]
type WebDocumentScreenLayoutProps = Pick<ScreenLayoutProps, 'children' | 'navigation' | 'route'> & {
  deniedEditorPathname: string | undefined
  bookHydrationPathname: string | undefined
}

// The layout element renders inside the screen's own navigation/focus
// providers, so focus is read through the hook: expo-router 58 warns when
// `navigation.isFocused()` runs during render (stale-focus guard).
function WebDocumentScreenLayout({ children, navigation, route, deniedEditorPathname, bookHydrationPathname }: WebDocumentScreenLayoutProps) {
  const ownRoute = navigation.getState().routes.find((candidate: { key: string }) => candidate.key === route.key)
  const notFound = useIsFocused() && (isNotFoundScreen(route)
    || isDeniedEditorScreen(deniedEditorPathname, ownRoute)
    || isBookHydrationScreen(bookHydrationPathname, ownRoute))
  return <>
    {notFound ? <NotFoundScreen /> : null}
    <DocumentRouteRegistrationProvider value={notFound}>{children}</DocumentRouteRegistrationProvider>
  </>
}

export default function RootDocumentStack() {
  const documentView = useDocumentView()
  return (
    <Stack
      screenOptions={{ headerShown: false }}
      screenLayout={Platform.OS === 'web'
        ? ({ children, navigation, route }) => (
          <WebDocumentScreenLayout navigation={navigation} route={route} deniedEditorPathname={documentView?.deniedEditorPathname} bookHydrationPathname={documentView?.bookHydrationPathname}>
            {children}
          </WebDocumentScreenLayout>
        )
        : undefined}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  )
}
