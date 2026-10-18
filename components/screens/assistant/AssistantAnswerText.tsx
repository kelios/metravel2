/**
 * Текст ответа ассистента (#2460): markdown-lite без зависимостей.
 *
 * Модель отвечает в лёгком markdown (списки `* `, жирный `**…**`, ссылки
 * `[подпись](url)`), а страж ссылок уже оставил только адреса найденных
 * карточек. Здесь это превращается в нативный `Text`: маркеры списка, жирный,
 * ссылка карточки — нажимаемая и ведёт внутрь приложения по `source.path`.
 * Адрес, которого нет среди карточек, рисуется обычным текстом — переходов по
 * нему нет (страж такие вырезает, но рендер не доверяет и ему).
 */

import { Fragment, memo, useCallback, useMemo } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useRouter } from 'expo-router'

import { normalizeLinkKey } from '@/api/aiAssist/linkGuard'
import type { AiSource } from '@/api/aiAssist/types'

type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'link'; label: string; url: string }

const INLINE_RE = /\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s<>()[\]"'«»]+)/g
const BULLET_RE = /^\s*(?:[*\-•]|\d+[.)])\s+/
const HEADING_RE = /^\s*#{1,6}\s+/
const TRAILING_PUNCTUATION_RE = /[.,;:!?…»"')\]]+$/

export const tokenizeInline = (line: string): InlineToken[] => {
  const tokens: InlineToken[] = []
  let last = 0
  for (const match of line.matchAll(INLINE_RE)) {
    const index = match.index ?? 0
    if (index > last) tokens.push({ kind: 'text', value: line.slice(last, index) })
    if (match[1] && match[2]) {
      tokens.push({ kind: 'link', label: match[1], url: match[2] })
    } else if (match[3]) {
      tokens.push({ kind: 'bold', value: match[3] })
    } else if (match[4]) {
      const raw = match[4]
      const trimmed = raw.replace(TRAILING_PUNCTUATION_RE, '')
      tokens.push({ kind: 'link', label: trimmed, url: trimmed })
      if (trimmed.length < raw.length) tokens.push({ kind: 'text', value: raw.slice(trimmed.length) })
    }
    last = index + match[0].length
  }
  if (last < line.length) tokens.push({ kind: 'text', value: line.slice(last) })
  return tokens
}

export type AnswerLine = { bullet: boolean; tokens: InlineToken[] }

export const parseAnswer = (text: string): AnswerLine[] =>
  String(text ?? '')
    .split('\n')
    .map((rawLine) => {
      const bullet = BULLET_RE.test(rawLine)
      const line = rawLine.replace(BULLET_RE, '').replace(HEADING_RE, '')
      return { bullet, tokens: tokenizeInline(line) }
    })

type AssistantAnswerTextProps = {
  text: string
  sources: readonly AiSource[]
  style: StyleProp<TextStyle>
  linkColor: string
  testID?: string
}

function AssistantAnswerTextComponent({ text, sources, style, linkColor, testID }: AssistantAnswerTextProps) {
  const router = useRouter()
  const pathByUrl = useMemo(() => {
    const map = new Map<string, string>()
    for (const source of sources) map.set(normalizeLinkKey(source.url), source.path)
    return map
  }, [sources])
  const lines = useMemo(() => parseAnswer(text), [text])
  const open = useCallback((path: string) => () => router.push(path as never), [router])

  return (
    <Text style={style} selectable testID={testID}>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 ? '\n' : null}
          {line.bullet ? '• ' : null}
          {line.tokens.map((token, tokenIndex) => {
            if (token.kind === 'bold') {
              return (
                <Text key={tokenIndex} style={{ fontWeight: '700' }}>
                  {token.value}
                </Text>
              )
            }
            if (token.kind === 'link') {
              const path = pathByUrl.get(normalizeLinkKey(token.url))
              if (!path) return <Fragment key={tokenIndex}>{token.label}</Fragment>
              return (
                <Text
                  key={tokenIndex}
                  accessibilityRole="link"
                  onPress={open(path)}
                  style={{ color: linkColor, textDecorationLine: 'underline' }}
                  testID="assistant-answer-link"
                >
                  {token.label}
                </Text>
              )
            }
            return <Fragment key={tokenIndex}>{token.value}</Fragment>
          })}
        </Fragment>
      ))}
    </Text>
  )
}

export const AssistantAnswerText = memo(AssistantAnswerTextComponent)
