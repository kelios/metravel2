import React from 'react';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { normalizeMediaUrl } from '@/utils/mediaUrl';

const normalizeImageUrl = (url?: string | null) => normalizeMediaUrl(url);

type WebMapMarkerPopupProps = {
    marker: any;
    markerIndex: number;
    categoryTravelAddress: any[];
    colors: any;
    onEdit: (index: number) => void;
    onRemove: (index: number) => void;
};

export default function WebMapMarkerPopup({
    marker,
    markerIndex,
    categoryTravelAddress,
    colors,
    onEdit,
    onRemove,
}: WebMapMarkerPopupProps) {
    return (
        <div style={{ width: '100%', maxWidth: 320, padding: 0 }}>
            {marker.image && (
                <div
                    style={{
                        width: '100%',
                        height: 160,
                        borderRadius: DESIGN_TOKENS.radii.md,
                        overflow: 'hidden',
                        marginBottom: DESIGN_TOKENS.spacing.sm,
                        backgroundColor: colors.backgroundSecondary,
                    }}
                >
                    <ImageCardMedia
                        src={normalizeImageUrl(marker.image)}
                        alt="Фото"
                        fit="contain"
                        blurBackground
                        allowCriticalWebBlur
                        loading="lazy"
                        priority="low"
                        borderRadius={DESIGN_TOKENS.radii.md}
                        style={{ width: '100%', height: '100%' } as any}
                    />
                </div>
            )}

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: DESIGN_TOKENS.spacing.sm,
                }}
            >
                {marker.address && (
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.text,
                            lineHeight: 1.4,
                        }}
                    >
                        {marker.address}
                    </div>
                )}

                {marker.categories.length > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                        }}
                    >
                        {marker.categories
                            .map((catId: any) => {
                                const targetId = String(catId);
                                const found = categoryTravelAddress.find((c: any) => String(c.id) === targetId);
                                return found?.name ?? null;
                            })
                            .filter(Boolean)
                            .map((name: string, i: number) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '4px 10px',
                                        borderRadius: 999,
                                        backgroundColor: colors.backgroundTertiary,
                                        border: `1px solid ${colors.border}`,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: colors.textMuted,
                                    }}
                                >
                                    {name}
                                </div>
                            ))}
                    </div>
                )}

                <div
                    style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 4,
                    }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(markerIndex);
                        }}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '8px 12px',
                            borderRadius: DESIGN_TOKENS.radii.sm,
                            border: `1px solid ${colors.border}`,
                            backgroundColor: colors.surface,
                            color: colors.text,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.backgroundSecondary;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = colors.surface;
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Редактировать
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(markerIndex);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px 12px',
                            borderRadius: DESIGN_TOKENS.radii.sm,
                            border: `1px solid ${colors.border}`,
                            backgroundColor: colors.surface,
                            color: colors.textMuted,
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.dangerSoft;
                            e.currentTarget.style.borderColor = colors.danger;
                            e.currentTarget.style.color = colors.danger;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = colors.surface;
                            e.currentTarget.style.borderColor = colors.border;
                            e.currentTarget.style.color = colors.textMuted;
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
