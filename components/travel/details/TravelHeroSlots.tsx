import TravelHeroExtras from './TravelHeroExtras'
import TravelHeroInteractiveSlider from './TravelHeroInteractiveSlider'
import { TravelHeroFavoriteToggle } from './TravelHeroFavoriteToggle'

// Native: чанков нет, грузить блоки отдельно нечем и незачем — слоты остаются
// прямыми ре-экспортами, поведение ровно то же, что до выделения пары.
// Web-половина живёт в `TravelHeroSlots.web.tsx`.
export const TravelHeroExtrasSlot = TravelHeroExtras
export const TravelHeroInteractiveSliderSlot = TravelHeroInteractiveSlider
export const TravelHeroFavoriteToggleSlot = TravelHeroFavoriteToggle
