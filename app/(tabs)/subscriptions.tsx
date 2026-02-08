import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Pressable,
    Platform,
    ScrollView,
    ActivityIndicator,
    Image,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions, unsubscribeFromUser, type UserProfileDto } from '@/api/user';
import { fetchMyTravels } from '@/api/travelsApi';
import EmptyState from '@/components/ui/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import { queryKeys } from '@/queryKeys';
import { confirmAction } from '@/utils/confirmAction';
import { ApiError } from '@/api/client';

type AuthorWithTravels = {
    profile: UserProfileDto;
    travels: any[];
    isLoadingTravels: boolean;
};

function AuthorSection({
    author,
    onUnsubscribe,
    onMessage,
    onOpenTravel,
    onOpenProfile,
}: {
    author: AuthorWithTravels;
    onUnsubscribe: (userId: number) => void;
    onMessage: (userId: number) => void;
    onOpenTravel: (url: string) => void;
    onOpenProfile: (userId: number) => void;
}) {
    const colors = useThemedColors();
    const styles = useMemo(() => createAuthorStyles(colors), [colors]);
    const { profile, travels, isLoadingTravels } = author;
    const [avatarError, setAvatarError] = useState(false);

    const fullName = useMemo(() => {
        const first = String(profile.first_name ?? '').trim();
        const last = String(profile.last_name ?? '').trim();
        const name = `${first} ${last}`.trim();
        return name || 'Пользователь';
    }, [profile.first_name, profile.last_name]);

    const authorUserId = profile.user ?? profile.id;

    return (
        <View style={styles.section}>
            <View style={styles.authorRow}>
                <Pressable
                    style={styles.authorInfo}
                    onPress={() => onOpenProfile(authorUserId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Открыть профиль ${fullName}`}
                    {...Platform.select({ web: { cursor: 'pointer' } })}
                >
                    <View style={styles.avatar}>
                        {profile.avatar && !avatarError ? (
                            <Image
                                source={{ uri: profile.avatar }}
                                style={styles.avatarImage}
                                onError={() => setAvatarError(true)}
                            />
                        ) : (
                            <Feather name="user" size={20} color={colors.primary} />
                        )}
                    </View>
                    <View style={styles.authorTextBlock}>
                        <Text style={styles.authorName} numberOfLines={1}>{fullName}</Text>
                        <Text style={styles.authorSub}>
                            {isLoadingTravels
                                ? 'Загрузка...'
                                : `${travels.length} ${travels.length === 1 ? 'путешествие' : travels.length < 5 ? 'путешествия' : 'путешествий'}`}
                        </Text>
                    </View>
                </Pressable>

                <View style={styles.authorActions}>
                    <Pressable
                        style={[styles.actionButton, globalFocusStyles.focusable]}
                        onPress={() => onMessage(authorUserId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Написать ${fullName}`}
                        {...Platform.select({ web: { cursor: 'pointer' } })}
                    >
                        <Feather name="mail" size={16} color={colors.primary} />
                    </Pressable>
                    <Pressable
                        style={[styles.actionButtonDanger, globalFocusStyles.focusable]}
                        onPress={() => onUnsubscribe(authorUserId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Отписаться от ${fullName}`}
                        {...Platform.select({ web: { cursor: 'pointer' } })}
                    >
                        <Feather name="user-minus" size={16} color={colors.danger} />
                    </Pressable>
                </View>
            </View>

            {isLoadingTravels ? (
                <View style={styles.travelsLoading}>
                    <SkeletonLoader width="100%" height={180} borderRadius={12} />
                </View>
            ) : travels.length === 0 ? (
                <Text style={styles.noTravels}>Нет опубликованных путешествий</Text>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.travelsScroll}
                    {...Platform.select({
                        web: {
                            style: {
                                WebkitOverflowScrolling: 'touch',
                                touchAction: 'pan-x',
                            } as any,
                        },
                    })}
                >
                    {travels.slice(0, 10).map((travel: any) => {
                        const travelUrl =
                            travel.url ||
                            travel.slug
                                ? `/travels/${travel.slug || travel.id}`
                                : `/travels/${travel.id}`;
                        return (
                            <View key={travel.id} style={styles.travelCardWrap}>
                                <TabTravelCard
                                    item={{
                                        id: travel.id,
                                        title: travel.name || travel.title || 'Без названия',
                                        imageUrl:
                                            travel.travel_image_thumb_small_url ||
                                            travel.travel_image_thumb_url ||
                                            travel.imageUrl ||
                                            null,
                                        city: travel.cityName || travel.city || null,
                                        country: travel.countryName || travel.country || null,
                                    }}
                                    onPress={() => onOpenTravel(travelUrl)}
                                    layout="grid"
                                    style={styles.travelCard}
                                />
                            </View>
                        );
                    })}
                    {travels.length > 10 && (
                        <Pressable
                            style={[styles.showMoreCard, globalFocusStyles.focusable]}
                            onPress={() => onOpenProfile(authorUserId)}
                            accessibilityRole="button"
                            accessibilityLabel="Показать все путешествия"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="arrow-right" size={24} color={colors.primary} />
                            <Text style={styles.showMoreText}>Ещё {travels.length - 10}</Text>
                        </Pressable>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

export default function SubscriptionsScreen() {
    const router = useRouter();
    const { width: _width } = useResponsive();
    const { isAuthenticated, authReady } = useAuth();
    const colors = useThemedColors();
    const queryClient = useQueryClient();
    const styles = useMemo(() => createPageStyles(colors), [colors]);

    const subscriptionsQuery = useQuery<UserProfileDto[]>({
        queryKey: queryKeys.mySubscriptions(),
        queryFn: fetchMySubscriptions,
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
            }
            return failureCount < 2;
        },
    });

    const subscriptions = useMemo(() => subscriptionsQuery.data ?? [], [subscriptionsQuery.data]);

    const [authorTravels, setAuthorTravels] = useState<Record<number, { travels: any[]; loading: boolean }>>({});

    useEffect(() => {
        if (!subscriptions.length) return;

        subscriptions.forEach((profile) => {
            const userId = profile.user ?? profile.id;

            setAuthorTravels((prev) => {
                if (prev[userId] && !prev[userId].loading) return prev;
                if (prev[userId]?.loading) return prev;
                return {
                    ...prev,
                    [userId]: { travels: prev[userId]?.travels ?? [], loading: true },
                };
            });

            fetchMyTravels({ user_id: userId })
                .then((result: any) => {
                    const list = Array.isArray(result)
                        ? result
                        : Array.isArray(result?.data)
                            ? result.data
                            : Array.isArray(result?.results)
                                ? result.results
                                : [];
                    setAuthorTravels((prev) => ({
                        ...prev,
                        [userId]: { travels: list, loading: false },
                    }));
                })
                .catch(() => {
                    setAuthorTravels((prev) => ({
                        ...prev,
                        [userId]: { travels: [], loading: false },
                    }));
                });
        });
    }, [subscriptions]);

    const authors: AuthorWithTravels[] = useMemo(
        () =>
            subscriptions.map((profile) => {
                const userId = profile.user ?? profile.id;
                const entry = authorTravels[userId];
                return {
                    profile,
                    travels: entry?.travels ?? [],
                    isLoadingTravels: entry?.loading ?? true,
                };
            }),
        [subscriptions, authorTravels]
    );

    const handleUnsubscribe = useCallback(
        async (userId: number) => {
            const confirmed = await confirmAction({
                title: 'Отписаться',
                message: 'Вы уверены, что хотите отписаться от этого автора?',
                confirmText: 'Отписаться',
                cancelText: 'Отмена',
            });
            if (!confirmed) return;

            try {
                await unsubscribeFromUser(userId);
                queryClient.invalidateQueries({ queryKey: queryKeys.mySubscriptions() });
            } catch {
                // silent
            }
        },
        [queryClient]
    );

    const handleMessage = useCallback(
        (userId: number) => {
            router.push(`/messages?userId=${encodeURIComponent(userId)}` as any);
        },
        [router]
    );

    const handleOpenTravel = useCallback(
        (url: string) => {
            router.push(url as any);
        },
        [router]
    );

    const handleOpenProfile = useCallback(
        (userId: number) => {
            router.push(`/user/${userId}` as any);
        },
        [router]
    );

    if (!authReady) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Подписки</Text>
                </View>
                <View style={styles.loadingWrap}>
                    {Array.from({ length: 2 }).map((_, i) => (
                        <SkeletonLoader key={i} width="100%" height={200} borderRadius={12} style={{ marginBottom: 14 }} />
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="users"
                    title="Войдите в аккаунт"
                    description="Войдите, чтобы подписываться на авторов и видеть их путешествия."
                    action={{
                        label: 'Войти',
                        onPress: () =>
                            router.push(
                                buildLoginHref({ redirect: '/subscriptions', intent: 'subscriptions' }) as any
                            ),
                    }}
                />
            </SafeAreaView>
        );
    }

    if (subscriptionsQuery.isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Подписки</Text>
                </View>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (subscriptions.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <EmptyState
                    icon="users"
                    title="Вы ещё ни на кого не подписаны"
                    description="Подпишитесь на авторов, чтобы видеть их путешествия здесь."
                    variant="empty"
                    action={{
                        label: 'Найти путешествия',
                        onPress: () => router.push('/search'),
                    }}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <View style={styles.headerTitleBlock}>
                            <Text style={styles.title}>Подписки</Text>
                            <Text style={styles.subtitle}>
                                {subscriptions.length}{' '}
                                {subscriptions.length === 1
                                    ? 'автор'
                                    : subscriptions.length < 5
                                        ? 'автора'
                                        : 'авторов'}
                            </Text>
                        </View>
                    </View>
                </View>

                {authors.map((author) => (
                    <AuthorSection
                        key={author.profile.user ?? author.profile.id}
                        author={author}
                        onUnsubscribe={handleUnsubscribe}
                        onMessage={handleMessage}
                        onOpenTravel={handleOpenTravel}
                        onOpenProfile={handleOpenProfile}
                    />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const createPageStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            paddingBottom: 32,
        },
        header: {
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
        },
        headerTitleBlock: {
            flex: 1,
        },
        title: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        subtitle: {
            marginTop: 4,
            fontSize: 13,
            color: colors.textMuted,
        },
        loadingWrap: {
            padding: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
        },
    });

const createAuthorStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        section: {
            marginHorizontal: 16,
            marginBottom: 16,
            backgroundColor: colors.surface,
            borderRadius: DESIGN_TOKENS.radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            ...(Platform.OS === 'web'
                ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any)
                : Platform.OS === 'android'
                    ? { elevation: 2 }
                    : {}),
        },
        authorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 14,
            gap: 12,
        },
        authorInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
        },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primarySoft,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: colors.primary,
            overflow: 'hidden',
        },
        avatarImage: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
        },
        authorTextBlock: {
            flex: 1,
            minWidth: 0,
        },
        authorName: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        authorSub: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        authorActions: {
            flexDirection: 'row',
            gap: 8,
        },
        actionButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
        },
        actionButtonDanger: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.dangerSoft,
            alignItems: 'center',
            justifyContent: 'center',
            ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
        },
        travelsLoading: {
            paddingHorizontal: 14,
            paddingBottom: 14,
        },
        noTravels: {
            paddingHorizontal: 14,
            paddingBottom: 14,
            fontSize: 13,
            color: colors.textMuted,
            fontStyle: 'italic',
        },
        travelsScroll: {
            paddingHorizontal: 14,
            paddingBottom: 14,
            gap: 12,
        },
        travelCardWrap: {
            width: 240,
        },
        travelCard: {
            width: '100%',
        },
        showMoreCard: {
            width: 120,
            borderRadius: DESIGN_TOKENS.radii.md,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
        },
        showMoreText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.primary,
        },
    });
