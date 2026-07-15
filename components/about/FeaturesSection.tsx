import React from 'react';
import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAboutStyles } from './aboutStyles';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


type Props = {
  isWide: boolean;
};

const getCurrentFeatures = () => [
  i18nT('homeStatic:about.features.current.publish'),
  i18nT('homeStatic:about.features.current.map'),
  i18nT('homeStatic:about.features.current.search'),
  i18nT('homeStatic:about.features.current.recommendations'),
  i18nT('homeStatic:about.features.current.monthly'),
  i18nT('homeStatic:about.features.current.wishlist'),
  i18nT('homeStatic:about.features.current.social'),
  i18nT('homeStatic:about.features.current.pdf'),
  i18nT('homeStatic:about.features.current.responsive'),
  i18nT('homeStatic:about.features.current.youtube'),
];

const getRoadmapFeatures = () => [
  i18nT('homeStatic:about.features.roadmap.mobile'),
  i18nT('homeStatic:about.features.roadmap.reviews'),
  i18nT('homeStatic:about.features.roadmap.communities'),
  i18nT('homeStatic:about.features.roadmap.planner'),
  i18nT('homeStatic:about.features.roadmap.booking'),
  i18nT('homeStatic:about.features.roadmap.offline'),
  i18nT('homeStatic:about.features.roadmap.analytics'),
  i18nT('homeStatic:about.features.roadmap.collaboration'),
];

export const FeaturesSection: React.FC<Props> = ({ isWide }) => {
  const styles = useAboutStyles();
  const colors = useThemedColors();
  const currentFeatures = getCurrentFeatures();
  const roadmapFeatures = getRoadmapFeatures();
  return (
    <View style={styles.featuresSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.featuresTitle}>{i18nT('home:components.about.FeaturesSection.funktsii_i_vozmozhnosti_184b1e1a')}</Text>
        <Text style={styles.sectionSubtitle}>{i18nT('home:components.about.FeaturesSection.vse_chto_dostupno_na_platforme_metravel_by_3a0b7ee4')}</Text>
      </View>

      <View style={isWide ? styles.twoColumns : styles.oneColumn}>
        <View style={[isWide ? styles.column : null, styles.featureCard]}>
          <View style={styles.featureCardHeader}>
            <Feather name="star" size={18} color={colors.primaryDark} style={styles.featureCardIcon} />
            <Text style={styles.featureCardTitle}>{i18nT('home:components.about.FeaturesSection.dostupno_seychas_cd1763aa')}</Text>
          </View>
          <View style={styles.featureList}>
            {currentFeatures.map((item) => (
              <View key={item} style={styles.featureItem}>
                <View style={styles.featureMark}>
                  <Feather name="check" size={14} color={colors.success} />
                </View>
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[isWide ? styles.column : null, styles.featureCard]}>
          <View style={styles.featureCardHeader}>
            <Feather name="zap" size={18} color={colors.info} style={styles.featureCardIcon} />
            <Text style={styles.featureCardTitle}>{i18nT('home:components.about.FeaturesSection.v_razrabotke_389fdec3')}</Text>
          </View>
          <View style={styles.featureList}>
            {roadmapFeatures.map((item) => (
              <View key={item} style={styles.featureItem}>
                <View style={styles.featureMark}>
                  <Feather name="arrow-right" size={14} color={colors.primaryDark} />
                </View>
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};
