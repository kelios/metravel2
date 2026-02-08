import React, { memo } from 'react';
import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { createTravelListItemStyles } from './travelListItemStyles';

const ICON_STYLE = { marginRight: 4 } as const;

type Props = {
  countries: string[];
  styles: ReturnType<typeof createTravelListItemStyles>;
  iconColor: string;
};

const TravelListItemCountriesList = memo(function TravelListItemCountriesList({
  countries,
  styles,
  iconColor,
}: Props) {
  if (!countries.length) return null;

  return (
    <View style={styles.tags}>
      {countries.slice(0, 1).map((country) => (
        <View key={country} style={styles.tag}>
          <Feather name="map-pin" size={11} color={iconColor} style={ICON_STYLE} />
          <Text style={styles.tagTxt} numberOfLines={1} ellipsizeMode="tail">
            {country}
          </Text>
        </View>
      ))}
    </View>
  );
});

export default TravelListItemCountriesList;
