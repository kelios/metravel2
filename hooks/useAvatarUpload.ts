import { useState, useCallback, useRef, useEffect } from 'react';
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
import { compressAvatar } from '@/utils/imageCompressor';
import { translate as i18nT } from '@/i18n'


interface UseAvatarUploadOptions {
    onSuccess?: (updated: UserProfileDto) => void;
}

type WebFileInputLike = {
    click: () => void;
};

type WebFileSelectionEvent = {
    target?: {
        files?: ArrayLike<File> | null;
    } | null;
};

/**
 * Shared hook for avatar pick + upload logic.
 * Used by both profile.tsx (quick upload) and settings.tsx (pick then upload).
 */
export function useAvatarUpload(options?: UseAvatarUploadOptions) {
    const { userId, setUserAvatar, triggerProfileRefresh } = useAuth();

    const [avatarFile, setAvatarFile] = useState<UploadUserProfileAvatarFile | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const webFileInputRef = useRef<WebFileInputLike | null>(null);
    const mountedRef = useRef(true);
    const uploadingRef = useRef(false);
    const objectUrlRef = useRef<string | null>(null);

    const revokeObjectUrl = useCallback(() => {
        if (objectUrlRef.current && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(objectUrlRef.current);
        }
        objectUrlRef.current = null;
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            revokeObjectUrl();
        };
    }, [revokeObjectUrl]);

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
                showToast({ type: 'warning', text1: i18nT('shared:hooks.useAvatarUpload.razreshenie_9b80cbe2'), text2: i18nT('shared:hooks.useAvatarUpload.nuzhen_dostup_k_galeree_1a8e0c34'), visibilityTime: 3000 });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.85,
                exif: false,
                allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                // AND-15: Compress avatar before upload (512px square, quality 0.85)
                const compressed = await compressAvatar(asset.uri);
                const compressedUri = compressed.uri || asset.uri;
                const file: UploadUserProfileAvatarFile = {
                    uri: compressedUri,
                    name: asset.fileName || `avatar_${Date.now()}.jpg`,
                    type: asset.mimeType || 'image/jpeg',
                };
                setAvatarFile(file);
                setAvatarPreviewUrl(compressedUri);
            }
        } catch {
            showToast({ type: 'error', text1: i18nT('shared:hooks.useAvatarUpload.oshibka_69b08b01'), text2: i18nT('shared:hooks.useAvatarUpload.ne_udalos_vybrat_izobrazhenie_125051f5'), visibilityTime: 3000 });
        }
    }, []);

    const handleWebFileSelected = useCallback((e: WebFileSelectionEvent) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        setAvatarFile(file);
        try {
            revokeObjectUrl();
            const url = URL.createObjectURL(file);
            objectUrlRef.current = url;
            setAvatarPreviewUrl(url);
        } catch {
            setAvatarPreviewUrl('');
        }
    }, [revokeObjectUrl]);

    const uploadAvatar = useCallback(async (fileOverride?: UploadUserProfileAvatarFile) => {
        const fileToUpload = fileOverride || avatarFile;
        if (!userId || !fileToUpload) {
            if (!fileToUpload) {
                showToast({ type: 'warning', text1: i18nT('shared:hooks.useAvatarUpload.vyberite_izobrazhenie_aeb880ba'), text2: i18nT('shared:hooks.useAvatarUpload.snachala_vyberite_foto_dlya_avatara_6ac2f097'), visibilityTime: 3000 });
            }
            return null;
        }

        if (uploadingRef.current) return null;
        uploadingRef.current = true;
        setIsUploading(true);
        try {
            const saved = await uploadUserProfileAvatarFile(userId, fileToUpload);
            if (!mountedRef.current) return saved;
            revokeObjectUrl();
            setAvatarPreviewUrl(saved.avatar || avatarPreviewUrl);
            setAvatarFile(null);
            syncAvatar(saved.avatar);
            triggerProfileRefresh();
            showToast({ type: 'success', text1: i18nT('shared:hooks.useAvatarUpload.avatar_obnovlen_bd2dbaee'), visibilityTime: 3000 });
            options?.onSuccess?.(saved);
            return saved;
        } catch (error) {
            if (!mountedRef.current) return null;
            const message = error instanceof ApiError ? error.message : i18nT('shared:hooks.useAvatarUpload.ne_udalos_obnovit_avatar_0554f04b');
            showToast({ type: 'error', text1: i18nT('shared:hooks.useAvatarUpload.oshibka_69b08b01'), text2: message, visibilityTime: 4000 });
            return null;
        } finally {
            uploadingRef.current = false;
            if (mountedRef.current) setIsUploading(false);
        }
    }, [avatarFile, avatarPreviewUrl, options, revokeObjectUrl, syncAvatar, triggerProfileRefresh, userId]);

    /**
     * Quick upload: pick + immediately upload (used by profile page).
     */
    const pickAndUpload = useCallback(async () => {
        if (isUploading || uploadingRef.current) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                exif: false,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                if (!userId) return;

                let file: UploadUserProfileAvatarFile;
                if (Platform.OS === 'web') {
                    // На web RN-объект {uri,name,type} не годится: FormData сериализует его в
                    // строку "[object Object]", и бэкенд отвечает 400 («not a file»).
                    // fetch(blob:/data:) тоже отпадает — CSP connect-src не разрешает blob:.
                    // expo-image-picker на web кладёт настоящий File в asset.file — берём его.
                    const webFile = (asset as { file?: File }).file;
                    if (!webFile) {
                        showToast({ type: 'error', text1: i18nT('shared:hooks.useAvatarUpload.oshibka_69b08b01'), text2: i18nT('shared:hooks.useAvatarUpload.ne_udalos_prochitat_fayl_izobrazheniya_cf825c50'), visibilityTime: 3000 });
                        return;
                    }
                    file = webFile;
                } else {
                    // AND-15: Compress avatar before upload (512px square, quality 0.85)
                    const compressed = await compressAvatar(asset.uri);
                    const compressedUri = compressed.uri || asset.uri;
                    file = {
                        uri: compressedUri,
                        name: asset.fileName || 'avatar.jpg',
                        type: asset.mimeType || 'image/jpeg',
                    };
                }
                await uploadAvatar(file);
            }
        } catch (e) {
            if (!mountedRef.current) return;
            console.error(e);
            showToast({ type: 'error', text1: i18nT('shared:hooks.useAvatarUpload.oshibka_69b08b01'), text2: i18nT('shared:hooks.useAvatarUpload.ne_udalos_vybrat_izobrazhenie_125051f5') });
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
