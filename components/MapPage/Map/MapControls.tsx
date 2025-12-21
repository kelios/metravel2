import React from 'react';
import { Platform } from 'react-native';
import type { LatLng } from '@/types/coordinates';

interface MapControlsProps {
  userLocation: LatLng | null;
  onCenterUserLocation: () => void;
}

const MapControls: React.FC<MapControlsProps> = ({
  userLocation,
  onCenterUserLocation,
}) => {
  if (!userLocation || Platform.OS !== 'web') return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
      }}
    >
      <button
        onClick={onCenterUserLocation}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          border: '2px solid rgba(0,0,0,0.2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'all 0.2s ease',
          color: '#2b6cb0',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f7ff';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#fff';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Мое местоположение"
        aria-label="Вернуться к моему местоположению"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
};

export default React.memo(MapControls);
