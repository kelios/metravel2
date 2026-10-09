import { AsyncLocalStorage } from 'node:async_hooks'

export { getOptimalTextPosition, getOptimalOverlayOpacity, getOptimalOverlayColor,
  getOptimalTextColor } from '../../utils/imageAnalysis'

export interface WorkerImageComposition {
  topBusy: number
  centerBusy: number
  bottomBusy: number
}
export interface WorkerImageAnalyzer {
  brightness: (imageUrl: string) => Promise<number>
  composition: (imageUrl: string) => Promise<WorkerImageComposition>
}

const analyzers = new AsyncLocalStorage<WorkerImageAnalyzer>()
export const withImageAnalysis = <T>(analyzer: WorkerImageAnalyzer, run: () => T): T => analyzers.run(analyzer, run)

export async function analyzeImageBrightness(imageUrl: string): Promise<number> {
  const analyzer = analyzers.getStore()
  if (!analyzer || !imageUrl) return 128
  const value = await analyzer.brightness(imageUrl)
  if (!Number.isFinite(value) || value < 0 || value > 255) throw new Error('Invalid worker image brightness')
  return value
}

export async function analyzeImageComposition(imageUrl: string): Promise<WorkerImageComposition> {
  const analyzer = analyzers.getStore()
  if (!analyzer || !imageUrl) return { topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 }
  const composition = await analyzer.composition(imageUrl)
  if (Object.values(composition).some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('Invalid worker image composition')
  }
  return composition
}
