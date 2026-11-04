import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import Button from '@/components/ui/Button'
import { Body, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { Travel } from '@/types/types'
import { type RouteTask, type RouteTaskEdition, useGamesMediaManifest, useRouteTasks } from './gamesMedia'
import { matchRouteTaskStops } from './routeTaskStops'

const { radii, spacing, touchTarget } = DESIGN_TOKENS
type RouteTaskStatus = 'done' | 'skipped'

function StopTask({ task, lang }: { task: RouteTask & { stopName: string }; lang: string }) {
  const [status, setStatus] = useState<RouteTaskStatus>()
  const { t } = useTranslation()
  const colors = useThemedColors()

  return (
    <details style={{ borderTop: `1px solid ${colors.border}` }}>
      <summary style={{ minHeight: touchTarget.minHeight, paddingBlock: spacing.sm, color: colors.text, cursor: 'pointer' }}>
        <span lang={lang}>{task.stopName}</span>
      </summary>
      <View style={styles.task}>
        <Heading level={3} lang={lang}>{task.title}</Heading>
        <Body lang={lang}>{task.instruction}</Body>
        <View style={styles.actions}>
          <Button label={t('gamesStatic:routeTaskDone')} variant={status === 'done' ? 'soft' : 'primary'} onPress={() => setStatus('done')} />
          <Button label={t('gamesStatic:skip')} variant={status === 'skipped' ? 'soft' : 'outline'} onPress={() => setStatus('skipped')} />
        </View>
        <Body muted aria-live="polite">
          {status === 'done' && t('gamesStatic:routeTaskDoneStatus')}
          {status === 'skipped' && t('gamesStatic:routeTaskSkippedStatus')}
        </Body>
      </View>
    </details>
  )
}

function PublishedRouteTasks({ edition, points }: { edition: RouteTaskEdition; points: Travel['travelAddress'] }) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const { data, isPending, isError, isFetching, refetch } = useRouteTasks(edition)
  const stops = data ? matchRouteTaskStops(data, points) : []

  return (
    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]} testID="travel-route-tasks">
      <Heading level={2}>{t('gamesStatic:routeTasksTitle')}</Heading>
      {isPending && <Body aria-live="polite">{t('gamesStatic:walkLoading')}</Body>}
      {!data && isError && (
        <View style={styles.error}>
          <Body accessibilityRole="alert">{t('gamesStatic:walkLoadError')}</Body>
          <Button
            label={t('gamesStatic:retry')}
            variant="outline"
            loading={isFetching}
            onPress={() => { void refetch() }}
          />
        </View>
      )}
      {data && (stops.length === 0 ? <Body>{t('gamesStatic:routeTasksUnavailable')}</Body> : (
        <>
          <Body muted>{t('gamesStatic:routeTasksNote')}</Body>
          {stops.map(task => <StopTask key={task.id} task={task} lang={edition.locale} />)}
        </>
      ))}
    </View>
  )
}

export default function TravelRouteTasks({ travelId, points }: { travelId: number; points: Travel['travelAddress'] }) {
  const { data } = useGamesMediaManifest()
  const edition = data?.routeTasks.find(item => item.travelId === travelId)
  return edition ? <PublishedRouteTasks key={edition.dataUrl} edition={edition} points={points} /> : null
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderRadius: radii.lg },
  task: { gap: spacing.sm, paddingBottom: spacing.sm },
  error: { alignItems: 'flex-start', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
})
