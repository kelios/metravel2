import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Image as ExpoImage } from 'expo-image';

type Point = {
  id: number;
  lat: string;
  lng: string;
  coord: string;
  address: string;
  travelImageThumbUrl: string;
  categoryName: string;
};

type PaginatedResponse = {
  current_page: number;
  data: Point[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
};

type TravelPropsType = {
  travelAddress: PaginatedResponse;
};

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface TravelProps {
  travel: TravelPropsType;
  coordinates: Coordinates | null;
}

const getLatLng = (coord: string) => {
  const [latitude, longitude] = coord.split(',').map(Number);
  return { latitude, longitude };
};

const Map: React.FC<TravelProps> = ({ travel, coordinates: propCoordinates }) => {
  const travelAddress = React.useMemo(
    () => travel?.travelAddress?.data || [],
    [travel?.travelAddress?.data]
  );

  const [localCoordinates, setLocalCoordinates] = useState<Coordinates | null>(propCoordinates);

  useEffect(() => {
    if (!localCoordinates) {
      setLocalCoordinates({ latitude: 53.8828449, longitude: 27.7273595 });
    }
  }, [localCoordinates]);

  const region = {
    latitude: localCoordinates?.latitude ?? 53.8828449,
    longitude: localCoordinates?.longitude ?? 27.7273595,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    if (mapRef.current && travelAddress.length) {
      const coordinates = travelAddress.map((point) => getLatLng(point?.coord));
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 10, right: 10, bottom: 10, left: 10 },
        animated: true,
      });
    }
  }, [travelAddress]);

  return (
      <MapView style={styles.map} ref={mapRef} initialRegion={region}>
        {travelAddress.map((point, index) => (
            <Marker key={index} coordinate={getLatLng(point?.coord)} title={String(point?.address)}>
              <Callout>
                <View>
                  {point?.travelImageThumbUrl ? (
                      <View style={styles.pointImageWrap}>
                        <ExpoImage
                          source={{ uri: point.travelImageThumbUrl }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          blurRadius={12}
                          transition={0}
                        />
                        <View style={styles.pointImageOverlay} />
                        <ExpoImage
                          source={{ uri: point.travelImageThumbUrl }}
                          style={StyleSheet.absoluteFill}
                          contentFit="contain"
                          transition={200}
                        />
                      </View>
                  ) : null}
                  <Text style={styles.label}>Адрес места:</Text>
                  <Text>{String(point.address)}</Text>
                  <Text style={styles.label}>Координаты:</Text>
                  <Text>{String(point.coord)}</Text>
                  <Text style={styles.label}>Категория объекта:</Text>
                  <Text>{String(point.categoryName)}</Text>
                </View>
              </Callout>
            </Marker>
        ))}
      </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  pointImageWrap: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    backgroundColor: '#0b1220',
  },
  pointImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  label: {
    fontWeight: 'bold',
    marginTop: 8,
  },
});

export default Map;
