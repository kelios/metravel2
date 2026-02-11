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
    TextInput,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { fetchMySubscriptions, fetchMySubscribers, unsubscribeFromUser, type UserProfileDto } from '@/api/user';
import { fetchMyTravels, unwrapMyTravelsPayload } from '@/api/travelsApi';
import EmptyState from '@/components/ui/EmptyState';
import TabTravelCard from '@/components/listTravel/TabTravelCard';
import SubscribeButton from '@/components/ui/SubscribeButton';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';
import { buildLoginHref } from '@/utils/authNavigation';
import { queryKeys } from '@/queryKeys';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { buildCanonicalUrl } from '@/utils/seo';
import { confirmAction } from '@/utils/confirmAction';
import { ApiError } from '@/api/client';
import { normalizeTravelPreview, resolveTravelUrl, type TravelPreview } from '@/app/(tabs)/subscriptions.helpers';

type SubscriptionTab = 'subscriptions' | 'subscribers';
type WebEnhancedViewStyle = ViewStyle & {
    boxShadow?: string;
    cursor?: 'pointer';
    WebkitOverflowScrolling?: 'touch';
    touchAction?: 'pan-x';
};
type WebEnhancedTextStyle = TextStyle & {
    outlineStyle?: 'none';
};

type AuthorWithTravels = {
    profile: UserProfileDto;
    travels: TravelPreview[];
    isLoadingTravels: boolean;
};

const WEB_HORIZONTAL_SCROLL_STYLE: WebEnhancedViewStyle = {
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-x',
};

const WEB_CARD_SHADOW_STYLE: WebEnhancedViewStyle = {
    boxShadow: DESIGN_TOKENS.shadows.card,
};

const WEB_CURSOR_POINTER_STYLE: WebEnhancedViewStyle = {
    cursor: 'pointer',
};

const WEB_TEXT_OUTLINE_NONE_STYLE: WebEnhancedTextStyle = {
    outlineStyle: 'none',
};

function SubscriberSection({
    profile,
    onMessage,
    onOpenProfile,
}: {
    profile: UserProfileDto;
    onMessage: (userId: number) => void;
    onOpenProfile: (userId: number) => void;
}) {
    const colors = useThemedColors();
    const styles = useMemo(() => createSubscriberStyles(colors), [colors]);
    const [avatarError, setAvatarError] = useState(false);

    const fullName = useMemo(() => {
        const first = String(profile.first_name ?? '').trim();
        const last = String(profile.last_name ?? '').trim();
        const name = `${first} ${last}`.trim();
        return name || 'Пользователь';
    }, [profile.first_name, profile.last_name]);

    const subscriberUserId = profile.user ?? profile.id;

    return (
        <View style={styles.section}>
            <View style={styles.row}>
                <Pressable
                    style={styles.info}
                    onPress={() => onOpenProfile(subscriberUserId)}
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
                    <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
                </Pressable>

                <View style={styles.actions}>
                    <SubscribeButton targetUserId={subscriberUserId} size="sm" />
                    <Pressable
                        style={[styles.actionButton, globalFocusStyles.focusable]}
                        onPress={() => onMessage(subscriberUserId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Написать ${fullName}`}
                        {...Platform.select({ web: { cursor: 'pointer' } })}
                    >
                        <Feather name="mail" size={16} color={colors.primary} />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

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
                            style: WEB_HORIZONTAL_SCROLL_STYLE,
                        },
                    })}
                >
                    {travels.slice(0, 10).map((travel) => {
                        const travelUrl = resolveTravelUrl(travel);
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
    const pushRoute = useCallback((href: string) => {
        router.push(href as Href);
    }, [router]);
    useResponsive();
    const { isAuthenticated, authReady } = useAuth();
    const colors = useThemedColors();
    const queryClient = useQueryClient();
    const styles = useMemo(() => createPageStyles(colors), [colors]);
    const [activeTab, setActiveTab] = useState<SubscriptionTab>('subscriptions');
    const [search, setSearch] = useState('');

    const retryFn = useCallback(
        (failureCount: number, error: Error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
            }
            return failureCount < 2;
        },
        []
    );

    const subscriptionsQuery = useQuery<UserProfileDto[]>({
        queryKey: queryKeys.mySubscriptions(),
        queryFn: fetchMySubscriptions,
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000,
        retry: retryFn,
    });

    const subscribersQuery = useQuery<UserProfileDto[]>({
        queryKey: queryKeys.mySubscribers(),
        queryFn: fetchMySubscribers,
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000,
        retry: retryFn,
    });

    const subscriptions = useMemo(() => subscriptionsQuery.data ?? [], [subscriptionsQuery.data]);
    const subscribers = useMemo(() => subscribersQuery.data ?? [], [subscribersQuery.data]);

    const getFullName = useCallback((p: UserProfileDto) => {
        const first = String(p.first_name ?? '').trim();
        const last = String(p.last_name ?? '').trim();
        return `${first} ${last}`.trim().toLowerCase();
    }, []);

    const filteredSubscribers = useMemo(() => {
        if (!search.trim()) return subscribers;
        const q = search.trim().toLowerCase();
        return subscribers.filter((p) => getFullName(p).includes(q));
    }, [subscribers, search, getFullName]);

    const [authorTravels, setAuthorTravels] = useState<Record<number, { travels: TravelPreview[]; loading: boolean }>>({});

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
                .then((result) => {
                    const { items: list } = unwrapMyTravelsPayload(result);
                    const normalizedTravels = list.map(normalizeTravelPreview);
                    setAuthorTravels((prev) => ({
                        ...prev,
                        [userId]: { travels: normalizedTravels, loading: false },
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
            pushRoute(`/messages?userId=${encodeURIComponent(userId)}`);
        },
        [pushRoute]
    );

    const handleOpenTravel = useCallback(
        (url: string) => {
            pushRoute(url);
        },
        [pushRoute]
    );

    const handleOpenProfile = useCallback(
        (userId: number) => {
            pushRoute(`/user/${userId}`);
        },
        [pushRoute]
    );

    const handleBackToProfile = useCallback(() => {
        pushRoute('/profile');
    }, [pushRoute]);

    const filteredAuthors = useMemo(
        () => {
            if (!search.trim()) return authors;
            const q = search.trim().toLowerCase();
            return authors.filter((a) => getFullName(a.profile).includes(q));
        },
        [authors, search, getFullName]
    );

    if (!authReady) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <View style={styles.headerTitleBlock}>
                            <Text style={styles.title}>Подписки</Text>
                            <Text style={styles.subtitle}>Профиль</Text>
                        </View>
                        <Pressable
                            style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                            onPress={handleBackToProfile}
                            accessibilityRole="button"
                            accessibilityLabel="Перейти в профиль"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="user" size={16} color={colors.primary} />
                            <Text style={styles.backToProfileButtonText}>В профиль</Text>
                        </Pressable>
                    </View>
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
                            pushRoute(
                                buildLoginHref({ redirect: '/subscriptions', intent: 'subscriptions' })
                            ),
                    }}
                />
            </SafeAreaView>
        );
    }

    const isActiveLoading = activeTab === 'subscriptions'
        ? subscriptionsQuery.isLoading
        : subscribersQuery.isLoading;

    if (isActiveLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <View style={styles.headerTitleBlock}>
                            <Text style={styles.title}>Подписки</Text>
                            <Text style={styles.subtitle}>Профиль</Text>
                        </View>
                        <Pressable
                            style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                            onPress={handleBackToProfile}
                            accessibilityRole="button"
                            accessibilityLabel="Перейти в профиль"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="user" size={16} color={colors.primary} />
                            <Text style={styles.backToProfileButtonText}>В профиль</Text>
                        </Pressable>
                    </View>
                </View>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const renderTabBar = () => (
        <View style={styles.tabBar}>
            <Pressable
                style={[
                    styles.tab,
                    activeTab === 'subscriptions' && styles.tabActive,
                    globalFocusStyles.focusable,
                ]}
                onPress={() => setActiveTab('subscriptions')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'subscriptions' }}
                accessibilityLabel="Подписки"
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Text style={[
                    styles.tabText,
                    activeTab === 'subscriptions' && styles.tabTextActive,
                ]}>
                    Подписки{subscriptions.length > 0 ? ` (${subscriptions.length})` : ''}
                </Text>
            </Pressable>
            <Pressable
                style={[
                    styles.tab,
                    activeTab === 'subscribers' && styles.tabActive,
                    globalFocusStyles.focusable,
                ]}
                onPress={() => setActiveTab('subscribers')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'subscribers' }}
                accessibilityLabel="Подписчики"
                {...Platform.select({ web: { cursor: 'pointer' } })}
            >
                <Text style={[
                    styles.tabText,
                    activeTab === 'subscribers' && styles.tabTextActive,
                ]}>
                    Подписчики{subscribers.length > 0 ? ` (${subscribers.length})` : ''}
                </Text>
            </Pressable>
        </View>
    );

    const renderSearchBar = () => (
        <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Поиск по имени..."
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Поиск по подпискам"
            />
            {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} accessibilityLabel="Очистить поиск">
                    <Feather name="x" size={16} color={colors.textMuted} />
                </Pressable>
            )}
        </View>
    );

    const renderSubscriptionsTab = () => {
        if (subscriptions.length === 0) {
            return (
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
            );
        }

        return (
            <>
                {renderSearchBar()}
                <View style={styles.header}>
                    <Text style={styles.subtitle}>
                        {subscriptions.length}{' '}
                        {subscriptions.length === 1
                            ? 'автор'
                            : subscriptions.length < 5
                                ? 'автора'
                                : 'авторов'}
                    </Text>
                </View>
                {filteredAuthors.map((author) => (
                    <AuthorSection
                        key={author.profile.user ?? author.profile.id}
                        author={author}
                        onUnsubscribe={handleUnsubscribe}
                        onMessage={handleMessage}
                        onOpenTravel={handleOpenTravel}
                        onOpenProfile={handleOpenProfile}
                    />
                ))}
                {filteredAuthors.length === 0 && search.trim() && (
                    <View style={styles.noResults}>
                        <Text style={[styles.noResultsText, { color: colors.textMuted }]}>Ничего не найдено</Text>
                    </View>
                )}
            </>
        );
    };

    const renderSubscribersTab = () => {
        if (subscribers.length === 0) {
            return (
                <EmptyState
                    icon="users"
                    title="У вас пока нет подписчиков"
                    description="Публикуйте путешествия, чтобы привлечь подписчиков."
                    variant="empty"
                />
            );
        }

        return (
            <>
                {renderSearchBar()}
                <View style={styles.header}>
                    <Text style={styles.subtitle}>
                        {subscribers.length}{' '}
                        {subscribers.length === 1
                            ? 'подписчик'
                            : subscribers.length < 5
                                ? 'подписчика'
                                : 'подписчиков'}
                    </Text>
                </View>
                {filteredSubscribers.map((profile) => (
                    <SubscriberSection
                        key={profile.user ?? profile.id}
                        profile={profile}
                        onMessage={handleMessage}
                        onOpenProfile={handleOpenProfile}
                    />
                ))}
                {filteredSubscribers.length === 0 && search.trim() && (
                    <View style={styles.noResults}>
                        <Text style={[styles.noResultsText, { color: colors.textMuted }]}>Ничего не найдено</Text>
                    </View>
                )}
            </>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <InstantSEO
                headKey="subscriptions"
                title="Подписки | Metravel"
                description="Ваши подписки и подписчики"
                canonical={buildCanonicalUrl('/subscriptions')}
                robots="noindex, nofollow"
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <View style={styles.headerTitleBlock}>
                            <Text style={styles.title}>Подписки</Text>
                            <Text style={styles.subtitle}>Профиль</Text>
                        </View>
                        <Pressable
                            style={[styles.backToProfileButton, globalFocusStyles.focusable]}
                            onPress={handleBackToProfile}
                            accessibilityRole="button"
                            accessibilityLabel="Перейти в профиль"
                            {...Platform.select({ web: { cursor: 'pointer' } })}
                        >
                            <Feather name="user" size={16} color={colors.primary} />
                            <Text style={styles.backToProfileButtonText}>В профиль</Text>
                        </Pressable>
                    </View>
                </View>
                {renderTabBar()}
                {activeTab === 'subscriptions' ? renderSubscriptionsTab() : renderSubscribersTab()}
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
        tabBar: {
            flexDirection: 'row',
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: DESIGN_TOKENS.radii.md,
            backgroundColor: colors.mutedBackground,
            padding: 4,
        },
        tab: {
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: DESIGN_TOKENS.radii.sm,
        },
        tabActive: {
            backgroundColor: colors.surface,
            ...(Platform.OS === 'web'
                ? WEB_CARD_SHADOW_STYLE
                : Platform.OS === 'android'
                    ? { elevation: 1 }
                    : {}),
        },
        tabText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
        },
        tabTextActive: {
            color: colors.primary,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 16,
            marginBottom: 8,
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            borderWidth: 1,
            borderRadius: DESIGN_TOKENS.radii.lg,
            gap: DESIGN_TOKENS.spacing.xs,
        },
        searchInput: {
            flex: 1,
            fontSize: 14,
            paddingVertical: DESIGN_TOKENS.spacing.xs,
            ...(Platform.OS === 'web' ? WEB_TEXT_OUTLINE_NONE_STYLE : {}),
        },
        noResults: {
            paddingVertical: DESIGN_TOKENS.spacing.xl,
            alignItems: 'center',
        },
        noResultsText: {
            fontSize: 14,
            fontStyle: 'italic',
        },
        backToProfileButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: DESIGN_TOKENS.radii.md,
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.surface,
            minHeight: 40,
        },
        backToProfileButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary,
        },
    });

const createSubscriberStyles = (colors: ReturnType<typeof useThemedColors>) =>
    StyleSheet.create({
        section: {
            marginHorizontal: 16,
            marginBottom: 10,
            backgroundColor: colors.surface,
            borderRadius: DESIGN_TOKENS.radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            ...(Platform.OS === 'web'
                ? WEB_CARD_SHADOW_STYLE
                : Platform.OS === 'android'
                    ? { elevation: 2 }
                    : {}),
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            gap: 10,
        },
        info: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
        },
        avatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
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
        name: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
            flex: 1,
        },
        actions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        actionButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
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
                ? WEB_CARD_SHADOW_STYLE
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
            ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
        },
        actionButtonDanger: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.dangerSoft,
            alignItems: 'center',
            justifyContent: 'center',
            ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
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
            ...(Platform.OS === 'web' ? WEB_CURSOR_POINTER_STYLE : {}),
        },
        showMoreText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.primary,
        },
    });
