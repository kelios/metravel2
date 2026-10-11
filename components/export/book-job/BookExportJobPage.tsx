import React, { useEffect, useMemo } from 'react'
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router'

import FullBookJobStatus from '@/components/export/FullBookJobStatus'
import BookJobBackgroundHint from '@/components/export/book-job/BookJobBackgroundHint'
import ResponsiveContainer from '@/components/layout/ResponsiveContainer'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import ScreenHeader from '@/components/ui/ScreenHeader'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useBookExportJob } from '@/hooks/useBookExportJob'
import { isFullBookJobActive, isFullBookJobDownloadable } from '@/hooks/useFullBookExport'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { buildCanonicalUrl } from '@/utils/seo'
import { SCREEN_CONTENT_FIRST_PROPS } from '@/utils/screenContentMarker'
import { webTouchScrollStyle } from '@/utils'

export function normalizeBookJobId(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null
}

export default function BookExportJobPage() {
  const { job_id: rawJobId } = useLocalSearchParams<{ job_id?: string | string[] }>()
  const jobId = normalizeBookJobId(rawJobId)
  const path = jobId ? `/book-exports/${jobId}` : '/export'
  const router = useRouter()
  const isFocused = useIsFocused()
  const { t } = useTranslation()
  const colors = useThemedColors()
  const { authReady, isAuthenticated, requireAuth } = useRequireAuth({ redirect: path, replace: true })
  const isWeb = Platform.OS === 'web'
  const controller = useBookExportJob(jobId, isWeb && authReady && isAuthenticated && isFocused)
  const bottomPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.xl)
  const header = useScreenHeader({ title: t('export:components.export.BookJob.title'), info: [t('export:components.export.BookJob.description')] })
  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: asBottomDimension(bottomPadding) },
    stack: { gap: DESIGN_TOKENS.spacing.lg },
    hint: { color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm },
  }), [bottomPadding, colors])
  useEffect(() => {
    if (isWeb && isFocused && authReady && !isAuthenticated) requireAuth()
  }, [authReady, isAuthenticated, isFocused, isWeb, requireAuth])
  const goToExport = () => router.push('/export')
  const loading = !authReady || (isAuthenticated && controller.isObservingJob && !controller.isReconnecting)
  const job = controller.job
  const fileUnavailable = job?.status === 'done' && !isFullBookJobDownloadable(job)
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {isFocused ? <InstantSEO
        headKey="book-export-job"
        title={t('export:components.export.BookJob.title')}
        description={t('export:components.export.BookJob.description')}
        canonical={buildCanonicalUrl(path)}
        robots="noindex, nofollow"
      /> : null}
      <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.content}>
        <ResponsiveContainer maxWidth="md">
          <View style={styles.stack}>
            <ScreenHeader header={header} />
            <View style={styles.stack} {...SCREEN_CONTENT_FIRST_PROPS}>
              {!isWeb ? <EmptyState density="compact" icon="book" title={t('export:components.export.BookJob.browserOnly')} />
                : loading ? <SkeletonLoader width="100%" height={180} borderRadius={DESIGN_TOKENS.radii.md} />
                  : !isAuthenticated ? <EmptyState
                    density="compact"
                    icon="lock"
                    title={t('export:components.export.BookJob.signIn')}
                    action={{ label: t('export:app.tabs.export.voyti_70e887f8'), onPress: requireAuth }}
                  />
                    : !jobId || controller.isJobMissing ? <EmptyState
                      density="compact"
                      icon="book"
                      title={t('export:components.export.BookJob.notFound')}
                      action={{ label: t('export:components.export.BookJob.backToExport'), onPress: goToExport }}
                    /> : <>
                      <FullBookJobStatus
                        controller={{ ...controller, dismiss: goToExport }}
                        dismissLabel={t('export:components.export.BookJob.backToExport')}
                        showErrorCode
                      />
                      {job && isFullBookJobActive(job) ? <BookJobBackgroundHint jobId={job.job_id} /> : null}
                      {fileUnavailable ? (
                        <Text style={styles.hint}>{t('export:components.export.BookJob.fileUnavailable')}</Text>
                      ) : null}
                      {controller.isReconnecting || fileUnavailable ? <Button
                        label={t('export:components.export.BookJob.refresh')}
                        onPress={controller.refresh}
                        variant="outline"
                        size="sm"
                      /> : null}
                    </>}
            </View>
          </View>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  )
}
