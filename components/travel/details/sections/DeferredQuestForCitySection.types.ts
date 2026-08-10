import type { Travel } from '@/types/types'

// `styles` повторяет тип пропа самого `QuestForCitySection` — это стили из
// `useTravelDetailsStyles`, которые он раскладывает по вложенным ключам.
export type DeferredQuestForCitySectionProps = {
  travel: Travel
  styles: any
}
