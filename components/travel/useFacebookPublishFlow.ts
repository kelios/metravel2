import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { TravelFormData } from '@/types/types';
import { devError } from '@/utils/logger';
import { showToastMessage } from '@/utils/toast';
import { openExternalUrl } from '@/utils/externalLinks';
import { ApiError, isTimeoutError } from '@/api/client';
import {
    fetchFacebookOAuthStartUrl,
    fetchFacebookPublishStatus,
    publishTravelToFacebook,
    FACEBOOK_PUBLISH_PHOTO_MAX_COUNT,
    type FacebookPublishCapability,
} from '@/api/facebookPublish';
import { translate as i18nT } from '@/i18n';
import type {
    FacebookPublishPhotoOption,
    FacebookPublishUiState,
} from '@/components/travel/FacebookPublishPanel';

const normalizeFacebookPhotoUrl = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    return '';
};

export const buildFacebookPhotoOptions = (
    galleryItems: unknown[],
): FacebookPublishPhotoOption[] => {
    const seen = new Set<string>();
    return galleryItems
        .map((item, index) => {
            if (typeof item === 'string') {
                const source = normalizeFacebookPhotoUrl(item);
                return source ? { id: source, source } : null;
            }
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, unknown>;
            const source = normalizeFacebookPhotoUrl(record.url);
            if (!source) return null;
            const rawId = record.id;
            const id = rawId != null ? String(rawId) : `${source}:${index}`;
            const caption = typeof record.caption === 'string' ? record.caption.trim() : '';
            return {
                id,
                source,
                apiId: typeof rawId === 'number' || typeof rawId === 'string' ? rawId : undefined,
                caption: caption || undefined,
            };
        })
        .filter((photo): photo is FacebookPublishPhotoOption => {
            if (!photo) return false;
            const dedupeKey = `${photo.id}|${photo.source}`;
            if (seen.has(dedupeKey)) return false;
            seen.add(dedupeKey);
            return true;
        });
};

type UseFacebookPublishFlowArgs = {
    formData: TravelFormData;
    galleryItems: unknown[];
    isSuperAdmin: boolean;
    defaultMessage: string;
};

export function useFacebookPublishFlow({
    formData,
    galleryItems,
    isSuperAdmin,
    defaultMessage,
}: UseFacebookPublishFlowArgs) {
    const facebookActionRef = useRef(false);
    const facebookMessageEditedRef = useRef(false);
    const facebookCapabilityMountedRef = useRef(true);
    const facebookCapabilityRefreshInFlightRef = useRef(false);
    const [facebookCapability, setFacebookCapability] = useState<FacebookPublishCapability | null>(null);
    const [facebookMessage, setFacebookMessage] = useState('');
    const [facebookState, setFacebookState] = useState<FacebookPublishUiState>('idle');
    const [facebookPostUrl, setFacebookPostUrl] = useState<string | undefined>();
    const [facebookSelectedPhotoIds, setFacebookSelectedPhotoIds] = useState<string[]>([]);

    const facebookPhotoOptions = useMemo(
        () => buildFacebookPhotoOptions(galleryItems),
        [galleryItems],
    );
    const facebookPhotoOptionsKey = useMemo(
        () => facebookPhotoOptions.map((photo) => photo.id).join('|'),
        [facebookPhotoOptions],
    );

    useEffect(() => {
        if (!facebookMessageEditedRef.current && defaultMessage.trim()) {
            setFacebookMessage(defaultMessage.trim());
        }
    }, [defaultMessage]);

    useEffect(() => {
        setFacebookSelectedPhotoIds((currentIds) => {
            const availableIds = new Set(facebookPhotoOptions.map((photo) => photo.id));
            const keptIds = currentIds.filter((photoId) => availableIds.has(photoId));
            if (keptIds.length > 0 || facebookPhotoOptions.length === 0) return keptIds;
            return facebookPhotoOptions.slice(0, 4).map((photo) => photo.id);
        });
    }, [facebookPhotoOptions, facebookPhotoOptionsKey]);

    const refreshFacebookCapability = useCallback(async () => {
        if (facebookCapabilityRefreshInFlightRef.current) return;
        facebookCapabilityRefreshInFlightRef.current = true;
        try {
            const capability = await fetchFacebookPublishStatus();
            if (!facebookCapabilityMountedRef.current) return;
            setFacebookCapability(capability);
            setFacebookState(capability.connected ? 'idle' : 'not_connected');
        } catch (error) {
            // A missing/forbidden capability must not expose a dead action.
            devError('Facebook publish capability unavailable:', error);
            if (facebookCapabilityMountedRef.current) setFacebookCapability(null);
        } finally {
            facebookCapabilityRefreshInFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (!isSuperAdmin) return;
        facebookCapabilityMountedRef.current = true;
        void refreshFacebookCapability();

        const handleWebResume = () => {
            if (!facebookCapabilityMountedRef.current) return;
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            void refreshFacebookCapability();
        };
        const isWeb = Platform.OS === 'web';
        if (isWeb && typeof window !== 'undefined') {
            window.addEventListener('focus', handleWebResume);
        }
        if (isWeb && typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleWebResume);
        }

        const subscription = isWeb
            ? null
            : AppState.addEventListener('change', (nextState) => {
                if (facebookCapabilityMountedRef.current && nextState === 'active') {
                    void refreshFacebookCapability();
                }
            });
        return () => {
            facebookCapabilityMountedRef.current = false;
            if (isWeb && typeof window !== 'undefined') {
                window.removeEventListener('focus', handleWebResume);
            }
            if (isWeb && typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleWebResume);
            }
            subscription?.remove();
        };
    }, [isSuperAdmin, refreshFacebookCapability]);

    const handleFacebookMessageChange = useCallback((value: string) => {
        facebookMessageEditedRef.current = true;
        setFacebookMessage(value);
    }, []);

    const handleToggleFacebookPhoto = useCallback((photoId: string) => {
        setFacebookSelectedPhotoIds((currentIds) =>
            currentIds.includes(photoId)
                ? currentIds.filter((currentId) => currentId !== photoId)
                : currentIds.length < FACEBOOK_PUBLISH_PHOTO_MAX_COUNT
                    ? [...currentIds, photoId]
                    : currentIds,
        );
    }, []);

    const handleConnectFacebook = useCallback(async () => {
        if (facebookActionRef.current || !facebookCapability?.configured) return;
        facebookActionRef.current = true;
        setFacebookState('connecting');
        try {
            const returnTo =
                Platform.OS === 'web' && typeof window !== 'undefined'
                    ? window.location?.href
                    : undefined;
            const authUrl = await fetchFacebookOAuthStartUrl(returnTo);
            if (!authUrl || !(await openExternalUrl(authUrl))) {
                throw new Error(i18nT('travel:components.travel.FacebookPublishPanel.oauthOpenError'));
            }
        } catch (error) {
            setFacebookState('error');
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.connectError'),
                text2: error instanceof Error ? error.message : undefined,
            });
        } finally {
            facebookActionRef.current = false;
            setFacebookState(facebookCapability.connected ? 'idle' : 'not_connected');
        }
    }, [facebookCapability]);

    const handlePublishToFacebook = useCallback(async () => {
        if (facebookActionRef.current) return;
        const travelId = Number(formData.id);
        if (!Number.isFinite(travelId) || travelId <= 0) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.saveFirst'),
            });
            return;
        }
        if (!facebookCapability?.connected || !facebookCapability.canPublish) {
            setFacebookState('not_connected');
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.notConnectedError'),
            });
            return;
        }
        const message = facebookMessage.trim();
        if (!message) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.messageRequired'),
            });
            return;
        }
        if (facebookSelectedPhotoIds.length > FACEBOOK_PUBLISH_PHOTO_MAX_COUNT) {
            void showToastMessage({
                type: 'error',
                text1: i18nT('travel:components.travel.FacebookPublishPanel.photoLimitReached', {
                    value1: FACEBOOK_PUBLISH_PHOTO_MAX_COUNT,
                }),
            });
            return;
        }

        facebookActionRef.current = true;
        setFacebookState('publishing');
        try {
            // Publication order follows the order the user picked the photos in, not gallery order.
            const photoOptionById = new Map(facebookPhotoOptions.map((photo) => [photo.id, photo]));
            const selectedPhotos = facebookSelectedPhotoIds
                .map((photoId) => photoOptionById.get(photoId))
                .filter((photo): photo is (typeof facebookPhotoOptions)[number] => Boolean(photo))
                .map((photo) => ({
                    id: photo.apiId,
                    url: photo.source,
                    caption: photo.caption,
                }));
            const result = await publishTravelToFacebook(travelId, message, selectedPhotos);
            const nextState = result.status === 'already_published' || result.duplicate
                ? 'already_published'
                : 'published';
            setFacebookState(nextState);
            setFacebookPostUrl(result.postUrl || undefined);
            void showToastMessage({
                type: 'success',
                text1: i18nT(
                    nextState === 'already_published'
                        ? 'travel:components.travel.FacebookPublishPanel.alreadyPublishedToast'
                        : 'travel:components.travel.FacebookPublishPanel.publishedToast',
                ),
            });
        } catch (error) {
            // Таймаут ≠ провал: сервер часто дописывает пост в Facebook уже
            // после обрыва ожидания. Повторную отправку не делаем — это
            // внешняя необратимая публикация, дублировать её нельзя.
            if (isTimeoutError(error)) {
                setFacebookState('pending');
                void showToastMessage({
                    type: 'info',
                    text1: i18nT('travel:components.travel.FacebookPublishPanel.pendingToast'),
                    text2: i18nT('travel:components.travel.FacebookPublishPanel.pendingHint'),
                });
                return;
            }
            const notConnected = error instanceof ApiError && error.status === 409;
            setFacebookState(notConnected ? 'not_connected' : 'error');
            if (notConnected) {
                setFacebookCapability((current) => current ? { ...current, connected: false, canPublish: false } : current);
            }
            void showToastMessage({
                type: 'error',
                text1: i18nT(
                    notConnected
                        ? 'travel:components.travel.FacebookPublishPanel.notConnectedError'
                        : 'travel:components.travel.FacebookPublishPanel.publishError',
                ),
                text2: error instanceof Error ? error.message : undefined,
            });
        } finally {
            facebookActionRef.current = false;
        }
    }, [facebookCapability, facebookMessage, facebookPhotoOptions, facebookSelectedPhotoIds, formData.id]);

    const handleOpenFacebookPost = useCallback(async () => {
        if (facebookPostUrl) await openExternalUrl(facebookPostUrl);
    }, [facebookPostUrl]);

    return {
        facebookCapability,
        facebookMessage,
        facebookState,
        facebookPostUrl,
        facebookPhotoOptions,
        facebookSelectedPhotoIds,
        facebookPhotoMaxCount: FACEBOOK_PUBLISH_PHOTO_MAX_COUNT,
        handleFacebookMessageChange,
        handleToggleFacebookPhoto,
        handleConnectFacebook,
        handlePublishToFacebook,
        handleOpenFacebookPost,
    };
}
