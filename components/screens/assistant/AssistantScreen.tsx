/**
 * Экран ассистента сайта `/assistant` (#2460). Доступен только под флагом
 * `EXPO_PUBLIC_AI_ASSISTANT` (роут `app/(tabs)/assistant.tsx` без флага отдаёт
 * «страница не найдена»). Один макет для desktop и телефона: лента вопросов
 * и ответов, под ней композер; desktop лишь сужает колонку до 760px.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type ScrollViewInstance, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { usePathname, useIsFocused, useRouter } from 'expo-router'

import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import UIButton from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { getActiveLocale, translate as i18nT } from '@/i18n'
import { isPhoneLayout } from '@/utils/phoneLayout'
import { buildCanonicalUrl } from '@/utils/seo'

import { ASSISTANT_SEO } from './assistantSeo'
import { AssistantComposer } from './AssistantComposer'
import { AssistantTurnCard } from './AssistantTurnCard'
import { createAssistantStyles } from './assistantStyles'
import { useAssistantChat } from './useAssistantChat'

const EXAMPLE_KEYS = ['aiAssistStatic:ask.example1', 'aiAssistStatic:ask.example2', 'aiAssistStatic:ask.example3'] as const

export default function AssistantScreen() {
  const pathname = usePathname()
  const isFocused = useIsFocused()
  const router = useRouter()
  const colors = useThemedColors()
  const { width, isPhone, isLargePhone } = useResponsive()
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])
  // До гидратации на web — desktop-ветка, чтобы серверный и первый клиентский рендер совпали.
  const isMobile = Platform.OS === 'web' && !isMounted ? false : isPhoneLayout({ width, isPhone, isLargePhone })
  const styles = useMemo(() => createAssistantStyles(colors, isMobile), [colors, isMobile])

  useScreenHeader({
    title: i18nT('aiAssistStatic:ask.title'),
    info: [i18nT('aiAssistStatic:ask.info')],
  })

  const locale = getActiveLocale()
  const chat = useAssistantChat({ locale })
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<ScrollViewInstance | null>(null)

  const dockPadding = useScrollBottomPadding(12)
  const bottomInset = Platform.OS === 'web' && !isMobile ? 12 : asBottomDimension(dockPadding)

  const lastTurn = chat.turns[chat.turns.length - 1]
  const lastAnswerLength = lastTurn?.answer.length ?? 0
  useEffect(() => {
    if (!chat.turns.length) return
    const handle = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    return () => clearTimeout(handle)
  }, [chat.turns.length, lastAnswerLength, lastTurn?.status])

  // Зависимости — конкретные поля, а не весь `chat`: объект хука новый на каждый
  // кадр стрима, и от него эти колбэки менялись бы 25 раз в секунду, обнуляя
  // `memo` композера.
  const { ask, clearInputError, inputError } = chat
  const send = useCallback(
    (question: string) => {
      setDraft('')
      void ask(question)
    },
    [ask],
  )

  const onChangeDraft = useCallback(
    (value: string) => {
      setDraft(value)
      if (inputError === 'tooLong') clearInputError()
    },
    [clearInputError, inputError],
  )

  const openCatalog = useCallback(() => {
    router.push('/search')
  }, [router])

  const examples = useMemo(() => EXAMPLE_KEYS.map((key) => i18nT(key)), [])

  return (
    <View style={styles.screen} testID="assistant-screen">
      {isFocused && Platform.OS === 'web' ? (
        <InstantSEO
          headKey="assistant"
          title={i18nT(ASSISTANT_SEO.titleKey)}
          description={i18nT(ASSISTANT_SEO.descriptionKey)}
          canonical={buildCanonicalUrl(pathname || ASSISTANT_SEO.path)}
          robots="noindex, nofollow"
        />
      ) : null}
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          testID="assistant-scroll"
        >
          {chat.turns.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="message-circle"
                title={i18nT('aiAssistStatic:ask.emptyTitle')}
                description={i18nT('aiAssistStatic:ask.emptyDescription')}
                density="compact"
                variant="inspire"
                testID="assistant-empty"
              />
              <View style={styles.examplesRow}>
                {examples.map((example) => (
                  <UIButton
                    key={example}
                    variant="soft"
                    size="sm"
                    label={example}
                    labelNumberOfLines={2}
                    onPress={() => send(example)}
                    disabled={chat.busy || (chat.remaining !== null && chat.remaining <= 0)}
                    testID="assistant-example"
                  />
                ))}
              </View>
            </View>
          ) : (
            chat.turns.map((turn) => (
              <AssistantTurnCard
                key={turn.id}
                turn={turn}
                styles={styles}
                colors={colors}
                busy={chat.busy}
                onRetry={chat.retry}
                onOpenCatalog={openCatalog}
              />
            ))
          )}
        </ScrollView>
        <View style={{ paddingBottom: bottomInset }}>
          <AssistantComposer
            styles={styles}
            colors={colors}
            busy={chat.busy}
            remaining={chat.remaining}
            offTopicBlocked={chat.offTopicBlocked}
            inputError={chat.inputError}
            draft={draft}
            onChangeDraft={onChangeDraft}
            onSend={send}
            onStop={chat.stop}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}
