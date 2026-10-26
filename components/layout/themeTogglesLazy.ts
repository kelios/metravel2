import { lazy } from 'react'

// Переключатели темы — подэкран «Тема оформления» листа «Ещё» (#2779): лист
// грузится с доком, а сами переключатели — только когда подэкран открыт.
export const ThemeToggleLazy = lazy(() => import('@/components/layout/ThemeToggle'))
export const SeasonalThemeToggleLazy = lazy(() => import('@/components/layout/SeasonalThemeToggle'))
