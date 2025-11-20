// components/listTravel/TravelCardHoverActions.tsx
// ✅ УЛУЧШЕНИЕ: Быстрые действия на карточке при hover (десктоп)

import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import FavoriteButton from '@/components/FavoriteButton';
import type { Travel } from '@/src/types/types';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface TravelCardHoverActionsProps {
  travel: Travel;
  onShare?: () => void;
  visible?: boolean;
}

const palette = DESIGN_TOKENS.colors;

export default function TravelCardHoverActions({
  travel,
  onShare,
  visible = false,
}: TravelCardHoverActionsProps) {
  const router = useRouter();

  if (Platform.OS !== 'web' || !visible) return null;

  const shareUrl = typeof window !== 'undefined' 
    ? window.location.origin + `/travels/${travel.slug || travel.id}`
    : `https://metravel.by/travels/${travel.slug || travel.id}`;

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }
    
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: travel.name,
          url: shareUrl,
        });
      } else if (typeof window !== 'undefined' && navigator.clipboard) {
        // Fallback: копирование в буфер обмена
        await navigator.clipboard.writeText(shareUrl);
        // Можно показать toast через Toast.show если нужно
      }
    } catch (error) {
      // Игнорируем ошибки (пользователь отменил и т.д.)
      console.log('Share cancelled or failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <FavoriteButton
          id={travel.id}
          type="travel"
          title={travel.name || ''}
          imageUrl={travel.travel_image_thumb_url}
          url={shareUrl}
          country={travel.countryName}
          size={20}
          style={styles.actionButton}
        />
        
        <Pressable
          style={styles.actionButton}
          onPress={handleShare}
          accessibilityLabel="Поделиться"
          {...Platform.select({
            web: {
              cursor: 'pointer',
              // @ts-ignore
              ':hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              },
            },
          })}
        >
          <Feather name="share-2" size={18} color="#fff" />
        </Pressable>

        {travel.slug && (
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push(`/travels/${travel.slug}`)}
            accessibilityLabel="Открыть"
            {...Platform.select({
              web: {
                cursor: 'pointer',
                // @ts-ignore
                ':hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              },
            })}
          >
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'all 0.2s ease',
        // @ts-ignore
        ':hover': {
          transform: 'scale(1.1)',
          backgroundColor: '#fff',
        },
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
});

