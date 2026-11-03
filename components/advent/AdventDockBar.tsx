import { memo, useCallback, useMemo, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { useRunAfterSheetClose } from '@/components/ui/useRunAfterSheetClose'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_MAIN_DOORS } from '@/constants/advent'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventCampaignView } from '@/hooks/useAdventCampaign'
import AdventCountdown from './AdventCountdown'
import { isAdventPrelaunch } from './AdventHeader'

type Props = Pick<AdventCampaignView, 'openedCount' | 'nextDoor' | 'now' | 'hydrated'> & {
  streak: number
  /**
   * Полное содержимое док-панели — в листе по кнопке. `runAfterClose` оборачивает действие,
   * которое открывает свой лист (дверцу): сначала закрывается этот, иначе iOS второй не покажет.
   */
  renderContent: (runAfterClose: (action: () => void) => void) => ReactNode
}

/** Узкий экран: свёрнутая док-панель под домом — прогресс одной строкой и лист со всем остальным. */
function AdventDockBar({ openedCount, nextDoor, now, hydrated, streak, renderContent }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { runAfterClose, onDismiss } = useRunAfterSheetClose(close)

  return (
    <>
      <View style={styles.bar} testID="advent-dock-bar">
        <View style={styles.summary}>
          {isAdventPrelaunch(openedCount, nextDoor) ? (
            <AdventCountdown nextDoor={nextDoor} now={now} hydrated={hydrated} />
          ) : (
            <>
              <Text style={styles.progress} numberOfLines={1}>
                {i18nT('adventStatic:home.progress', { value1: formatInteger(openedCount), value2: formatInteger(ADVENT_MAIN_DOORS) })}
              </Text>
              <View style={styles.streak}>
                <Feather name="zap" size={14} color={colors.warning} />
                <Text style={styles.streakText} numberOfLines={1}>
                  {i18nT('adventStatic:header.streak', { value1: formatInteger(streak) })}
                </Text>
              </View>
            </>
          )}
        </View>
        <Button
          label={i18nT('adventStatic:panel.more')}
          variant="secondary"
          size="sm"
          icon={<Feather name="chevron-up" size={16} color={colors.text} />}
          onPress={() => setOpen(true)}
          testID="advent-dock-open"
        />
      </View>
      <BottomSheet visible={open} onClose={close} onDismiss={onDismiss} title={i18nT('adventStatic:page.title')} panelStyle={styles.panel}>
        {/* Панель листа ограничена по высоте и сама не прокручивается: без этого правила
            и шеринг на невысоком телефоне уходили бы за край без доступа. */}
        <ScrollView contentContainerStyle={styles.sheetScroll} testID="advent-dock-sheet">
          {renderContent(runAfterClose)}
        </ScrollView>
      </BottomSheet>
    </>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    summary: { flex: 1, minWidth: 0, gap: 2 },
    progress: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.text },
    streak: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xxs },
    streakText: { fontSize: 13, lineHeight: 18, color: colors.textSecondary, flexShrink: 1 },
    panel: { maxHeight: '90%' },
    sheetScroll: { paddingBottom: DESIGN_TOKENS.spacing.md },
  })

export default memo(AdventDockBar)
