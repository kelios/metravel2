// components/achievements/ShareBadgeSheet.tsx
// Лист «Поделиться» медалью/наградой (Sprint 12, #384). Переиспользует паттерн
// ShareButtons: каналы открываются ТОЛЬКО через @/utils/externalLinks (guard
// :external-links зелёный), копирование — expo-clipboard, нативный шаринг — Web
// Share API / RN Share. Карточку (image_url) и публичную ссылку (public_url) берём
// из createShareCard (#382, мок-фолбэк до деплоя BE). UTM-атрибуция и события —
// #458 (buildShareLink + trackBadge*). Премиум-превью редких наград — #385.

import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { Badge } from '@/api/achievements';
import { createShareCard, type ShareCard } from '@/api/achievementsShare';
import ShareCardPreview from '@/components/achievements/ShareCardPreview';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { downloadUrlOnWeb } from '@/utils/downloadUrlOnWeb';
import {
  buildShareLink,
  buildShareUtm,
  type ShareChannel,
} from '@/utils/achievementShare';
import {
  trackBadgeShareOpened,
  trackBadgeShared,
  trackShareCardClick,
} from '@/utils/gamificationAnalytics';
import { showToast } from '@/utils/toast';
import { devWarn } from '@/utils/logger';

export interface ShareBadgeSubject {
  achievementId: number;
  slug: string;
  badge: Badge;
  ownerName?: string;
  reason?: string;
  dateLabel?: string;
  isRare?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  subject: ShareBadgeSubject | null;
  context?: 'profile' | 'detail' | 'card';
}

const shareText = (name: string): string =>
  `Моё достижение на MeTravel: «${name}». Собери свою коллекцию!`;

function ShareBadgeSheet({ visible, onClose, subject, context = 'detail' }: Props) {
  const colors = useThemedColors();
  const styles = getStyles(colors);

  const [card, setCard] = useState<ShareCard | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );

  const isRare = Boolean(subject?.isRare);
  const template = isRare ? 'rare' : 'default';

  const loadCard = useCallback(async () => {
    if (!subject) return;
    setStatus('loading');
    try {
      const result = await createShareCard({
        achievementId: subject.achievementId,
        template,
        utm: buildShareUtm('copy', subject.slug),
      });
      setCard(result);
      setStatus('ready');
    } catch (error) {
      devWarn('[ShareBadgeSheet] create share card failed', error);
      setStatus('error');
    }
  }, [subject, template]);

  useEffect(() => {
    if (!visible || !subject) return;
    trackBadgeShareOpened({
      achievementId: subject.achievementId,
      slug: subject.slug,
      isRare,
      context,
    });
    void loadCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, subject?.achievementId]);

  // Базовый URL для шаринга: public_url достижения (#383) или image_url как фолбэк.
  const linkFor = useCallback(
    (channel: ShareChannel): string => {
      const base = card?.publicUrl || card?.imageUrl || '';
      return buildShareLink(base, { channel, slug: subject?.slug ?? '' });
    },
    [card, subject?.slug],
  );

  const fireShared = useCallback(
    (channel: ShareChannel) => {
      if (!subject) return;
      trackBadgeShared({
        achievementId: subject.achievementId,
        slug: subject.slug,
        channel,
        template,
      });
    },
    [subject, template],
  );

  const handleCopy = useCallback(async () => {
    const link = linkFor('copy');
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      fireShared('copy');
      showToast({ type: 'success', text1: 'Ссылка скопирована', visibilityTime: 2000 });
    } catch (error) {
      devWarn('[ShareBadgeSheet] copy failed', error);
      showToast({ type: 'error', text1: 'Не удалось скопировать', visibilityTime: 2500 });
    }
  }, [linkFor, fireShared]);

  const handleTelegram = useCallback(async () => {
    if (!subject) return;
    const link = linkFor('telegram');
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText(subject.badge.name))}`;
    const ok = await openExternalUrlInNewTab(url);
    if (ok) {
      fireShared('telegram');
      trackShareCardClick({
        achievementId: subject.achievementId,
        slug: subject.slug,
        channel: 'telegram',
      });
    }
  }, [linkFor, subject, fireShared]);

  const handleFacebook = useCallback(async () => {
    if (!subject) return;
    const link = linkFor('facebook');
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
    const ok = await openExternalUrlInNewTab(url, {
      windowFeatures: 'width=600,height=500,noopener,noreferrer',
    });
    if (ok) {
      fireShared('facebook');
      trackShareCardClick({
        achievementId: subject.achievementId,
        slug: subject.slug,
        channel: 'facebook',
      });
    }
  }, [linkFor, subject, fireShared]);

  const handleNativeShare = useCallback(async () => {
    if (!subject) return;
    const link = linkFor('native');
    const message = `${shareText(subject.badge.name)} ${link}`;
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({ title: subject.badge.name, text: shareText(subject.badge.name), url: link });
          fireShared('native');
        }
        return;
      }
      await Share.share({ message, title: subject.badge.name });
      fireShared('native');
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        devWarn('[ShareBadgeSheet] native share failed', error);
      }
    }
  }, [linkFor, subject, fireShared]);

  const handleDownload = useCallback(() => {
    if (!card?.imageUrl || !subject) return;
    const ok = downloadUrlOnWeb(card.imageUrl, {
      filename: `metravel-${subject.slug || subject.achievementId}.png`,
    });
    if (ok) {
      fireShared('download');
      showToast({ type: 'success', text1: 'Картинка сохранена', visibilityTime: 2000 });
    }
  }, [card, subject, fireShared]);

  if (!subject) return null;

  const canUseWebShare =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function';

  type ChannelButton = {
    key: string;
    label: string;
    icon: keyof typeof Feather.glyphMap;
    onPress: () => void;
    color: string;
  };

  const channels: ChannelButton[] = [
    {
      key: 'copy',
      label: 'Копировать ссылку',
      icon: 'link',
      onPress: handleCopy,
      color: colors.textMuted,
    },
    {
      key: 'telegram',
      label: 'Telegram',
      icon: 'send',
      onPress: handleTelegram,
      color: colors.accent ?? colors.primary,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: 'facebook',
      onPress: handleFacebook,
      color: colors.info ?? colors.primary,
    },
  ];

  if (Platform.OS === 'web') {
    channels.push({
      key: 'download',
      label: 'Сохранить картинку',
      icon: 'download',
      onPress: handleDownload,
      color: colors.success ?? colors.primary,
    });
  }

  if (canUseWebShare || Platform.OS !== 'web') {
    channels.push({
      key: 'native',
      label: 'Ещё…',
      icon: 'share-2',
      onPress: handleNativeShare,
      color: colors.primaryText,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.heading}>Поделиться достижением</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ShareCardPreview
            testID="share-card-preview"
            subject={{
              badge: subject.badge,
              ownerName: subject.ownerName,
              reason: subject.reason ?? subject.badge.description,
              dateLabel: subject.dateLabel,
              isRare,
            }}
          />

          {status === 'loading' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.primaryDark} />
              <Text style={styles.statusText}>Готовим карточку…</Text>
            </View>
          ) : null}

          {status === 'error' ? (
            <View style={styles.statusRow}>
              <Feather name="alert-triangle" size={16} color={colors.warning ?? colors.textMuted} />
              <Text style={styles.statusText}>Не удалось создать карточку</Text>
              <Pressable onPress={loadCard} accessibilityRole="button" accessibilityLabel="Повторить">
                <Text style={[styles.statusText, { color: colors.primaryText, fontWeight: '700' }]}>
                  Повторить
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.channels} pointerEvents={status === 'ready' ? 'auto' : 'none'}>
            {channels.map((ch) => (
              <Pressable
                key={ch.key}
                onPress={ch.onPress}
                disabled={status !== 'ready'}
                style={({ pressed }) => [
                  styles.channel,
                  pressed && styles.channelPressed,
                  status !== 'ready' && styles.channelDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={ch.label}
                testID={`share-channel-${ch.key}`}
              >
                <Feather name={ch.icon} size={18} color={ch.color} />
                <Text style={styles.channelText}>{ch.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.xxl,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      gap: DESIGN_TOKENS.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heading: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'center',
    },
    statusText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
    channels: {
      gap: DESIGN_TOKENS.spacing.sm,
    },
    channel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      minHeight: Platform.OS === 'android' ? 48 : 44,
    },
    channelPressed: {
      backgroundColor: colors.backgroundTertiary,
    },
    channelDisabled: {
      opacity: 0.5,
    },
    channelText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.text,
    },
  });

export default memo(ShareBadgeSheet);
