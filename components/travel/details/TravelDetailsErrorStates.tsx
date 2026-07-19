import React from 'react'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Button from '@/components/ui/Button'
import { translate as i18nT } from '@/i18n'


interface ErrorStateStyles {
  safeArea: object
  errorContainer: object
  errorTitle: object
  errorText: object
  errorButton: object
  errorButtonText: object
}

interface MissingParamErrorProps {
  styles: ErrorStateStyles
  seoBlock: React.ReactNode
  onGoHome: () => void
}

export function MissingParamError({ styles, seoBlock, onGoHome }: MissingParamErrorProps) {
  return (
    <>
      {seoBlock}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer} role="alert">
          <Text style={styles.errorTitle}>{i18nT('travel:components.travel.details.TravelDetailsErrorStates.puteshestvie_ne_naydeno_9fd534f7')}</Text>
          <Text style={styles.errorText}>{i18nT('travel:components.travel.details.TravelDetailsErrorStates.v_ssylke_otsutstvuet_identifikator_puteshest_c0021f5b')}</Text>
          <Button
            onPress={onGoHome}
            variant="primary"
            label={i18nT('travel:components.travel.details.TravelDetailsErrorStates.na_glavnuyu_c35a9aeb')}
            accessibilityLabel={i18nT('travel:components.travel.details.TravelDetailsErrorStates.na_glavnuyu_c35a9aeb')}
          />
        </View>
      </SafeAreaView>
    </>
  )
}

interface LoadErrorProps {
  styles: ErrorStateStyles
  seoBlock: React.ReactNode
  errorMessage?: string
  onRetry: () => void
  onGoHome: () => void
}

function isNotFoundError(message?: string): boolean {
  if (!message) return false
  return new RegExp(i18nT('travel:components.travel.details.TravelDetailsErrorStates.notFoundPattern'), 'i').test(message)
}

function isRateLimitedError(message?: string): boolean {
  if (!message) return false
  return new RegExp(i18nT('travel:components.travel.details.TravelDetailsErrorStates.rateLimitedPattern'), 'i').test(message)
}

export function LoadError({ styles, seoBlock, errorMessage, onRetry, onGoHome }: LoadErrorProps) {
  const notFound = isNotFoundError(errorMessage)
  const rateLimited = !notFound && isRateLimitedError(errorMessage)

  let title = i18nT('travel:components.travel.details.TravelDetailsErrorStates.ne_udalos_zagruzit_puteshestvie_6ea4cf0c')
  let text = i18nT('travel:components.travel.details.TravelDetailsErrorStates.proverte_podklyuchenie_k_internetu_i_poprobu_be33bf61')
  if (notFound) {
    title = i18nT('travel:components.travel.details.TravelDetailsErrorStates.notFoundTitle')
    text = i18nT('travel:components.travel.details.TravelDetailsErrorStates.notFoundText')
  } else if (rateLimited) {
    title = i18nT('travel:components.travel.details.TravelDetailsErrorStates.rateLimitedTitle')
    text = i18nT('travel:components.travel.details.TravelDetailsErrorStates.rateLimitedText')
  }

  return (
    <>
      {seoBlock}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer} role="alert">
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.errorText}>{text}</Text>
          {!notFound && (
            <Button
              onPress={onRetry}
              variant="primary"
              label={i18nT('travel:components.travel.details.TravelDetailsErrorStates.povtorit_5acae0b1')}
              accessibilityLabel={i18nT('travel:components.travel.details.TravelDetailsErrorStates.povtorit_5acae0b1')}
            />
          )}
          <Button
            onPress={onGoHome}
            variant={notFound ? 'primary' : 'ghost'}
            style={notFound ? undefined : errorGoHomeButtonStyle}
            label={i18nT('travel:components.travel.details.TravelDetailsErrorStates.na_glavnuyu_c35a9aeb')}
            accessibilityLabel={i18nT('travel:components.travel.details.TravelDetailsErrorStates.na_glavnuyu_c35a9aeb')}
          />
        </View>
      </SafeAreaView>
    </>
  )
}

const errorGoHomeButtonStyle = {
  marginTop: 12,
} as const
