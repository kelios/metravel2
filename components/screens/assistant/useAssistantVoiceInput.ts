import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { MAX_QUESTION_LENGTH } from '@/api/aiAssist/prompt'
import { useWebSpeechDictation, type WebSpeechErrorCode } from '@/hooks/useWebSpeechDictation'
import { getFormatLocale } from '@/i18n'

/** Что сказать посетителю после сбоя диктовки; `null` — сбой не требует объяснения. */
export type AssistantVoiceNotice = 'denied' | 'langUnsupported' | 'network' | null

export type AssistantVoiceInputArgs = {
  draft: string
  onChangeDraft: (value: string) => void
  disabled: boolean
}

export type AssistantVoiceInput = {
  /** Показывать ли кнопку: только web с Web Speech API и только после монтирования. */
  available: boolean
  listening: boolean
  interimText: string
  notice: AssistantVoiceNotice
  toggle: () => void
  stop: () => void
}

const toNotice = (code: WebSpeechErrorCode | null): AssistantVoiceNotice => {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
    case 'audio-capture':
      return 'denied'
    case 'language-not-supported':
      return 'langUnsupported'
    case 'network':
      return 'network'
    default:
      return null
  }
}

/** Фраза дописывается к черновику через один пробел и не выходит за предел вопроса. */
const appendDictatedPhrase = (draft: string, phrase: string): string => {
  const cleanPhrase = phrase.trim()
  if (!cleanPhrase) return draft.slice(0, MAX_QUESTION_LENGTH)
  const base = draft.replace(/\s+$/, '')
  const joined = base ? `${base} ${cleanPhrase}` : cleanPhrase
  return joined.slice(0, MAX_QUESTION_LENGTH)
}

/**
 * Голосовой ввод вопроса ассистента (#3351): диктовка браузера дописывает фразу
 * в черновик, вопрос не отправляет. Экран ассистента есть в статическом HTML,
 * а Web Speech API на сервере нет, поэтому до монтирования кнопка не показывается —
 * иначе серверная и клиентская разметка разойдутся при гидрации.
 */
export function useAssistantVoiceInput({ draft, onChangeDraft, disabled }: AssistantVoiceInputArgs): AssistantVoiceInput {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const dictation = useWebSpeechDictation({ lang: getFormatLocale(), continuous: false })
  const { isSupported, isListening, interimText, errorCode, start, stop, bindFinalTextHandler } = dictation

  const draftRef = useRef(draft)
  const onChangeDraftRef = useRef(onChangeDraft)
  const disabledRef = useRef(disabled)
  useEffect(() => {
    draftRef.current = draft
    onChangeDraftRef.current = onChangeDraft
    disabledRef.current = disabled
  }, [draft, onChangeDraft, disabled])

  useEffect(() => {
    bindFinalTextHandler((phrase) => {
      // `stop()` браузера ещё отдаёт фразу из уже записанного звука: после отправки вопроса
      // (поле закрыто) она не должна попасть в очищенный черновик.
      if (disabledRef.current) return
      const next = appendDictatedPhrase(draftRef.current, phrase)
      if (next !== draftRef.current) {
        // Две фразы подряд до перерисовки владельца дописываются друг за другом.
        draftRef.current = next
        onChangeDraftRef.current(next)
      }
      if (next.length >= MAX_QUESTION_LENGTH) stop()
    })
  }, [bindFinalTextHandler, stop])

  useEffect(() => {
    if (disabled && isListening) stop()
  }, [disabled, isListening, stop])

  const available = mounted && Platform.OS === 'web' && isSupported

  const toggle = useCallback(() => {
    if (!available || disabled) return
    if (isListening) {
      stop()
      return
    }
    // `start()` сбрасывает код прошлой ошибки, а с ним и `notice`.
    start()
  }, [available, disabled, isListening, start, stop])

  const notice = toNotice(errorCode)

  return useMemo(
    () => ({
      available,
      listening: available && isListening,
      interimText: available ? interimText : '',
      notice: available ? notice : null,
      toggle,
      stop,
    }),
    [available, isListening, interimText, notice, toggle, stop],
  )
}
