import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import PublicTripDetail from '@/components/trips/PublicTripDetail'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { LAYOUT } from '@/constants/layout'
import { useSoftKeyboardInset } from '@/hooks/useSoftKeyboardInset'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

export default function TripDetailScreen() {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const { rootBottomOverlap } = useSoftKeyboardInset()
  const params = useLocalSearchParams<{ id?: string }>()
  const tripId = Number(params.id)

  // Пустой footer — намеренно отдельный layout-node, а не padding ScrollView:
  // Android на реальном устройстве не оставлял contentContainer padding
  // достижимым после последней CTA. При открытой IME root не resize-ится, поэтому
  // footer переключается с dock reserve на фактическое keyboard overlap.
  const bottomReserve = useMemo(
    () =>
      (rootBottomOverlap > 0
        ? rootBottomOverlap
        : (LAYOUT?.tabBarHeight ?? 56) + insets.bottom) + DESIGN_TOKENS.spacing.xl,
    [insets.bottom, rootBottomOverlap],
  )

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      // На экране живёт форма «Хочу поехать»: без `handled` первый тап по кнопке
      // сабмита при открытой клавиатуре только прячет клавиатуру и теряется.
      keyboardShouldPersistTaps="handled"
      testID="trip-detail-scroll"
    >
      <View style={styles.inner}>
        {Number.isFinite(tripId) ? <PublicTripDetail tripId={tripId} /> : null}
      </View>
      <View
        accessible={false}
        pointerEvents="none"
        style={{ height: bottomReserve }}
        testID="trip-detail-bottom-reserve"
      />
    </ScrollView>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, alignItems: 'center' },
    inner: { width: '100%', maxWidth: 760 },
  })
