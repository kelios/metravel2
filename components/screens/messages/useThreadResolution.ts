import { useEffect, useMemo, useState } from 'react';

import {
    collectLegacyPeerIds,
    collectParticipantPreviews,
    getMessagingUserDisplayName,
    getMessagingUserId,
    isOrphanedMessageThread,
} from '@/api/messages';
import type { MessageThread, MessagingUser } from '@/api/messages';
import { fetchUserProfile, resolveProfileFullName } from '@/api/user';
import { translate as i18nT } from '@/i18n';

type Params = {
    threads: MessageThread[];
    selectedThread: MessageThread | null;
    userId: string | null;
    users: MessagingUser[];
};

export function useThreadResolution({ threads, selectedThread, userId, users }: Params) {
    const participantNames = useMemo(() => {
        const map = new Map<number, string>();
        for (const u of users) {
            const uid = getMessagingUserId(u);
            map.set(uid, getMessagingUserDisplayName(u));
        }
        return map;
    }, [users]);

    const participantAvatars = useMemo(() => {
        const map = new Map<number, string | null>();
        for (const u of users) {
            const uid = getMessagingUserId(u);
            map.set(uid, u.avatar ?? null);
        }
        return map;
    }, [users]);

    const otherUserId = useMemo(() => {
        if (!selectedThread || !userId) return null;
        const currentUserIdNum = Number(userId);
        return selectedThread.participants.find((id) => id !== currentUserIdNum) ?? null;
    }, [selectedThread, userId]);

    // #708: канонический источник имён/аватаров — participant_previews из payload
    // /message-threads/. Покрывает и список диалогов, и шапку открытого чата.
    const previewPeers = useMemo(
        () => collectParticipantPreviews([...threads, selectedThread]),
        [threads, selectedThread],
    );

    // Fallback для старого API без participant_previews: peers часто отсутствуют в
    // available-users, поэтому без резолва профилей список и шапка показывали бы
    // генерик «Пользователь». На каноническом payload previews этот путь не даёт
    // ни одного fetchUserProfile-запроса (N+1 убран).
    const [resolvedPeers, setResolvedPeers] = useState<
        Map<number, { name: string; avatar: string | null }>
    >(() => new Map());

    const peerIdsToResolve = useMemo(() => {
        const ids = new Set<number>(collectLegacyPeerIds(threads, Number(userId)));
        if (otherUserId != null) ids.add(otherUserId);
        return Array.from(ids).filter(
            (id) => !previewPeers.has(id) && !participantNames.has(id) && !resolvedPeers.has(id),
        );
    }, [threads, otherUserId, userId, previewPeers, participantNames, resolvedPeers]);

    useEffect(() => {
        if (peerIdsToResolve.length === 0) return;
        let cancelled = false;
        void Promise.all(
            peerIdsToResolve.map(async (id) => {
                try {
                    const p = await fetchUserProfile(id);
                    const name = resolveProfileFullName(p);
                    return [id, { name, avatar: p.avatar ?? null }] as const;
                } catch {
                    return null;
                }
            }),
        ).then((entries) => {
            if (cancelled) return;
            const valid = entries.filter(Boolean) as Array<
                readonly [number, { name: string; avatar: string | null }]
            >;
            if (valid.length === 0) return;
            setResolvedPeers((prev) => {
                const next = new Map(prev);
                for (const [id, info] of valid) next.set(id, info);
                return next;
            });
        });
        return () => {
            cancelled = true;
        };
    }, [peerIdsToResolve]);

    // Names/avatars enriched with resolved peer profiles — used by BOTH the thread
    // list and the open chat header so neither shows the generic «Пользователь».
    // participant_previews (#708) — канонический источник, перекрывает остальные.
    const mergedNames = useMemo(() => {
        const map = new Map(participantNames);
        for (const [id, info] of resolvedPeers) {
            if (info.name && !map.has(id)) map.set(id, info.name);
        }
        for (const [id, info] of previewPeers) {
            if (info.name) map.set(id, info.name);
        }
        return map;
    }, [participantNames, resolvedPeers, previewPeers]);

    const mergedAvatars = useMemo(() => {
        const map = new Map(participantAvatars);
        for (const [id, info] of resolvedPeers) {
            if (!map.has(id)) map.set(id, info.avatar);
        }
        for (const [id, info] of previewPeers) {
            if (info.avatar || !map.has(id)) map.set(id, info.avatar);
        }
        return map;
    }, [participantAvatars, resolvedPeers, previewPeers]);

    const otherUserName = useMemo(() => {
        if (otherUserId != null && mergedNames.has(otherUserId)) {
            return mergedNames.get(otherUserId)!;
        }
        if (isOrphanedMessageThread(selectedThread, Number(userId))) {
            return i18nT('errorsStatic:api.messages.deletedUser');
        }
        return i18nT('messages:app.tabs.messages.polzovatel_3baf520c');
    }, [otherUserId, mergedNames, selectedThread, userId]);

    const otherUserAvatar = useMemo(() => {
        if (otherUserId != null && mergedAvatars.has(otherUserId)) {
            return mergedAvatars.get(otherUserId) ?? null;
        }
        return null;
    }, [otherUserId, mergedAvatars]);

    return { otherUserId, mergedNames, mergedAvatars, otherUserName, otherUserAvatar };
}
