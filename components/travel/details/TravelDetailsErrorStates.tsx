import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

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
          <Text style={styles.errorTitle}>Путешествие не найдено</Text>
          <Text style={styles.errorText}>В ссылке отсутствует идентификатор путешествия.</Text>
          <TouchableOpacity
            onPress={onGoHome}
            style={styles.errorButton}
            accessibilityRole="button"
            accessibilityLabel="На главную"
          >
            <Text style={styles.errorButtonText}>На главную</Text>
          </TouchableOpacity>
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
}

export function LoadError({ styles, seoBlock, errorMessage, onRetry }: LoadErrorProps) {
  return (
    <>
      {seoBlock}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer} role="alert">
          <Text style={styles.errorTitle}>Не удалось загрузить путешествие</Text>
          <Text style={styles.errorText}>{errorMessage || 'Попробуйте обновить страницу.'}</Text>
          <TouchableOpacity
            onPress={onRetry}
            style={styles.errorButton}
            accessibilityRole="button"
            accessibilityLabel="Повторить"
          >
            <Text style={styles.errorButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  )
}
