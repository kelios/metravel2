import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useFocusEffect } from 'expo-router'

import { useNativeBottomChromeOcclusion } from '@/components/layout/bottomChromeInset'
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
  const { register, release } = useNativeBottomChromeOcclusion()
  const owner = useId()
  const footerRef = useRef<View>(null)
  const focused = useRef(false)
  const generation = useRef(0)
  const { width, height } = useWindowDimensions()
  const visible = isMobile && Boolean(onPrimary || onBack)
  const measureFooter = useCallback(() => {
    if (!focused.current || Platform.OS === 'web') return
    const request = ++generation.current
    footerRef.current?.measureInWindow((_x, top, _width, measuredHeight) => {
      if (!focused.current || request !== generation.current || measuredHeight <= 0) return
      register(owner, top)
    })
  }, [owner, register])
  useFocusEffect(useCallback(() => {
    if (!visible || Platform.OS === 'web') return
    focused.current = true
    measureFooter()
    return () => {
      focused.current = false
      generation.current += 1
      release(owner)
    }
  }, [visible, measureFooter, owner, release]))
  useEffect(() => {
    measureFooter()
  }, [measureFooter, width, height])
  useEffect(() => () => {
    focused.current = false
    generation.current += 1
    release(owner)
  }, [owner, release])

  // #1038 перенёс основное действие из шапки в футер, но потерял компактную
  // подпись: «К публикации (шаг 6 из 6)» не влезает рядом с «Назад» и обрезается.
  // Счётчик шага уже показан в шапке чипом «Шаг 6/6 · 100%», поэтому в кнопке он
  // лишний. Полный текст остаётся в accessibilityLabel.
  const compactPrimaryLabel = useMemo(() => {
    if (!primaryLabel) return ''
    const pattern = i18nT('travel:components.travel.TravelWizardHeader.compactStepSuffixPattern')
    try {
      return primaryLabel.replace(new RegExp(pattern, 'i'), '').trim() || primaryLabel
    } catch {
      return primaryLabel
    }
  }, [primaryLabel])

  if (!isMobile) return null
  if (!onPrimary && !onBack) return null

  return (
    <View
      ref={footerRef}
      collapsable={false}
      onLayout={measureFooter}
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
          label={compactPrimaryLabel}
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
