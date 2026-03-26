export type ContainedMediaBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type BackdropSegment = ContainedMediaBox;

const roundToThree = (value: number): number => Math.round(value * 1000) / 1000;

export const getContainedMediaBox = ({
  containerWidth,
  containerHeight,
  contentAspectRatio,
}: {
  containerWidth: number;
  containerHeight: number;
  contentAspectRatio?: number | null;
}): ContainedMediaBox | null => {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    !Number.isFinite(contentAspectRatio) ||
    (contentAspectRatio ?? 0) <= 0
  ) {
    return null;
  }

  const containerRatio = containerWidth / containerHeight;
  const assetRatio = Number(contentAspectRatio);

  let width = containerWidth;
  let height = containerHeight;
  let left = 0;
  let top = 0;

  if (assetRatio > containerRatio) {
    height = containerWidth / assetRatio;
    top = (containerHeight - height) / 2;
  } else if (assetRatio < containerRatio) {
    width = containerHeight * assetRatio;
    left = (containerWidth - width) / 2;
  }

  return {
    left: roundToThree(left),
    top: roundToThree(top),
    width: roundToThree(width),
    height: roundToThree(height),
  };
};

export const getBackdropSegments = ({
  containerWidth,
  containerHeight,
  contentBox,
}: {
  containerWidth: number;
  containerHeight: number;
  contentBox: ContainedMediaBox | null;
}): BackdropSegment[] => {
  if (
    !contentBox ||
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return [];
  }

  const epsilon = 0.5;
  const right = Math.max(0, containerWidth - (contentBox.left + contentBox.width));
  const bottom = Math.max(0, containerHeight - (contentBox.top + contentBox.height));

  const segments: BackdropSegment[] = [];

  if (contentBox.top > epsilon) {
    segments.push({
      left: 0,
      top: 0,
      width: containerWidth,
      height: contentBox.top,
    });
  }

  if (bottom > epsilon) {
    segments.push({
      left: 0,
      top: contentBox.top + contentBox.height,
      width: containerWidth,
      height: bottom,
    });
  }

  if (contentBox.left > epsilon) {
    segments.push({
      left: 0,
      top: contentBox.top,
      width: contentBox.left,
      height: contentBox.height,
    });
  }

  if (right > epsilon) {
    segments.push({
      left: contentBox.left + contentBox.width,
      top: contentBox.top,
      width: right,
      height: contentBox.height,
    });
  }

  return segments.map((segment) => ({
    left: roundToThree(segment.left),
    top: roundToThree(segment.top),
    width: roundToThree(segment.width),
    height: roundToThree(segment.height),
  }));
};
