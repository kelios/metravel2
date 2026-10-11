import React, { useMemo } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { fetchEmailSubscriptionStatus } from '@/api/emailSubscription'
import { queryKeys } from '@/api/queryKeys'
import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useQueryOwner } from '@/hooks/useQueryOwner'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { readRetryOnce } from '@/utils/queryRetryPolicy'

export default function BookJobBackgroundHint({ jobId, showLink = false, showBackground = true }: { jobId: string; showLink?: boolean; showBackground?: boolean }) {
  const owner = useQueryOwner()
  const router = useRouter()
  const colors = useThemedColors()
  const { t } = useTranslation()
  const styles = useMemo(() => StyleSheet.create({
    container: { gap: DESIGN_TOKENS.spacing.sm },
    text: { color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm, flexShrink: 1 },
  }), [colors])
  const emailQuery = useQuery({
    queryKey: queryKeys.emailSubscriptionStatus(owner),
    queryFn: fetchEmailSubscriptionStatus,
    enabled: Boolean(owner) && showBackground && Platform.OS === 'web',
    staleTime: 5 * 60_000,
    retry: readRetryOnce,
  })
  const email = owner ? emailQuery.data?.email : null
  return (
    <View style={styles.container}>
      {showBackground ? <Text style={styles.text}>
        {email ? t('export:components.export.BookJob.backgroundEmail', { email }) : t('export:components.export.BookJob.background')}
      </Text> : null}
      {showLink ? <Button
        label={t('export:components.export.BookJob.open')}
        onPress={() => router.push({ pathname: '/book-exports/[job_id]', params: { job_id: jobId } })}
        variant="outline"
        size="sm"
      /> : null}
    </View>
  )
}
