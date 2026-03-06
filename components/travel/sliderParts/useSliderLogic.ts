import type { UseSliderCoreOptions, UseSliderCoreResult } from './useSliderCore';
import { useSliderCore } from './useSliderCore';

export type UseSliderLogicOptions = UseSliderCoreOptions;
export type UseSliderLogicResult = UseSliderCoreResult;

export function useSliderLogic(options: UseSliderLogicOptions): UseSliderLogicResult {
  return useSliderCore(options);
}
