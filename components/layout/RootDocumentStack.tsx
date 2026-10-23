import { Stack } from 'expo-router'
import { Platform } from 'react-native'
import { DocumentRouteRegistrationProvider, isDeniedEditorScreen, isNotFoundScreen, useDocumentView } from '@/components/layout/documentView'
import NotFoundScreen from '@/components/screens/NotFoundScreen'

export default function RootDocumentStack() {
  const documentView = useDocumentView()
  return (
    <Stack
      screenOptions={{ headerShown: false }}
      screenLayout={Platform.OS === 'web'
        ? ({ children, navigation, route }) => {
          const ownRoute = navigation.getState().routes.find(candidate => candidate.key === route.key)
          const notFound = navigation.isFocused() && (isNotFoundScreen(route)
            || isDeniedEditorScreen(documentView?.deniedEditorPathname, ownRoute))
          return <>
            {notFound ? <NotFoundScreen /> : null}
            <DocumentRouteRegistrationProvider value={notFound}>{children}</DocumentRouteRegistrationProvider>
          </>
        }
        : undefined}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  )
}
