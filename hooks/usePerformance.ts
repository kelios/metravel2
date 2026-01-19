import usePerformanceOptimization from './usePerformanceOptimization'

export * from './useAdvancedPerformance'
export * from './usePerformanceOptimization'

export function usePerformance() {
  return usePerformanceOptimization()
}
