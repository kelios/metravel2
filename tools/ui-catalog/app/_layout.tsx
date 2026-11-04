import '../../../app/global.css'

import { Slot } from 'expo-router'

import { ThemeProvider } from '@/hooks/useTheme'

export default function CatalogLayout() {
  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  )
}
