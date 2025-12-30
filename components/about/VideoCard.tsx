import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { aboutStyles } from './aboutStyles';

type Props = {
  youtubeThumb: string;
  onOpenYoutube: () => void;
};

export const VideoCard: React.FC<Props> = ({ youtubeThumb, onOpenYoutube }) => (
  <View style={aboutStyles.videoCard}>
    <View style={aboutStyles.videoCardHeader}>
      <Text style={aboutStyles.videoCardTitle}>Видео-инструкция</Text>
      <Text style={aboutStyles.videoCardSubtitle}>Как пользоваться платформой</Text>
    </View>
    <Pressable
      onPress={onOpenYoutube}
      style={({ pressed }) => [aboutStyles.videoThumbWrap, pressed && aboutStyles.videoCardPressed]}
      accessibilityRole="button"
      accessibilityLabel="Смотреть инструкцию на YouTube"
    >
      {Platform.OS === 'web' ? (
        // @ts-ignore
        <img
          src={youtubeThumb}
          alt="YouTube видео о MeTravel"
          style={aboutStyles.videoThumbWeb}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <ImageCardMedia
          src={youtubeThumb}
          fit="cover"
          blurBackground={false}
          transition={200}
          cachePolicy="memory-disk"
          priority="low"
          placeholderBlurhash="L6PZfSi_.AyE_3t7t7R**0o#DgRj"
          style={aboutStyles.videoThumb}
        />
      )}
      <View style={aboutStyles.playBadge}>
        <View style={aboutStyles.playIconContainer}>
          <Text style={aboutStyles.playIcon}>▶</Text>
        </View>
      </View>
    </Pressable>
    <View style={aboutStyles.videoCardFooter}>
      <Text style={aboutStyles.videoCardFooterText}>METRAVEL O METRAVEL.BY</Text>
    </View>
  </View>
);
