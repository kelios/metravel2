import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import {
    uploadUserProfileAvatarFile,
    normalizeAvatar,
    type UploadUserProfileAvatarFile,
    type UserProfileDto,
} from '@/api/user';
import { ApiError } from '@/api/client';
import { setStorageBatch, removeStorageBatch } from '@/utils/storageBatch';
import { showToast } from '@/utils/toast';

interface UseAvatarUploadOptions {
    onSuccess?: (updated: UserProfileDto) => void;
}

/**
 * Shared hook for avatar pick + upload logic.
 * Used by both profile.tsx (quick upload) and settings.tsx (pick then upload).
 */
export function useAvatarUpload(options?: UseAvatarUploadOptions) {
    const { userId, setUserAvatar, triggerProfileRefresh } = useAuth();

    const [avatarFile, setAvatarFile] = useState<UploadUserProfileAvatarFile | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const webFileInputRef = useRef<any>(null);

    const syncAvatar = useCallback(
        (avatarRaw: unknown) => {
            const avatar = normalizeAvatar(avatarRaw);
            setUserAvatar(avatar);
            if (avatar) {
                setStorageBatch([['userAvatar', avatar]]).catch(() => undefined);
            } else {
                removeStorageBatch(['userAvatar']).catch(() => undefined);
            }
        },
        [setUserAvatar],
    );

    const pickAvatar = useCallback(async () => {
        try {
            if (Platform.OS === 'web') {
                if (webFileInputRef.current && typeof webFileInputRef.current.click === 'function') {
                    webFileInputRef.current.click();
                }
                return;
            }

            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showToast({ type: 'warning', text1: 'Разрешение', text2: 'Нужен доступ к галерее', visibilityTime: 3000 });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.85,
                allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const file: UploadUserProfileAvatarFile = {
                    uri: asset.uri,
                    name: asset.fileName || `avatar_${Date.now()}.jpg`,
                    type: asset.mimeType || 'image/jpeg',
                };
                setAvatarFile(file);
                setAvatarPreviewUrl(asset.uri);
            }
        } catch {
            showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось выбрать изображение', visibilityTime: 3000 });
        }
    }, []);

    const handleWebFileSelected = useCallback((e: any) => {
        const file = e?.target?.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        try {
            const url = URL.createObjectURL(file);
            setAvatarPreviewUrl(url);
        } catch {
            setAvatarPreviewUrl('');
        }
    }, []);

    const uploadAvatar = useCallback(async (fileOverride?: UploadUserProfileAvatarFile) => {
        const fileToUpload = fileOverride || avatarFile;
        if (!userId || !fileToUpload) {
            if (!fileToUpload) {
                showToast({ type: 'warning', text1: 'Выберите изображение', text2: 'Сначала выберите фото для аватара', visibilityTime: 3000 });
            }
            return null;
        }

        setIsUploading(true);
        try {
            const saved = await uploadUserProfileAvatarFile(userId, fileToUpload);
            setAvatarPreviewUrl(saved.avatar || avatarPreviewUrl);
            setAvatarFile(null);
            syncAvatar(saved.avatar);
            triggerProfileRefresh();
            showToast({ type: 'success', text1: 'Аватар обновлён', visibilityTime: 3000 });
            options?.onSuccess?.(saved);
            return saved;
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Не удалось обновить аватар';
            showToast({ type: 'error', text1: 'Ошибка', text2: message, visibilityTime: 4000 });
            return null;
        } finally {
            setIsUploading(false);
        }
    }, [avatarFile, avatarPreviewUrl, options, syncAvatar, triggerProfileRefresh, userId]);

    /**
     * Quick upload: pick + immediately upload (used by profile page).
     */
    const pickAndUpload = useCallback(async () => {
        if (isUploading) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                if (!userId) return;

                const file: UploadUserProfileAvatarFile = {
                    uri: asset.uri,
                    name: asset.fileName || 'avatar.jpg',
                    type: asset.mimeType || 'image/jpeg',
                };
                await uploadAvatar(file);
            }
        } catch (e) {
            console.error(e);
            showToast({ type: 'error', text1: 'Ошибка', text2: 'Не удалось выбрать изображение' });
            setIsUploading(false);
        }
    }, [isUploading, uploadAvatar, userId]);

    return {
        avatarFile,
        avatarPreviewUrl,
        setAvatarPreviewUrl,
        isUploading,
        pickAvatar,
        uploadAvatar,
        pickAndUpload,
        handleWebFileSelected,
        webFileInputRef,
    };
}
