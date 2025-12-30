import React from 'react';
import { Text, View } from 'react-native';
import { Title } from 'react-native-paper';
import { aboutStyles } from './aboutStyles';

export const AboutHeader: React.FC = () => (
  <View style={aboutStyles.headerSection}>
    <View style={aboutStyles.logoContainer}>
      <View style={aboutStyles.logoCircle}>
        <Text style={aboutStyles.logoText}>MT</Text>
      </View>
    </View>
    <Title style={aboutStyles.title}>MeTravel.by</Title>
    <Text style={aboutStyles.subtitle}>Сообщество путешественников</Text>
  </View>
);
