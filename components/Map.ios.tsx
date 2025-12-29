import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Image } from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';

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
  const travelAddress = useMemo(() => travel?.travelAddress?.data || [], [travel?.travelAddress]);

  const centerLat = propCoordinates?.latitude ?? 53.8828449;
  const centerLng = propCoordinates?.longitude ?? 27.7273595;

  const initialRegion: Region = {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {travelAddress.map((point, index) => {
          if (!point?.coord) return null;
          const { latitude, longitude } = getLatLng(point.coord);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

          return (
            <Marker
              key={point.id ?? `${point.coord}-${index}`}
              coordinate={{ latitude, longitude }}
              accessibilityLabel={point.address}
            >
              <Callout>
                <View style={styles.callout}>
                  {point.travelImageThumbUrl ? (
                    <Image
                      source={{ uri: point.travelImageThumbUrl }}
                      style={styles.calloutImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <Text style={styles.label}>Адрес места:</Text>
                  <Text style={styles.value}>{point.address || 'Нет адреса'}</Text>
                  <Text style={styles.label}>Координаты:</Text>
                  <Text style={styles.value}>{point.coord}</Text>
                  <Text style={styles.label}>Категория объекта:</Text>
                  <Text style={styles.value}>{point.categoryName || 'Не указана'}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  callout: {
    maxWidth: 220,
    padding: 8,
  },
  calloutImage: {
    width: 200,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  label: {
    fontWeight: '700',
    marginBottom: 2,
  },
  value: {
    marginBottom: 6,
  },
});

export default Map;
