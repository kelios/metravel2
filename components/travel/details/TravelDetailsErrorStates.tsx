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
  onGoHome: () => void
}

function isNotFoundError(message?: string): boolean {
  if (!message) return false
  return /\b404\b|not found|не найден|не существует|удалено/i.test(message)
}

export function LoadError({ styles, seoBlock, errorMessage, onRetry, onGoHome }: LoadErrorProps) {
  const notFound = isNotFoundError(errorMessage)
  const title = notFound ? 'Путешествие не найдено' : 'Не удалось загрузить путешествие'
  const text = notFound
    ? 'Возможно, оно было удалено или ссылка устарела.'
    : 'Проверьте подключение к интернету и попробуйте ещё раз.'

  return (
    <>
      {seoBlock}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer} role="alert">
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.errorText}>{text}</Text>
          {!notFound && (
            <TouchableOpacity
              onPress={onRetry}
              style={styles.errorButton}
              accessibilityRole="button"
              accessibilityLabel="Повторить"
            >
              <Text style={styles.errorButtonText}>Повторить</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onGoHome}
            style={notFound ? styles.errorButton : secondaryButtonStyle}
            accessibilityRole="button"
            accessibilityLabel="На главную"
          >
            <Text style={notFound ? styles.errorButtonText : secondaryButtonTextStyle}>
              На главную
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  )
}

const secondaryButtonStyle = {
  marginTop: 12,
  paddingHorizontal: 24,
  paddingVertical: 10,
} as const

const secondaryButtonTextStyle = {
  fontSize: 16,
  fontWeight: '600' as const,
  textDecorationLine: 'underline' as const,
  opacity: 0.8,
}
