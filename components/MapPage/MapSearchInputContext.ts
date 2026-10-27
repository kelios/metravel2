import { createContext, type ElementType, type RefAttributes } from 'react'
import { type TextInputInstance, TextInput, type TextInputProps } from 'react-native'

// Native sheets supply their keyboard-aware input. Ordinary panels (including
// native tablets) and web keep RN TextInput without requiring a sheet provider.
export const MapSearchInputContext = createContext<
  ElementType<TextInputProps & RefAttributes<TextInputInstance>>
>(TextInput)
