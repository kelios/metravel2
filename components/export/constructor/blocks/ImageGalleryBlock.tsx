// components/export/constructor/blocks/ImageGalleryBlock.tsx
// ✅ АРХИТЕКТУРА: Компонент блока-галереи изображений

import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import type { PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';

interface ImageGalleryBlockProps {
  block: PdfBlock;
  theme: PdfTheme;
  scale: number;
}

interface GalleryContent {
  images: Array<{
    url: string;
    alt?: string;
    caption?: string;
  }>;
  columns: 1 | 2 | 3 | 4;
  gap?: number;
}

export function ImageGalleryBlock({ block, theme, scale }: ImageGalleryBlockProps) {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Парсим контент галереи
  let galleryData: GalleryContent = { images: [], columns: 2 };
  if (typeof block.content === 'object' && 'images' in block.content) {
    galleryData = block.content as GalleryContent;
  }

  const { images, columns, gap = 8 } = galleryData;
  const gapPx = gap * scale;

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set([...prev, index]));
  };

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set([...prev, index]));
  };

  if (images.length === 0) {
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
        <Text style={{ fontSize: 12 * scale, color: '#999' }}>Галерея изображений</Text>
      </div>
    );
  }

  const imageWidth = `calc((100% - ${gapPx * (columns - 1)}px) / ${columns})`;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: gapPx,
        boxSizing: 'border-box',
        padding: 4 * scale,
      }}
    >
      {images.map((image, index) => (
        <div
          key={index}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            backgroundColor: '#f0f0f0',
            borderRadius: 4 * scale,
            overflow: 'hidden',
          }}
        >
          {imageErrors.has(index) ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 10 * scale, color: '#999' }}>Ошибка загрузки</Text>
            </div>
          ) : (
            <>
              <img
                src={image.url}
                alt={image.alt || ''}
                onLoad={() => handleImageLoad(index)}
                onError={() => handleImageError(index)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: loadedImages.has(index) ? 'block' : 'none',
                }}
              />
              {!loadedImages.has(index) && (
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
                  <Text style={{ fontSize: 10 * scale, color: '#999' }}>Загрузка...</Text>
                </div>
              )}
              {image.caption && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: 4 * scale,
                    fontSize: 10 * scale,
                  }}
                >
                  <Text style={{ fontSize: 10 * scale, color: '#fff' }}>{image.caption}</Text>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

