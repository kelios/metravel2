import React from 'react';
import { Text, View } from 'react-native';
import { Title } from '@/ui/paper';
import { useAboutStyles } from './aboutStyles';
import { translate as i18nT } from '@/i18n'


export const AboutHeader: React.FC = () => {
  const styles = useAboutStyles();
  return (
    <View style={styles.headerSection}>
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>{i18nT('home:components.about.AboutHeader.mt_2c7307bd')}</Text>
        </View>
      </View>
      <Title style={styles.title}>{i18nT('home:components.about.AboutHeader.metravel_by_1d38edca')}</Title>
      <Text style={styles.subtitle}>{i18nT('home:components.about.AboutHeader.soobschestvo_puteshestvennikov_c437afdb')}</Text>
    </View>
  );
};
