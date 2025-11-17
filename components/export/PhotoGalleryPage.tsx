// components/export/PhotoGalleryPage.tsx
// ✅ УЛУЧШЕНИЕ: Страница галереи фотографий путешествия

import React from 'react';

interface PhotoGalleryPageProps {
  travelName: string;
  photos: Array<{ url: string; id?: number | string }>;
  pageNumber: number;
}

export default function PhotoGalleryPage({
  travelName,
  photos,
  pageNumber,
}: PhotoGalleryPageProps) {
  // Разбиваем фото на группы для красивой сетки
  const getGridLayout = (count: number) => {
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: Math.ceil(count / 4) };
  };

  const { cols, rows } = getGridLayout(photos.length);
  const gridTemplateColumns = `repeat(${cols}, 1fr)`;

  return (
    <section
      className="pdf-page gallery-page"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm 25mm',
        margin: 0,
        backgroundColor: '#fff',
        pageBreakAfter: 'always',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Заголовок */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '15mm',
          paddingBottom: '10mm',
          borderBottom: '3px solid #ff9f5a',
        }}
      >
        <h2
          style={{
            fontSize: '24pt',
            fontWeight: 800,
            margin: 0,
            color: '#1f2937',
            letterSpacing: '-0.02em',
          }}
        >
          Фотогалерея
        </h2>
        <div
          style={{
            fontSize: '14pt',
            color: '#6b7280',
            marginTop: '3mm',
            fontWeight: 500,
          }}
        >
          {travelName}
        </div>
      </div>

      {/* Сетка фотографий */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          gap: '6mm',
          marginBottom: '10mm',
        }}
      >
        {photos.map((photo, index) => (
          <div
            key={photo.id || index}
            style={{
              position: 'relative',
              aspectRatio: '1',
              borderRadius: '6mm',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              breakInside: 'avoid',
            }}
          >
            <img
              src={photo.url}
              alt={`Фото ${index + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              crossOrigin="anonymous"
            />
            {/* Номер фото (опционально) */}
            <div
              style={{
                position: 'absolute',
                bottom: '2mm',
                right: '2mm',
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: '#fff',
                borderRadius: '50%',
                width: '6mm',
                height: '6mm',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8pt',
                fontWeight: 700,
              }}
            >
              {index + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Подпись */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '10pt',
          color: '#9ca3af',
          fontStyle: 'italic',
          marginTop: 'auto',
        }}
      >
        {photos.length} {photos.length === 1 ? 'фотография' : photos.length < 5 ? 'фотографии' : 'фотографий'}
      </div>

      {/* Номер страницы */}
      <div
        style={{
          position: 'absolute',
          bottom: '15mm',
          right: '25mm',
          fontSize: '12pt',
          color: '#9ca3af',
          fontWeight: 500,
        }}
      >
        {pageNumber}
      </div>
    </section>
  );
}

