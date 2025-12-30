import type { UseTravelDetailsReturn } from '@/hooks/useTravelDetails'
import { useTravelDetails } from '@/hooks/useTravelDetails'

export function useTravelDetailsData(): UseTravelDetailsReturn {
  return useTravelDetails()
}
