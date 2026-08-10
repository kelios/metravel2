import QuestForCitySection from '@/components/travel/details/sections/QuestForCitySection'
import type { DeferredQuestForCitySectionProps } from '@/components/travel/details/sections/DeferredQuestForCitySection.types'

// Native: чанков нет, грузить блок отдельно нечем и незачем.
export default function DeferredQuestForCitySection(props: DeferredQuestForCitySectionProps) {
  return <QuestForCitySection {...props} />
}
