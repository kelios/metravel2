import React from 'react'
import { StyleSheet, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

export interface WizardStepFooterProps {
  onBack?: () => void
  onPrimary?: () => void
  primaryLabel?: string
  primaryDisabled?: boolean
  primaryTestID?: string
}

/**
 * #1038 — Липкая нижняя панель навигации мастера на мобильном.
 *
 * Раньше кнопки «Назад»/«Далее» жили ТОЛЬКО в шапке: на телефоне шапка из-за
 * этого занимала ~24% вьюпорта (правило проекта — ≤20%), а основное действие
 * находилось вверху экрана, вне зоны большого пальца. Панель рендерится
 * сиблингом ScrollView внутри шага, поэтому забирает собственную высоту и НЕ
 * перекрывает контент (не требуется компенсирующий paddingBottom).
 *
 * На десктопе не рендерится — там действия остаются в шапке.
 */
export const WizardStepFooter = React.memo(function WizardStepFooter({
  onBack,
  onPrimary,
  primaryLabel,
  primaryDisabled = false,
  primaryTestID,
}: WizardStepFooterProps) {
  const { isHydrated, isMobile: isMobileViewport, isTablet } = useResponsive()
  const isMobile = (isHydrated && isMobileViewport) || isTablet
  const colors = useThemedColors()
  const insets = useSafeAreaInsetsSafe()

  if (!isMobile) return null
  if (!onPrimary && !onBack) return null

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: DESIGN_TOKENS.spacing.sm + (insets?.bottom ?? 0),
        },
      ]}
      testID="travel-wizard.step-footer"
    >
      {onBack ? (
        <Button
          variant="outline"
          label={i18nT('travel:components.travel.TravelWizardHeader.nazad_e9f56561')}
          icon={<Feather name="arrow-left" size={16} color={colors.text} />}
          onPress={onBack}
          style={styles.backButton}
          testID="travel-wizard.step-footer.back"
          accessibilityLabel={i18nT('travel:components.travel.TravelWizardHeader.nazad_e9f56561')}
        />
      ) : null}

      {onPrimary && primaryLabel ? (
        <Button
          variant="primary"
          label={primaryLabel}
          trailingIcon={<Feather name="arrow-right" size={16} color={colors.textOnPrimary} />}
          onPress={onPrimary}
          disabled={primaryDisabled}
          style={styles.primaryButton}
          testID={primaryTestID ?? 'travel-wizard.step-footer.primary'}
          accessibilityLabel={primaryLabel}
        />
      ) : null}
    </View>
  )
})

export default WizardStepFooter

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingTop: DESIGN_TOKENS.spacing.sm,
    borderTopWidth: 1,
  },
  backButton: {
    flexShrink: 0,
  },
  primaryButton: {
    flex: 1,
  },
})
