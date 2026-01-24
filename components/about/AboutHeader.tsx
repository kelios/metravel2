import React from 'react';
import { Text, View } from 'react-native';
import { Title } from '@/src/ui/paper';
import { useAboutStyles } from './aboutStyles';

export const AboutHeader: React.FC = () => {
  const styles = useAboutStyles();
  return (
    <View style={styles.headerSection}>
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>MT</Text>
        </View>
      </View>
      <Title style={styles.title}>MeTravel.by</Title>
      <Text style={styles.subtitle}>Сообщество путешественников</Text>
    </View>
  );
};
