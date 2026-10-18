import React from 'react'
import { useQuestContentLocale } from '@/hooks/useQuestContentLocale'
import QuestContentText, { type QuestContentTextProps } from './QuestContentText'

/** Editorial/API text around the wizard follows the page locale, not its bundle provider. */
export default function QuestEditorialText(props: Omit<QuestContentTextProps, 'contentLocale'>) {
  const locale = useQuestContentLocale()
  return <QuestContentText {...props} contentLocale={locale} countryCode={props.countryCode ?? ''} />
}

/** Stable slot for shared cards; non-quest consumers keep their existing renderer. */
export const renderQuestEditorialText = (text: string) => <QuestEditorialText>{text}</QuestEditorialText>
