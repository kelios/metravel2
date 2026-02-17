/**
 * Slider.web.tsx - Web slider component
 * This is a thin wrapper around UnifiedSlider to maintain backward compatibility.
 * Using the same unified implementation for web with platform-specific optimizations built-in.
 */

import React, { forwardRef, memo } from 'react';
import UnifiedSlider from './UnifiedSlider';
import type { SliderProps, SliderRef } from './sliderParts/types';

// Re-export types for consumers that import from '@/components/travel/Slider.web'
export type { SliderImage, SliderProps, SliderRef } from './sliderParts/types';

const SliderWebComponent = (props: SliderProps, ref: React.Ref<SliderRef>) => {
  return <UnifiedSlider {...props} ref={ref} />;
};

const SliderWeb = forwardRef(SliderWebComponent);

export default memo(SliderWeb);
