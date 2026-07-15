import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useAboutStyles } from './aboutStyles';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


type Props = {
  youtubeThumb: string;
  onOpenYoutube: () => void;
};

export const VideoCard: React.FC<Props> = ({ youtubeThumb, onOpenYoutube }) => {
  const styles = useAboutStyles();
  const colors = useThemedColors();
  return (
    <View style={styles.videoCard}>
      <View style={styles.videoCardHeader}>
        <Text style={styles.videoCardTitle}>{i18nT('home:components.about.VideoCard.video_instruktsiya_c8181ac5')}</Text>
        <Text style={styles.videoCardSubtitle}>{i18nT('home:components.about.VideoCard.kak_polzovatsya_platformoy_823174e1')}</Text>
      </View>
      <Pressable
        onPress={onOpenYoutube}
        style={({ pressed }) => [styles.videoThumbWrap, pressed && styles.videoCardPressed]}
        accessibilityRole="button"
        accessibilityLabel={i18nT('home:components.about.VideoCard.smotret_instruktsiyu_na_youtube_c3930b0b')}
      >
        <ImageCardMedia
          src={youtubeThumb}
          alt={i18nT('home:components.about.VideoCard.youtube_video_o_metravel_42216f54')}
          fit="contain"
          blurBackground
          allowCriticalWebBlur
          borderRadius={0}
          transition={200}
          cachePolicy="memory-disk"
          priority="low"
          placeholderBlurhash="L6PZfSi_.AyE_3t7t7R**0o#DgRj"
          style={styles.videoThumb}
        />
        <View style={styles.playBadge}>
          <Feather name="play" size={28} color={colors.textOnPrimary} />
        </View>
      </Pressable>
      <View style={styles.videoCardFooter}>
        <Text style={styles.videoCardFooterText}>{i18nT('home:components.about.VideoCard.metravel_o_metravel_by_e85cb4ae')}</Text>
      </View>
    </View>
  );
};
