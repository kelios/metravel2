// components/export/constructor/blocks/MapBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент блока-карты

import React, { useState } from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface MapBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
}

interface MapContent {
  imageUrl: string;
  points?: Array<{
    name: string;
    lat: number;
    lng: number;
  }>;
  description?: string;
}

export function MapBlock({ block, theme, scale }: MapBlockProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Парсим контент карты
  let mapData: MapContent = { imageUrl: '' };
  if (typeof block.content === 'object' && 'imageUrl' in block.content) {
    mapData = block.content as MapContent;
  }

  const { imageUrl, points = [], description } = mapData;

  if (!imageUrl) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 12 * scale, color: '#999' }}>Карта</Text>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#f0f0f0',
        borderRadius: 4 * scale,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {imageError ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <Text style={{ fontSize: 12 * scale, color: '#999', marginBottom: 8 * scale }}>
            Ошибка загрузки карты
          </Text>
          <Text style={{ fontSize: 10 * scale, color: '#999' }}>URL: {imageUrl}</Text>
        </div>
      ) : (
        <>
          <img
            src={imageUrl}
            alt="Карта маршрута"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: imageLoaded ? 'block' : 'none',
            }}
          />
          {!imageLoaded && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12 * scale, color: '#999' }}>Загрузка карты...</Text>
            </div>
          )}
          {points.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 8 * scale,
                left: 8 * scale,
                backgroundColor: 'rgba(255,255,255,0.9)',
                padding: 8 * scale,
                borderRadius: 4 * scale,
                fontSize: 10 * scale,
                maxWidth: '50%',
              }}
            >
              <Text style={{ fontSize: 10 * scale, fontWeight: 'bold', marginBottom: 4 * scale }}>
                Точки маршрута:
              </Text>
              {points.map((point, index) => (
                <div key={index} style={{ fontSize: 9 * scale, marginBottom: 2 * scale }}>
                  {index + 1}. {point.name}
                </div>
              ))}
            </div>
          )}
          {description && (
            <div
              style={{
                position: 'absolute',
                bottom: 8 * scale,
                left: 8 * scale,
                right: 8 * scale,
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#fff',
                padding: 8 * scale,
                borderRadius: 4 * scale,
                fontSize: 10 * scale,
              }}
            >
              <Text style={{ fontSize: 10 * scale, color: '#fff' }}>{description}</Text>
            </div>
          )}
        </>
      )}
    </div>
  );
}

