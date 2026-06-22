import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image as RNImage,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { optimizeImageUrl } from '@/utils/imageOptimization';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const getWebCreatePortal = (): ((node: React.ReactNode, container: Element) => any) | null => {
  if (Platform.OS !== 'web') return null;

  try {
    return (require('react-dom') as any)?.createPortal ?? null;
  } catch {
    return null;
  }
};

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
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
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
  const openedAtRef = useRef(0);

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

  // Map-point photos are often only available as small thumbnails (e.g. the
  // backend's 400px `-thumb_400_wp` conversion). Measure the real pixel size of
  // the served image so the sharp layer is never blown up past its native
  // resolution — instead it renders at the largest size where each source pixel
  // still maps to ≤1 CSS px. The blurred backdrop fills the rest of the screen.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!visible || !hiResUrl) {
      setNatural(null);
      return;
    }
    let cancelled = false;
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      const probe = new window.Image();
      probe.onload = () => {
        if (cancelled) return;
        if (probe.naturalWidth && probe.naturalHeight) {
          setNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
        } else {
          setNatural({ w: maxW, h: maxH });
        }
      };
      probe.onerror = () => {
        if (!cancelled) setNatural({ w: maxW, h: maxH });
      };
      probe.src = hiResUrl;
      return () => {
        cancelled = true;
        probe.onload = null;
        probe.onerror = null;
      };
    }
    RNImage.getSize(
      hiResUrl,
      (w, h) => {
        if (!cancelled) setNatural(w && h ? { w, h } : { w: maxW, h: maxH });
      },
      () => {
        if (!cancelled) setNatural({ w: maxW, h: maxH });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [visible, hiResUrl, maxW, maxH]);

  // Contain within the viewport, but never upscale beyond the native pixels.
  const display = useMemo(() => {
    if (!natural || !natural.w || !natural.h) return null;
    const scale = Math.min(maxW / natural.w, maxH / natural.h, 1);
    return { w: Math.max(1, Math.round(natural.w * scale)), h: Math.max(1, Math.round(natural.h * scale)) };
  }, [natural, maxW, maxH]);


  useEffect(() => {
    if (visible) {
      openedAtRef.current = Date.now();
    }
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!visible) return;
    if (typeof document === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, visible]);

  if (Platform.OS === 'web') {
    if (!visible) return null;

    const overlay = (
      <div
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          if (Date.now() - openedAtRef.current < 450) return;
          onClose();
        }}
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
        <ImageCardMedia
          src={hiResUrl}
          alt=""
          fit="cover"
          blurOnly
          blurBackground
          allowCriticalWebBlur
          blurRadius={30}
          priority="high"
          loading="eager"
          transition={0}
          width={width}
          height={height}
          style={{ position: 'absolute', inset: 0, borderRadius: 0, pointerEvents: 'none' }}
        />
        {display ? (
          <div
            style={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: '100%',
              width: display.w,
              height: display.h,
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
              width={display.w}
              height={display.h}
              style={{ borderRadius: 8 }}
            />
          </div>
        ) : null}
        <button
          onClick={onClose}
          aria-label="Закрыть фото"
          title="Закрыть фото"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: DESIGN_TOKENS.radii.full,
            backgroundColor: 'rgba(0,0,0,0.6)',
            border: '1.5px solid rgba(255,255,255,0.85)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <Feather name="x" size={24} color="#fff" />
        </button>
      </div>
    );

    const webCreatePortal = getWebCreatePortal();
    if (typeof document !== 'undefined' && webCreatePortal) {
      return webCreatePortal(overlay, document.body);
    }

    return overlay;
  }

  const nativeContent = (
    <View style={[fullscreenStyles.container, { width, height }]}>
      <ImageCardMedia
        src={hiResUrl}
        alt=""
        fit="cover"
        blurOnly
        blurBackground
        blurRadius={30}
        priority="high"
        loading="eager"
        transition={0}
        width={width}
        height={height}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={fullscreenStyles.centeredWrap}>
        {display ? (
          <View style={{ maxWidth: maxW, maxHeight: maxH, width: display.w, height: display.h }}>
            <ImageCardMedia
              src={hiResUrl}
              fit="contain"
              blurBackground
              blurRadius={20}
              priority="high"
              loading="eager"
              transition={0}
              width={display.w}
              height={display.h}
              alt={alt}
            />
          </View>
        ) : null}
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
