import React from 'react'

import QuestVersionLinks from '@/components/quests/QuestVersionLinks'
import { useQuestVersionNavigation } from '@/hooks/useQuestVersionNavigation'
import { useLocale } from '@/i18n/LocaleProvider'

type Props = { onChosen?: () => void; testIDPrefix?: string }
const PreferenceOptions = require('./LanguageOptionList.tsx').default as React.ComponentType<Props>

export default function LanguageOptionList(props: Props) {
  const navigation = useQuestVersionNavigation()
  const { setLocale } = useLocale()
  if (!navigation?.bound) return <PreferenceOptions {...props} />
  return (
    <QuestVersionLinks
      projection={navigation.projection}
      currentLocale={navigation.locale}
      onSelectLocale={setLocale}
      {...props}
    />
  )
}
