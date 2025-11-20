// components/export/constructor/BlockHoverIndicator.tsx
// ✅ АРХИТЕКТУРА: Визуальный индикатор при наведении на блок

import React from 'react';

interface BlockHoverIndicatorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  visible: boolean;
}

export function BlockHoverIndicator({
  x,
  y,
  width,
  height,
  scale,
  visible,
}: BlockHoverIndicatorProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        border: '2px dashed #ff9f5a',
        backgroundColor: 'rgba(255, 159, 90, 0.1)',
        pointerEvents: 'none',
        zIndex: 10,
        transition: 'all 0.2s',
      }}
    />
  );
}

