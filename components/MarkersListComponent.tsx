import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Feather } from '@expo/vector-icons';
import { MarkerData } from "@/src/types/types";
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import MultiSelectField from '@/components/MultiSelectField';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme';

const MultiSelectFieldAny: any = MultiSelectField;
 
interface MarkersListComponentProps {
    markers: MarkerData[];
    categoryTravelAddress: { id: number | string; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    handleMarkerRemove: (index: number) => void;
    editingIndex: number | null;
    setEditingIndex: (index: number | null) => void;
    activeIndex?: number | null;
    setActiveIndex?: (index: number | null) => void;
    travelId?: string | null;
}
const normalizeImageUrl = (url?: string | null) => {
    if (!url) return '';
    const trimmed = url.trim();
    // Поддерживаем превью blob:/data:
    if (/^(data:|blob:)/i.test(trimmed)) return trimmed;
    
    // ✅ Для абсолютных URL с приватным IP - извлекаем путь для проксирования через localhost
    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const parsed = new URL(trimmed);
            const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
            const isPrivateIp = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/i.test(trimmed);
            const isOnLocalhost = currentOrigin && /localhost|127\.0\.0\.1/i.test(currentOrigin);
            
            if (isPrivateIp && isOnLocalhost) {
                return parsed.pathname + parsed.search;
            }
            return trimmed;
        } catch {
            return trimmed;
        }
    }
    
    // Относительные URL - оставляем как есть
    return trimmed;
};

const useStyles = (colors: ReturnType<typeof useThemedColors>) => useMemo(() => ({
    container: {
        backgroundColor: 'transparent',
        padding: '0',
    },
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
    },
    headerTitle: {
        fontSize: '14px',
        fontWeight: 700,
        letterSpacing: '0.2px',
        color: colors.text,
    },
    headerBadge: {
        fontSize: '12px',
        fontWeight: 700,
        padding: '2px 10px',
        borderRadius: '999px',
        backgroundColor: colors.primarySoft,
        color: colors.primaryDark,
    },
    searchRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        marginBottom: '12px',
    },
    searchInput: {
        width: '100%',
        border: 'none',
        outline: 'none',
        fontSize: '13px',
        color: colors.text,
        backgroundColor: 'transparent',
    },
    emptyText: {
        textAlign: 'center' as const,
        color: colors.textMuted,
        fontSize: '13px',
        lineHeight: 1.4,
    },
    list: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
    markerItem: {
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '10px 12px',
        backgroundColor: colors.surface,
        boxShadow: colors.boxShadows.card,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    },
    editingItem: {
        border: `1px solid ${colors.borderAccent}`,
        boxShadow: `0 0 0 3px ${colors.primarySoft}`,
    },
    activeItem: {
        border: `1px solid ${colors.borderAccent}`,
        boxShadow: `0 0 0 3px ${colors.accentSoft}`,
    },
    row: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
    },
    indexBadge: {
        width: '26px',
        height: '26px',
        borderRadius: '999px',
        backgroundColor: colors.backgroundSecondary,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
    },
    thumbnailWrapper: {
        width: '56px',
        height: '56px',
        borderRadius: '10px',
        backgroundColor: colors.backgroundSecondary,
        border: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
    },
    previewMedia: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        fontSize: '10px',
        color: colors.textMuted,
        textAlign: 'center' as const,
        padding: '4px',
        lineHeight: 1.2,
    },
    previewText: {
        flex: 1,
        minWidth: 0,
        marginRight: '8px',
    },
    markerTitle: {
        fontSize: '13px',
        fontWeight: 700,
        color: colors.text,
        lineHeight: 1.25,
        marginBottom: '4px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
    },
    metaRow: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '6px',
        marginTop: '4px',
    },
    badge: {
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '999px',
        backgroundColor: colors.accentSoft,
        color: colors.accentDark,
    },
    badgeMuted: {
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '999px',
        backgroundColor: colors.backgroundSecondary,
        color: colors.textMuted,
    },
    actions: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '6px',
        marginLeft: '8px',
        flexShrink: 0,
        alignSelf: 'flex-start',
    },
    editButton: {
        backgroundColor: colors.primarySoft,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        padding: '6px 10px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '11px',
        whiteSpace: 'nowrap' as const,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 600,
    },
    deleteButton: {
        backgroundColor: colors.dangerSoft,
        color: colors.dangerDark,
        border: `1px solid ${colors.dangerLight}`,
        padding: '6px 10px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '11px',
        whiteSpace: 'nowrap' as const,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 600,
    },
    editForm: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    editHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '4px',
    },
    editTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: colors.text,
    },
    editSubtitle: {
        fontSize: '12px',
        color: colors.textMuted,
        marginTop: '2px',
        maxWidth: '260px',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    closeIconButton: {
        border: 'none',
        backgroundColor: 'transparent',
        fontSize: '16px',
        lineHeight: 1,
        cursor: 'pointer',
        color: colors.textMuted,
        padding: '2px 6px',
        borderRadius: '999px',
    },
    helperText: {
        fontSize: '12px',
        color: colors.textMuted,
        lineHeight: 1.4,
    },
    field: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
        fontSize: '12px',
    },
    fieldLabel: {
        fontWeight: 500,
        color: colors.text,
    },
    fieldHint: {
        fontSize: '11px',
        color: colors.textMuted,
        lineHeight: 1.4,
    },
    input: {
        width: '100%',
        padding: '8px',
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        fontSize: '13px',
        color: colors.text,
        backgroundColor: colors.surface,
    },
    imagePreview: {
        width: '100px',
        height: '100px',
        objectFit: 'cover' as const,
        borderRadius: '6px',
        backgroundColor: colors.backgroundSecondary,
        marginTop: '4px',
    },
    actionsRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        marginTop: '4px',
        flexWrap: 'wrap' as const,
    },
    primaryActions: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap' as const,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        color: colors.textInverse,
        border: 'none',
        padding: '6px 14px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
    },
    secondaryButton: {
        backgroundColor: colors.surface,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
    },
    deleteTextButton: {
        backgroundColor: 'transparent',
        color: colors.danger,
        border: 'none',
        padding: '4px 0',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap' as const,
    },
    modalOverlay: {
        position: 'fixed' as const,
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBackdrop: {
        position: 'absolute' as const,
        inset: 0,
        backgroundColor: colors.overlay,
    },
    modalContent: {
        position: 'relative' as const,
        backgroundColor: colors.surface,
        borderRadius: '12px',
        maxWidth: '720px',
        width: '90%',
        maxHeight: '90vh',
        padding: '20px 24px',
        boxShadow: colors.boxShadows.modal,
        overflowY: 'auto' as const,
    },
    multiSelect: {
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        padding: '8px 12px',
        backgroundColor: colors.surface,
        minHeight: '44px',
        boxShadow: colors.boxShadows.card,
    },
    multiSelectDropdownContainer: {
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        boxShadow: colors.boxShadows.card,
        padding: '6px',
    },
    multiSelectPlaceholder: {
        fontSize: '13px',
        color: colors.textMuted,
        fontWeight: 500,
    },
    multiSelectSelectedText: {
        fontSize: '13px',
        color: colors.text,
        fontWeight: 600,
    },
    multiSelectSearchInput: {
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '13px',
        color: colors.text,
        backgroundColor: colors.backgroundSecondary,
    },
}), [colors]);

const MarkersListComponent: React.FC<MarkersListComponentProps> = ({
                                                               markers,
                                                               categoryTravelAddress,
                                                               handleMarkerChange,
                                                               handleImageUpload,
                                                               handleMarkerRemove,
                                                               editingIndex,
                                                               setEditingIndex,
                                                               activeIndex,
                                                               setActiveIndex,
                                                           }) => {
    const colors = useThemedColors();
    const styles = useStyles(colors);
    const [search, setSearch] = useState('');
    const onRemove = useCallback((index: number) => handleMarkerRemove(index), [handleMarkerRemove]);
    const onEdit = useCallback((index: number) => {
        setEditingIndex(index);
        setActiveIndex?.(index);
    }, [setEditingIndex, setActiveIndex]);

    const filteredMarkers = useMemo(
        () =>
            markers
                .map((marker, index) => ({ marker, index }))
                .filter(({ marker }) => {
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    return (marker.address || '').toLowerCase().includes(q);
                }),
        [markers, search],
    );

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (activeIndex == null) return;

        const el = document.getElementById(`marker-${activeIndex}`);
        if (!el) return;

        const container = document.getElementById('markers-scroll-container');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();

        const currentScrollTop = container.scrollTop;
        const elTopInContainer = (elRect.top - containerRect.top) + currentScrollTop;
        const target = elTopInContainer - (container.clientHeight / 2) + (el.clientHeight / 2);

        container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, [activeIndex]);

    return (
        <div style={styles.container}>
            <div style={styles.headerRow}>
                <div style={styles.headerTitle}>Точки</div>
                <div style={styles.headerBadge}>{markers.length}</div>
            </div>
            {markers.length > 0 && (
                <div style={styles.searchRow}>
                    <Feather name="search" size={14} color={colors.textMuted} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Поиск по адресу"
                        style={styles.searchInput}
                    />
                </div>
            )}
            {markers.length === 0 ? (
                <p style={styles.emptyText}>
                    Пока нет ни одной точки маршрута. Нажмите на карту, чтобы добавить первую.
                </p>
            ) : (
                <div style={styles.list}>
                    {filteredMarkers.map(({ marker, index }) => {
                        const isEditing = editingIndex === index;

                        const hasCategories = marker.categories && marker.categories.length > 0;
                        const categoriesLabel = hasCategories
                            ? (marker.categories
                                  .map((catId: any) => {
                                      const targetId = String(catId);
                                      const found = categoryTravelAddress.find((c: any) => String(c.id) === targetId);
                                      return found?.name ?? null;
                                  })
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .join(', ') || 'Категории выбраны')
                            : 'Категории не выбраны';
                        // Проверяем, что image не пустая строка
                        const hasImage = marker.image && marker.image.trim().length > 0;

                        const isActive = activeIndex === index;

                        return (
                            <div
                                key={index}
                                id={`marker-${index}`}
                                style={{
                                    ...(styles.markerItem as React.CSSProperties),
                                    ...(isEditing ? (styles.editingItem as React.CSSProperties) : {}),
                                    ...(isActive ? (styles.activeItem as React.CSSProperties) : {}),
                                }}
                                onClick={() => setActiveIndex?.(index)}
                            >
                                <div style={styles.row}>
                                    <div style={styles.indexBadge}>{index + 1}</div>
                                    <div style={styles.thumbnailWrapper}>
                                        {hasImage ? (
                                            <ImageCardMedia
                                                src={normalizeImageUrl(marker.image)}
                                                fit="cover"
                                                blurBackground
                                                loading="lazy"
                                                priority="low"
                                                borderRadius={10}
                                                style={styles.previewMedia as any}
                                            />
                                        ) : (
                                            <div style={styles.placeholderImage} aria-label="Нет фото" />
                                        )}
                                        </div>
                                    <div style={styles.previewText}>
                                        <div style={styles.markerTitle} title={marker.address || 'Без адреса'}>
                                            {marker.address || 'Без адреса'}
                                        </div>
                                        <div style={styles.metaRow}>
                                            <span style={styles.badge}>{categoriesLabel}</span>
                                            {hasImage && <span style={styles.badgeMuted}>Есть фото</span>}
                                        </div>
                                    </div>
                                    <div style={styles.actions}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit(index);
                                            }}
                                            style={styles.editButton}
                                            type="button"
                                        >
                                            <Feather name="edit-2" size={13} color={colors.primaryDark} />
                                            <span>Редактировать</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemove(index);
                                            }}
                                            style={styles.deleteButton}
                                            type="button"
                                        >
                                            <Feather name="trash-2" size={13} color={colors.dangerDark} />
                                            <span>Удалить</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editingIndex !== null && markers[editingIndex] && (
                <EditMarkerModal
                    marker={markers[editingIndex]}
                    index={editingIndex}
                    categoryTravelAddress={categoryTravelAddress}
                    handleMarkerChange={handleMarkerChange}
                    handleImageUpload={handleImageUpload}
                    onClose={() => setEditingIndex(null)}
                    onRemove={onRemove}
                    styles={styles}
                    colors={colors}
                />
            )}
        </div>
    );
};

interface EditMarkerModalProps {
    marker: MarkerData;
    index: number;
    categoryTravelAddress: { id: number | string; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    onClose: () => void;
    onRemove: (index: number) => void;
    styles: any;
    colors: ReturnType<typeof useThemedColors>;
}
 

const EditMarkerModal: React.FC<EditMarkerModalProps> = ({
                                                             marker,
                                                             index,
                                                             categoryTravelAddress,
                                                             handleMarkerChange,
                                                             handleImageUpload,
                                                             onClose,
                                                             onRemove,
                                                             styles,
                                                             colors,
                                                         }) => {
    const normalizedCategoryItems = useMemo(
        () => categoryTravelAddress.map((cat) => ({ ...cat, id: String(cat.id) })),
        [categoryTravelAddress],
    );

    const normalizeCategories = useCallback(
        (cats?: any[]) => (Array.isArray(cats) ? cats.map((c) => String(c)) : []),
        [],
    );

    const [address, setAddress] = useState<string>(marker.address || '');
    const [categories, setCategories] = useState<any[]>(normalizeCategories(marker.categories));
    // ✅ FIX: Локальное состояние для изображения, чтобы превью обновлялось сразу после загрузки
    const [localImage, setLocalImage] = useState<string>(marker.image || '');

    useEffect(() => {
        setAddress(marker.address || '');
        setCategories(normalizeCategories(marker.categories));
        setLocalImage(marker.image || '');
    }, [marker, index, normalizeCategories]);
    
    // ✅ FIX: Обертка для handleImageUpload, которая также обновляет локальное состояние
    const handleLocalImageUpload = useCallback((imageUrl: string) => {
        setLocalImage(imageUrl);
        handleImageUpload(index, imageUrl);
    }, [handleImageUpload, index]);

    if (typeof document === 'undefined') return null;

    const persistEdits = () => {
        handleMarkerChange(index, 'address', address);
        handleMarkerChange(index, 'categories', categories);
    };

    const handleClose = () => {
        persistEdits();
        onClose();
    };

    const handleSave = () => {
        persistEdits();
        onClose();
    };

    const handleDelete = () => {
        const shortAddr = address || marker.address || 'эту точку';
        const confirmed = window.confirm(`Удалить точку "${shortAddr}" из маршрута? Это действие нельзя отменить.`);
        if (!confirmed) return;
        onRemove(index);
        onClose();
    };

    return ReactDOM.createPortal(
        <div style={styles.modalOverlay}>
            <div style={styles.modalBackdrop} onClick={handleClose} />
            <div style={styles.modalContent}>
                <div style={styles.editForm}>
                    <div style={styles.editHeader}>
                        <div>
                            <div style={styles.editTitle}>Точка #{index + 1}</div>
                            <div style={styles.editSubtitle}>{marker.address || 'Без адреса'}</div>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            style={styles.closeIconButton}
                        >
                            ×
                        </button>
                    </div>

                    <div style={styles.helperText}>
                        Опишите место так, чтобы вы сами через год быстро поняли, что здесь смотреть или делать.
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Адрес точки</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            style={styles.input}
                            placeholder="Например: Парковка у озера Sucha"
                        />
                        <div style={styles.fieldHint}>
                            Можно оставить адрес из карты или сократить до понятного названия места.
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Категории точки</label>
                        <MultiSelectFieldAny
                            label=""
                            items={normalizedCategoryItems}
                            value={categories}
                            onChange={(selected: any) => {
                                const next = normalizeCategories(selected as any[]);
                                setCategories(next);
                                handleMarkerChange(index, 'categories', next);
                            }}
                            labelField="name"
                            valueField="id"
                            placeholder="Выберите..."
                            style={styles.multiSelect}
                            placeholderStyle={styles.multiSelectPlaceholder}
                            selectedTextStyle={styles.multiSelectSelectedText}
                            inputSearchStyle={styles.multiSelectSearchInput}
                            containerStyle={styles.multiSelectDropdownContainer}
                        />
                        <div style={styles.fieldHint}>
                            Выберите категории, которые описывают эту точку маршрута.
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Изображение точки</label>
                        <PhotoUploadWithPreview
                            collection="travelImageAddress"
                            idTravel={marker.id ? String(marker.id) : null}
                            oldImage={localImage}
                            onUpload={handleLocalImageUpload}
                            placeholder="Перетащите фото точки маршрута"
                            maxSizeMB={10}
                        />
                        <div style={styles.fieldHint}>
                            {marker.id == null 
                                ? 'Превью будет сохранено. После сохранения маршрута фото загрузится на сервер автоматически.'
                                : 'Фото поможет путешественникам узнать место. Можно загрузить одно главное изображение.'
                            }
                        </div>
                    </div>

                    <div style={styles.actionsRow}>
                        <div style={styles.primaryActions}>
                            <button
                                type="button"
                                onClick={handleSave}
                                style={styles.primaryButton}
                            >
                                Сохранить
                            </button>
                            <button
                                type="button"
                                onClick={handleClose}
                                style={styles.secondaryButton}
                            >
                                Отмена
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleDelete}
                            style={styles.deleteTextButton}
                        >
                            <Feather name="trash-2" size={14} color={colors.danger} />
                            <span>Удалить точку</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};


export default React.memo(MarkersListComponent);
