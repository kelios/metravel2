import type { SliderImage } from './types';

export const NATIVE_SLIDER_MOBILE_RENDER_WINDOW = 3;
export const NATIVE_SLIDER_WIDE_RENDER_WINDOW = 5;

export const shouldEnableNativeLoop = ({
  isWeb,
  isTestEnv,
  imagesLength,
}: {
  isWeb: boolean;
  isTestEnv: boolean;
  imagesLength: number;
}) => !isWeb && !isTestEnv && imagesLength > 1;

export const buildNativeLoopData = (
  images: SliderImage[],
  loopEnabled: boolean,
): SliderImage[] => {
  if (!loopEnabled) return images;
  const first = images[0];
  const last = images[images.length - 1];
  return [last, ...images, first];
};

export const toNativeLoopRealIndex = (
  rawIndex: number,
  imagesLength: number,
  loopEnabled: boolean,
) => {
  if (!loopEnabled) return rawIndex;
  return ((rawIndex - 1) % imagesLength + imagesLength) % imagesLength;
};

export const toNativeLoopRawIndex = (realIndex: number, loopEnabled: boolean) =>
  loopEnabled ? realIndex + 1 : realIndex;

export const getNativeLoopPageOffset = ({
  realIndex,
  pageWidth,
  loopEnabled,
}: {
  realIndex: number;
  pageWidth: number;
  loopEnabled: boolean;
}) => toNativeLoopRawIndex(realIndex, loopEnabled) * pageWidth;
