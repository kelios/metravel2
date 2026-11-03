import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import Button from '@/components/ui/Button'
import { useAdventAdminPreview } from '@/hooks/useAdventAdminPreview'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { asBottomDimension, useBottomChromeInset } from '@/components/layout/bottomChromeInset'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_ROUTE } from '@/constants/advent'
import { useAdventCampaign, type AdventDoorView } from '@/hooks/useAdventCampaign'
import { useAdventCampaignQuery, useAdventServerSync } from '@/hooks/useAdventApi'
import { useBreakpoints } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'
import { headingLevel1Props } from '@/utils/webProps'
import { buildCanonicalUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { webTouchScrollStyle } from '@/utils'
import { selectServerCreditedDays } from '@/utils/advent/adventCalendar'
import AdventDockBar from './AdventDockBar'
import AdventDockContent from './AdventDockContent'
import AdventDoorSheet from './AdventDoorSheet'
import AdventHouseFacade from './AdventHouseFacade'
import AdventStage from './AdventStage'
import { ADVENT_DOCK_MIN_WIDTH, ADVENT_DOCK_WIDTH, ADVENT_SCREEN_LAYOUT } from './adventScreenLayout'

// Отдельным чанком: тост тянет весь контур значков, а статический импорт
// перекраивал общие чанки сайта (бюджет начальных запросов `/search`).
const BadgeUnlockToast = lazy(() => import('@/components/achievements/BadgeUnlockToast'))

/** Экран `/advent`: дом с 24 дверцами на весь экран, прогресс, бонусы и правила — в док-панели (#2861). */
export default function AdventScreen() {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const serverCampaign = useAdventCampaignQuery()
  const campaign = useAdventCampaign({ serverCampaign })
  const { doors, ready, isAuthenticated, openDoor, completeTask } = campaign
  const preview = useAdventAdminPreview(doors, campaign.hydrated, campaign.now)
  const serverCreditedDays = useMemo(() => selectServerCreditedDays(campaign.campaign.doors), [campaign.campaign])
  const sync = useAdventServerSync({
    ownerKey: campaign.ownerKey,
    localProgress: campaign.progress,
    enabled: campaign.hydrated && !preview.active,
    serverCreditedDays,
  })
  // Серия считается сервером по датам открытия (#2864); до синхронизации — локальная.
  const streak = sync.serverStreak ?? campaign.streak
  const { width } = useBreakpoints()
  const isWide = width >= ADVENT_DOCK_MIN_WIDTH
  // Ширина 0 — статический HTML web до гидратации: там нужны оба узла, лишний прячет critical CSS.
  // После замера панель живёт в одном месте, иначе на телефоне её содержимое (таймер, шеринг)
  // монтировалось бы дважды — в скрытой колонке и в листе.
  const widthKnown = width > 0
  const bottomInset = useBottomChromeInset().bottom
  const params = useLocalSearchParams<{ day?: string }>()
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Вступление и правила живут в док-панели (на телефоне — в её листе), не в ⓘ шапки.
  useScreenHeader({ title: i18nT('adventStatic:page.title') })

  const selectedDoor = useMemo(() => doors.find((door) => door.day === selectedDay) ?? null, [doors, selectedDay])

  const handlePressDoor = useCallback(
    (door: AdventDoorView) => {
      if (door.state === 'locked' || !ready || !campaign.hydrated) return
      if (door.state === 'available') {
        sendAnalyticsEvent('Advent_DoorOpen', { day: door.day, kind: door.kind, guest: !isAuthenticated })
        openDoor(door.day, campaign.now)
        // Дверца-подарок без действия засчитывается самим открытием — только аккаунту.
        if (door.task.type === 'open' && isAuthenticated) completeTask(door.day, campaign.now)
      }
      setSelectedDay(door.day)
    },
    [ready, isAuthenticated, openDoor, completeTask, campaign.now, campaign.hydrated],
  )

  // Возврат после входа гостя (`/advent?day=N`): один раз открываем ту же дверцу.
  const handledDayParam = useRef<string | null>(null)
  useEffect(() => {
    const raw = typeof params.day === 'string' ? params.day : null
    if (preview.active || !ready || !campaign.hydrated || !raw || handledDayParam.current === raw) return
    handledDayParam.current = raw
    const door = doors.find((item) => item.day === Number(raw))
    // Тот же путь, что и тап по плитке: дверца открывается и зачитывается новому владельцу.
    if (door) handlePressDoor(door)
  }, [ready, campaign.hydrated, params.day, doors, handlePressDoor, preview.active])

  const handleCompleteTask = useCallback(
    (day: number) => {
      completeTask(day, campaign.now)
    },
    [completeTask, campaign.now],
  )

  const disabled = !ready || !campaign.hydrated
  const pressDoor = preview.active ? (door: AdventDoorView) => preview.selectDay(door.day) : handlePressDoor
  const renderDockContent = (onPressDoor: (door: AdventDoorView) => void) => (
    <AdventDockContent
      campaign={preview.active ? { ...campaign, doors: preview.doors } : campaign}
      streak={streak}
      syncState={sync.state}
      preview={preview.active}
      disabled={disabled}
      onPressDoor={onPressDoor}
    />
  )

  return (
    <View style={[styles.root, { paddingBottom: asBottomDimension(bottomInset) }]} {...SCREEN_CONTENT_FIRST_PROPS}>
      <InstantSEO
        headKey="advent"
        title={i18nT('seoStatic:root.advent.title')}
        description={i18nT('seoStatic:root.advent.description')}
        canonical={buildCanonicalUrl(ADVENT_ROUTE)}
        image={DEFAULT_OG_IMAGE_PATH}
      />
      {preview.allowed ? (
        <View style={styles.previewControls}>
          <Button
            label={t(preview.active ? 'adventStatic:preview.exit' : 'adventStatic:preview.enter')}
            onPress={() => {
              setSelectedDay(null)
              preview.toggle()
            }}
            variant="outline"
            testID="advent-preview-toggle"
          />
          {preview.active ? <Text style={styles.previewDescription}>{t('adventStatic:preview.description')}</Text> : null}
        </View>
      ) : null}
      <View
        style={[styles.body, breakpointStyle(ADVENT_SCREEN_LAYOUT, 'body', isWide)]}
        testID="advent-screen"
        {...breakpointLayoutProps(ADVENT_SCREEN_LAYOUT, 'body')}
      >
        <AdventStage>
          <AdventHouseFacade doors={preview.doors} todayDay={campaign.todayDoor?.day} disabled={disabled} onPressDoor={pressDoor} />
        </AdventStage>
        {isWide || !widthKnown ? (
          <View
            style={[styles.dock, breakpointStyle(ADVENT_SCREEN_LAYOUT, 'dock', isWide)]}
            testID="advent-dock"
            {...breakpointLayoutProps(ADVENT_SCREEN_LAYOUT, 'dock')}
          >
            <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.dockScroll}>
              {/* На телефоне h1 — заголовок шапки; на desktop шапка без заголовка, h1 — здесь. */}
              <Text style={styles.dockTitle} {...(isWide ? headingLevel1Props() : null)}>
                {i18nT('adventStatic:page.title')}
              </Text>
              {renderDockContent(pressDoor)}
            </ScrollView>
          </View>
        ) : null}
        {/* Широкий экран после гидратации — только колонка; до неё полосу прячет critical CSS. */}
        {isWide ? null : (
          <View style={breakpointStyle(ADVENT_SCREEN_LAYOUT, 'dockBar', isWide)} {...breakpointLayoutProps(ADVENT_SCREEN_LAYOUT, 'dockBar')}>
            <AdventDockBar
              openedCount={campaign.openedCount}
              nextDoor={campaign.nextDoor}
              now={campaign.now}
              hydrated={campaign.hydrated}
              streak={streak}
              renderContent={(runAfterClose) => renderDockContent((door) => runAfterClose(() => pressDoor(door)))}
            />
          </View>
        )}
      </View>
      <AdventDoorSheet
        door={preview.active ? preview.selectedDoor : selectedDoor}
        preview={preview.active}
        isAuthenticated={isAuthenticated}
        creditedDays={preview.active ? undefined : sync.creditedDays}
        campaignYear={campaign.campaign.year}
        onClose={() => preview.active ? preview.selectDay(null) : setSelectedDay(null)}
        onCompleteTask={preview.active ? preview.completeTask : handleCompleteTask}
      />
      {/* Значки адвента выдаёт сервер после синхронизации (#2864) — тост как в квестах. */}
      {isAuthenticated && !preview.active ? (
        <Suspense fallback={null}>
          <BadgeUnlockToast enabled />
        </Suspense>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    previewControls: {
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      padding: DESIGN_TOKENS.spacing.sm,
    },
    previewDescription: { color: colors.textSecondary, textAlign: 'center' },
    body: { flex: 1, minHeight: 0 },
    dock: {
      width: ADVENT_DOCK_WIDTH,
      flexShrink: 0,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      backgroundColor: colors.surface,
    },
    dockScroll: { padding: DESIGN_TOKENS.spacing.md, paddingBottom: DESIGN_TOKENS.spacing.xl, gap: DESIGN_TOKENS.spacing.md },
    dockTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.text },
  })
