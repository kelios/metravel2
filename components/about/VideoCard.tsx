import React from 'react';
import { Pressable, Text, View } from 'react-native';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useAboutStyles } from './aboutStyles';

type Props = {
  youtubeThumb: string;
  onOpenYoutube: () => void;
};

export const VideoCard: React.FC<Props> = ({ youtubeThumb, onOpenYoutube }) => {
  const styles = useAboutStyles();
  return (
    <View style={styles.videoCard}>
      <View style={styles.videoCardHeader}>
        <Text style={styles.videoCardTitle}>Видео-инструкция</Text>
        <Text style={styles.videoCardSubtitle}>Как пользоваться платформой</Text>
      </View>
      <Pressable
        onPress={onOpenYoutube}
        style={({ pressed }) => [styles.videoThumbWrap, pressed && styles.videoCardPressed]}
        accessibilityRole="button"
        accessibilityLabel="Смотреть инструкцию на YouTube"
      >
        <ImageCardMedia
          src={youtubeThumb}
          alt="YouTube видео о MeTravel"
          fit="contain"
          blurBackground
          borderRadius={0}
          transition={200}
          cachePolicy="memory-disk"
          priority="low"
          placeholderBlurhash="L6PZfSi_.AyE_3t7t7R**0o#DgRj"
          style={styles.videoThumb}
        />
        <View style={styles.playBadge}>
          <View style={styles.playIconContainer}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.videoCardFooter}>
        <Text style={styles.videoCardFooterText}>METRAVEL O METRAVEL.BY</Text>
      </View>
    </View>
  );
};
