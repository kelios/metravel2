// components/quests/ShareQuestResultSheet.tsx
// Лист «Поделиться результатом» финала квеста ([INV2-02], тикет борда #1472).
// Замыкает вирусную петлю: даёт унести из финала ссылку с UTM, картинку-диплом
// и нативный шаринг. Переиспользует механизм шаринга достижений (#12,
// ShareBadgeSheet), а не пишет параллельный: каналы открываются ТОЛЬКО через
// @/utils/externalLinks (guard:external-links зелёный), копирование — expo-clipboard,
// нативный шаринг — Web Share API / RN Share, картинку рисует сервер
// (api/questsShare.createQuestResultCard). Карточка — улучшение: если генератор
// недоступен, лист остаётся работоспособным на шаринге публичной ссылки квеста.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useAuthStore } from '@/stores/authStore';
import { createQuestResultCard, type QuestResultCard } from '@/api/questsShare';
import {
  buildQuestPublicUrl,
  buildQuestResultShareLink,
  buildQuestResultShareUtm,
} from '@/utils/questResultShare';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { downloadUrlOnWeb } from '@/utils/downloadUrlOnWeb';
import { getSafeExternalUrl } from '@/utils/safeExternalUrl';
import { trackQuestShareClick } from '@/utils/gamificationAnalytics';
import { showToast } from '@/utils/toast';
import { devWarn } from '@/utils/logger';
import { useTranslation } from '@/i18n/LocaleProvider';
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe';

export interface QuestResultShareSubject {
  /** Числовой id квеста — для генератора карточки. */
  questId: number;
  /** Slug квеста — UTM-кампания и quest_id в аналитике. */
  questSlug: string;
  questTitle: string;
  cityId?: string;
  pointsDone: number;
  pointsTotal: number;
  finishedAt?: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  subject: QuestResultShareSubject | null;
}

type CardStatus = 'idle' | 'loading' | 'ready' | 'unavailable';
type ShareChannelKey = 'copy' | 'telegram' | 'native' | 'download' | 'instagram';

async function shareRemoteImageOnNative(
  rawUrl: string,
  fileName: string,
  dialogTitle: string,
): Promise<boolean> {
  const imageUrl = getSafeExternalUrl(rawUrl, { allowRelative: false });
  if (!imageUrl) return false;

  const [FileSystem, Sharing] = await Promise.all([
    import('expo-file-system/legacy'),
    import('expo-sharing'),
  ]);
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory || !(await Sharing.isAvailableAsync())) return false;

  const fileUri = `${cacheDirectory}${fileName}`;
  await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
  const downloaded = await FileSystem.downloadAsync(imageUrl, fileUri);
  await Sharing.shareAsync(downloaded.uri, {
    mimeType: 'image/png',
    dialogTitle,
  });
  return true;
}

function ShareQuestResultSheet({ visible, onClose, subject }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  // Через project-обёртку: на production web `react-native-safe-area-context`
  // может не разрезолвиться, и сырой хук уронил бы лист целиком.
  const insets = useSafeAreaInsetsSafe();

  const username = useAuthStore((s) => s.username);

  const [heroName, setHeroName] = useState('');
  const [card, setCard] = useState<QuestResultCard | null>(null);
  const [status, setStatus] = useState<CardStatus>('idle');
  const requestIdRef = useRef(0);
  const requestedHeroNameRef = useRef('');

  const loadCard = useCallback(
    async (name: string) => {
      if (!subject) return;
      const normalizedName = name.trim();
      requestedHeroNameRef.current = normalizedName;
      const requestId = ++requestIdRef.current;

      if (subject.questId <= 0) {
        setCard(null);
        setStatus('unavailable');
        return;
      }

      setStatus('loading');
      try {
        const result = await createQuestResultCard({
          questId: subject.questId,
          questSlug: subject.questSlug,
          heroName: normalizedName || undefined,
          pointsDone: subject.pointsDone,
          pointsTotal: subject.pointsTotal,
          finishedAt: subject.finishedAt ?? null,
          utm: buildQuestResultShareUtm(subject.questSlug),
        });
        if (requestId !== requestIdRef.current) return;
        setCard(result);
        setStatus('ready');
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        // Карточка — улучшение: отказ генератора не ломает шаринг ссылки.
        devWarn('[ShareQuestResultSheet] result-card unavailable', error);
        setCard(null);
        setStatus('unavailable');
      }
    },
    [subject],
  );

  // Открытие: подставляем ник из профиля и пробуем сгенерировать карточку.
  useEffect(() => {
    if (!visible || !subject) return;
    setHeroName(username ?? '');
    void loadCard(username ?? '');

    // Закрытие листа или смена результата инвалидирует незавершённый запрос:
    // его поздний ответ не должен подменить карточку следующего открытия.
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadCard, subject, username, visible]);

  const hasImage = status === 'ready' && Boolean(card?.imageUrl);

  // Ссылка для шаринга: публичная страница результата или сам квест как фолбэк.
  // UTM-метка одинакова для всех каналов (постановка #1472).
  const shareLink = useCallback((): string => {
    const base = card?.publicUrl || buildQuestPublicUrl(subject?.cityId, subject?.questSlug);
    return buildQuestResultShareLink(base, { slug: subject?.questSlug ?? '' });
  }, [card, subject?.cityId, subject?.questSlug]);

  const fireClick = useCallback(
    (channel: ShareChannelKey) => {
      if (!subject) return;
      trackQuestShareClick({ questId: subject.questSlug, channel });
    },
    [subject],
  );

  // Текст сообщения называет результат и домен: получатель видит, что именно
  // пройдено, ещё до перехода по ссылке (#1667).
  const shareCaption = useCallback(
    (): string =>
      t('questShareStatic:finaleShare.shareText', {
        title: subject?.questTitle ?? '',
        done: subject?.pointsDone ?? 0,
        total: subject?.pointsTotal ?? 0,
      }),
    [subject?.pointsDone, subject?.pointsTotal, subject?.questTitle, t],
  );

  const handleCopy = useCallback(async () => {
    const link = shareLink();
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      fireClick('copy');
      showToast({
        type: 'success',
        text1: t('questShareStatic:finaleShare.linkCopied'),
        visibilityTime: 2000,
      });
    } catch (error) {
      devWarn('[ShareQuestResultSheet] copy failed', error);
      showToast({
        type: 'error',
        text1: t('questShareStatic:finaleShare.copyFailed'),
        visibilityTime: 2500,
      });
    }
  }, [shareLink, fireClick, t]);

  const handleTelegram = useCallback(async () => {
    const link = shareLink();
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareCaption())}`;
    const ok = await openExternalUrlInNewTab(url);
    if (ok) fireClick('telegram');
  }, [shareLink, shareCaption, fireClick]);

  const handleNativeShare = useCallback(async () => {
    const link = shareLink();
    const caption = shareCaption();
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({ title: subject?.questTitle, text: caption, url: link });
          fireClick('native');
        }
        return;
      }
      await Share.share({ message: `${caption} ${link}`, title: subject?.questTitle });
      fireClick('native');
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        devWarn('[ShareQuestResultSheet] native share failed', error);
      }
    }
  }, [shareLink, shareCaption, subject?.questTitle, fireClick]);

  const handleDownload = useCallback(() => {
    if (!card?.imageUrl || !subject) return;
    const ok = downloadUrlOnWeb(card.imageUrl, {
      filename: `metravel-quest-${subject.questSlug || subject.questId}.png`,
    });
    if (ok) {
      fireClick('download');
      showToast({
        type: 'success',
        text1: t('questShareStatic:finaleShare.imageSaved'),
        visibilityTime: 2000,
      });
    }
  }, [card, subject, fireClick, t]);

  const handleInstagram = useCallback(async () => {
    const image = card?.storyImageUrl || card?.imageUrl;
    if (!image || !subject) return;
    if (Platform.OS === 'web') {
      const ok = downloadUrlOnWeb(image, {
        filename: `metravel-quest-story-${subject.questSlug || subject.questId}.png`,
      });
      if (ok) {
        fireClick('instagram');
        showToast({
          type: 'success',
          text1: t('questShareStatic:finaleShare.instagramHint'),
          visibilityTime: 3000,
        });
      }
      return;
    }
    try {
      const shared = await shareRemoteImageOnNative(
        image,
        'metravel-quest-story.png',
        t('questShareStatic:finaleShare.channel.instagram'),
      );
      if (shared) fireClick('instagram');
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        devWarn('[ShareQuestResultSheet] instagram share failed', error);
      }
    }
  }, [card, subject, fireClick, t]);

  if (!subject) return null;

  const canUseWebShare =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function';

  type ChannelButton = {
    key: ShareChannelKey;
    /** Полное действие: доступное имя кнопки для screen reader. */
    label: string;
    /** Короткая подпись под иконкой — влезает в колонку 44dp на 375pt. */
    shortLabel: string;
    icon: keyof typeof Feather.glyphMap;
    onPress: () => void;
    color: string;
  };

  const channels: ChannelButton[] = [
    {
      key: 'copy',
      label: t('questShareStatic:finaleShare.channel.copy'),
      shortLabel: t('questShareStatic:finaleShare.channelShort.copy'),
      icon: 'link',
      onPress: handleCopy,
      color: colors.textMuted,
    },
    {
      key: 'telegram',
      label: t('questShareStatic:finaleShare.channel.telegram'),
      shortLabel: t('questShareStatic:finaleShare.channelShort.telegram'),
      icon: 'send',
      onPress: handleTelegram,
      color: colors.accent ?? colors.primary,
    },
  ];

  if (hasImage && Platform.OS === 'web') {
    channels.push({
      key: 'download',
      label: t('questShareStatic:finaleShare.channel.download'),
      shortLabel: t('questShareStatic:finaleShare.channelShort.download'),
      icon: 'download',
      onPress: handleDownload,
      color: colors.success ?? colors.primary,
    });
  }

  if (hasImage) {
    channels.push({
      key: 'instagram',
      label: t('questShareStatic:finaleShare.channel.instagram'),
      shortLabel: t('questShareStatic:finaleShare.channelShort.instagram'),
      icon: 'instagram',
      onPress: handleInstagram,
      color: colors.primaryText,
    });
  }

  if (canUseWebShare || Platform.OS !== 'web') {
    channels.push({
      key: 'native',
      label: t('questShareStatic:finaleShare.channel.native'),
      shortLabel: t('questShareStatic:finaleShare.channelShort.native'),
      icon: 'share-2',
      onPress: handleNativeShare,
      color: colors.primaryText,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel={t('questShareStatic:finaleShare.close')}
      >
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, DESIGN_TOKENS.spacing.lg) },
          ]}
          onPress={() => {}}
          testID="quest-share-sheet"
        >
          <View style={styles.header}>
            <Text style={styles.heading}>{t('questShareStatic:finaleShare.sheetTitle')}</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('questShareStatic:finaleShare.close')}
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          {hasImage ? (
            <View style={styles.preview} testID="quest-result-card-preview">
              <ImageCardMedia
                src={card!.imageUrl}
                fit="contain"
                blurBackground
                blurRadius={18}
                style={StyleSheet.absoluteFillObject}
                alt={subject.questTitle}
              />
            </View>
          ) : null}

          {status !== 'unavailable' ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                {t('questShareStatic:finaleShare.heroNameLabel')}
              </Text>
              <TextInput
                style={styles.input}
                value={heroName}
                onChangeText={setHeroName}
                onBlur={() => {
                  if (heroName.trim() !== requestedHeroNameRef.current) {
                    void loadCard(heroName);
                  }
                }}
                placeholder={t('questShareStatic:finaleShare.heroNamePlaceholder')}
                placeholderTextColor={colors.textMuted}
                maxLength={40}
                returnKeyType="done"
                accessibilityLabel={t('questShareStatic:finaleShare.heroNameLabel')}
                testID="quest-result-hero-name"
              />
            </View>
          ) : null}

          <View style={styles.channels}>
            {channels.map((channel) => (
              <Pressable
                key={channel.key}
                style={({ pressed }) => [styles.channel, pressed && styles.channelPressed]}
                onPress={channel.onPress}
                accessibilityRole="button"
                accessibilityLabel={channel.label}
                testID={`quest-share-channel-${channel.key}`}
              >
                <View style={styles.channelIcon}>
                  <Feather name={channel.icon} size={18} color={channel.color} />
                </View>
                <Text style={styles.channelLabel} numberOfLines={1}>
                  {channel.shortLabel}
                </Text>
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
    // Лист держится в нижней трети экрана телефона: подписи каналов добавили
    // высоту, поэтому служебные отступы ужаты до sm (#1667). Нижняя кромка
    // считается в рендере: `Modal` не приносит системных вставок, и без
    // `Math.max(insets.bottom, ...)` подписи каналов уходят под home indicator
    // iPhone (34pt) и жестовую панель Android — тот же приём, что в
    // `components/navigation/OpenInMapsSheet.tsx`.
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      paddingTop: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      gap: DESIGN_TOKENS.spacing.sm,
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
      width: DESIGN_TOKENS.touchTarget.minWidth,
      height: DESIGN_TOKENS.touchTarget.minHeight,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    preview: {
      width: '100%',
      aspectRatio: 1200 / 630,
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    },
    field: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '600',
      color: colors.textMuted,
    },
    input: {
      minHeight: Platform.OS === 'android' ? 48 : 44,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      color: colors.text,
      fontSize: DESIGN_TOKENS.typography.sizes.md,
    },
    // Каналы — первичное действие листа, поэтому подпись видна на любой ширине
    // (docs/RULES.md → UI rules: подпись убирают только у вторичных инструментов).
    // Ряд остаётся ЦЕНТРИРОВАННЫМ кластером. `space-between` здесь выглядит
    // логично, но лист растянут на всю ширину вьюпорта: на десктопе он размазал
    // бы пять каналов по 1232pt, а на сокращённом наборе (нет карточки-диплома
    // и нет Web Share — остаются «Ссылка» и «Telegram») развёл бы две колонки
    // по противоположным кромкам.
    channels: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.xs,
    },
    // Колонка берёт ширину по содержимому, а не 1/N ряда: при равном делении на
    // 390pt каждой доставалось 62pt, и украинская «Посилання» (65pt) срезалась
    // эллипсисом — при том, что суммарно пять подписей занимают меньше
    // половины ряда (#1677). `flexShrink` с полом в тач-таргет оставляет
    // деградацию управляемой: экстремально длинный набор сожмётся до 44dp,
    // а не переполнит ряд.
    channel: {
      flexShrink: 1,
      minWidth: DESIGN_TOKENS.touchTarget.minWidth,
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    // Тап по каналу уводит во внешнее приложение: подтверждение нажатия — здесь
    // единственная мгновенная обратная связь (у `ui/Button` она была из коробки).
    channelPressed: {
      opacity: 0.6,
    },
    channelIcon: {
      width: DESIGN_TOKENS.touchTarget.minWidth,
      height: DESIGN_TOKENS.touchTarget.minHeight,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
    },
    channelLabel: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });

export default memo(ShareQuestResultSheet);
