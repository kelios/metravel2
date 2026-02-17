/**
 * Slider.tsx - Native slider component for iOS/Android
 * This is a thin wrapper around UnifiedSlider to maintain backward compatibility.
 */

import React, { forwardRef, memo } from 'react';
import UnifiedSlider from './UnifiedSlider';
import type { SliderProps, SliderRef } from './sliderParts/types';

// Re-export types for consumers that import from '@/components/travel/Slider'
export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

const SliderComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  return <UnifiedSlider {...props} ref={ref} />;
};

const Slider = forwardRef(SliderComponent);

export default memo(Slider);

