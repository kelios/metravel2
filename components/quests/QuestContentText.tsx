import React, { createContext, useContext, useMemo } from 'react'
import { Platform, Text, type TextProps } from 'react-native'
import { quotedCyrillicSegments } from '@/utils/cyrillicLanguage'
import type { QuestStep } from './types'

/**
 * #2473: текст перевода квеста на клиентском экране.
 *
 * Переводы PL/EN цитируют вывески кириллицей («Kawiarnia «Ландыш»»). В
 * статическом HTML их размечает `markCyrillicLanguage` (#2472), а экран, который
 * монтируется на клиенте, выводил тот же текст без языка — программа чтения
 * произносила «Ландыш» по-польски. Каждый текст квеста (название, место,
 * история, задание, подсказка, финал) идёт через этот компонент: на web
 * кириллический фрагмент получает вложенный `<Text lang>` языка оригинала, на
 * native рендер прежний — проп `lang` там не значит ничего.
 */
type QuestContentLanguage = { contentLocale?: string; countryCode?: string }

/** Язык текста квеста — `contentLocale` бандла; один для экрана и печатной версии. */
export function questContentLocale(
  intro: Pick<QuestStep, 'contentLocale'> | undefined,
  steps: ReadonlyArray<Pick<QuestStep, 'contentLocale'>>,
): string | undefined {
  return intro?.contentLocale ?? steps.find((step) => step.contentLocale)?.contentLocale
}

const QuestContentLanguageContext = createContext<QuestContentLanguage>({})

export function QuestContentLanguageProvider({
  contentLocale,
  countryCode,
  children,
}: QuestContentLanguage & { children: React.ReactNode }) {
  const value = useMemo(() => ({ contentLocale, countryCode }), [contentLocale, countryCode])
  return <QuestContentLanguageContext.Provider value={value}>{children}</QuestContentLanguageContext.Provider>
}

// RN-web передаёт `lang` в DOM (`react-native-web/dist/exports/Text`), а типы RN его не знают.
const LangText = Text as unknown as React.ComponentType<TextProps & { lang?: string }>

export type QuestContentTextProps = Omit<TextProps, 'children'> & QuestContentLanguage & { children: string | null | undefined }

export default function QuestContentText({ children, contentLocale, countryCode, ...textProps }: QuestContentTextProps) {
  const inherited = useContext(QuestContentLanguageContext)
  const language = useMemo(() => ({
    contentLocale: contentLocale ?? inherited.contentLocale,
    countryCode: countryCode ?? inherited.countryCode,
  }), [contentLocale, countryCode, inherited])
  const segments = useMemo(
    () => (Platform.OS === 'web' ? quotedCyrillicSegments(children, language) : null),
    [children, language],
  )
  if (!segments) return <Text {...textProps}>{children}</Text>
  return (
    <Text {...textProps}>
      {segments.map((segment, index) =>
        segment.lang ? <LangText key={index} lang={segment.lang}>{segment.text}</LangText> : segment.text,
      )}
    </Text>
  )
}
