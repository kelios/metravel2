import React, { useMemo } from 'react';
import { CoordinateConverter } from '@/utils/coordinateConverter';

interface Point {
  id?: number;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
  articleUrl?: string;
  urlTravel?: string;
}

interface MapMarkersProps {
  points: Point[];
  icon: any;
  Marker: React.ComponentType<any>;
  Popup: React.ComponentType<any>;
  PopupContent: React.ComponentType<{ point: Point }>;
}

const MapMarkers: React.FC<MapMarkersProps> = ({
  points,
  icon,
  Marker,
  Popup,
  PopupContent,
}) => {
  const validPoints = useMemo(() => {
    return points
      .map((point, index) => {
        try {
          const coords = CoordinateConverter.fromString(point.coord);
          return {
            point,
            coords,
            key: point.id 
              ? `travel-${point.id}` 
              : `travel-${point.coord.replace(/,/g, '-')}-${index}`,
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [points]);

  return (
    <>
      {validPoints.map(({ point, coords, key }) => (
        <Marker
          key={key}
          position={CoordinateConverter.toLeaflet(coords)}
          icon={icon}
        >
          <Popup>
            <PopupContent point={point} />
          </Popup>
        </Marker>
      ))}
    </>
  );
};

// Memoize with custom comparison
export default React.memo(MapMarkers, (prev, next) => {
  if (prev.points.length !== next.points.length) return false;
  if (prev.icon !== next.icon) return false;
  if (prev.Marker !== next.Marker) return false;
  if (prev.Popup !== next.Popup) return false;
  if (prev.PopupContent !== next.PopupContent) return false;

  return prev.points.every((p, i) => {
    const nextPoint = next.points[i];
    if (!nextPoint) return false;
    return (
      p.id === nextPoint.id &&
      p.coord === nextPoint.coord &&
      p.address === nextPoint.address
    );
  });
});
