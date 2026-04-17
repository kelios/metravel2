import React, { useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { optimizeImageUrl } from '@/utils/imageOptimization';

export const fullscreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  centeredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.select({ ios: 54, default: 16 }),
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

const FullscreenImageViewer: React.FC<{
  imageUrl: string;
  alt: string;
  visible: boolean;
  onClose: () => void;
  colors: ThemedColors;
}> = ({ imageUrl, alt, visible, onClose, colors }) => {
  const { width, height } = useWindowDimensions();

  const portalCreate = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    try {
      return (require('react-dom') as any)?.createPortal ?? null;
    } catch {
      return null;
    }
  }, []);

  const maxW = Math.round(width * 0.92);
  const maxH = Math.round(height * 0.92);

  const hiResUrl = useMemo(() => {
    if (!imageUrl) return imageUrl;
    return optimizeImageUrl(imageUrl, {
      width: maxW,
      height: maxH,
      quality: 90,
      format: 'auto',
      fit: 'contain',
      dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
    }) ?? imageUrl;
  }, [imageUrl, maxW, maxH]);


  if (Platform.OS === 'web') {
    if (!visible) return null;

    const overlay = (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          backgroundColor: 'rgba(0,0,0,0.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'relative',
            maxWidth: maxW,
            maxHeight: maxH,
            width: maxW,
            height: maxH,
          }}
        >
          <ImageCardMedia
            src={hiResUrl}
            alt={alt}
            fit="contain"
            blurBackground
            allowCriticalWebBlur
            blurRadius={20}
            priority="high"
            loading="eager"
            transition={0}
            width={maxW}
            height={maxH}
            style={{ borderRadius: 8 }}
          />
        </div>
        <button
          onClick={onClose}
          aria-label="Закрыть фото"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(0,0,0,0.5)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.textOnDark,
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    );

    if (typeof document !== 'undefined' && portalCreate) {
      return portalCreate(overlay, document.body);
    }

    return overlay;
  }

  const nativeContent = (
    <View style={[fullscreenStyles.container, { width, height }]}>
      <View style={fullscreenStyles.centeredWrap}>
        <View style={{ maxWidth: maxW, maxHeight: maxH, width: maxW, height: maxH }}>
          <ImageCardMedia
            src={hiResUrl}
            fit="contain"
            blurBackground
            allowCriticalWebBlur
            blurRadius={20}
            priority="high"
            loading="eager"
            transition={0}
            width={maxW}
            height={maxH}
            alt={alt}
          />
        </View>
      </View>
      <Pressable
        onPress={onClose}
        style={fullscreenStyles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Закрыть фото"
      >
        <Feather name="x" size={24} color={colors.textOnDark} />
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {nativeContent}
    </Modal>
  );
};

export default FullscreenImageViewer;
