import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import PublicTripDetail from '@/components/trips/PublicTripDetail'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

export default function TripDetailScreen() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id?: string }>()
  const tripId = Number(params.id)

  // BottomDock на native — absolute-оверлей высотой tabBarHeight + safe-area,
  // поэтому скролл обязан зарезервировать её снизу. Без резерва кнопка
  // «Отправить заявку» формы «Хочу поехать» остаётся под доком и недоступна.
  const contentStyle = useMemo(
    () => [
      styles.content,
      {
        paddingBottom:
          (LAYOUT?.tabBarHeight ?? 56) + insets.bottom + DESIGN_TOKENS.spacing.xl,
      },
    ],
    [styles.content, insets.bottom],
  )

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={contentStyle}
      // На экране живёт форма «Хочу поехать»: без `handled` первый тап по кнопке
      // сабмита при открытой клавиатуре только прячет клавиатуру и теряется.
      keyboardShouldPersistTaps="handled"
      testID="trip-detail-scroll"
    >
      <View style={styles.inner}>
        {Number.isFinite(tripId) ? <PublicTripDetail tripId={tripId} /> : null}
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 760 },
  })
