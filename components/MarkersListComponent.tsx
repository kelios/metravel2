import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { MarkerData } from "@/src/types/types";
import ImageUploadComponent from '@/components/imageUpload/ImageUploadComponent';
import MultiSelectField from '@/components/MultiSelectField';

const MultiSelectFieldAny: any = MultiSelectField;

interface MarkersListComponentProps {
    markers: MarkerData[];
    categoryTravelAddress: { id: number; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    handleMarkerRemove: (index: number) => void;
    editingIndex: number | null;
    setEditingIndex: (index: number | null) => void;
    activeIndex?: number | null;
    setActiveIndex?: (index: number | null) => void;
    travelId?: string | null;
}

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
        if (activeIndex == null) return;
        const el = document.getElementById(`marker-${activeIndex}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeIndex]);

    return (
        <div style={styles.container}>
            <div style={styles.headerRow}>
                <div style={styles.headerTitle}>Точки</div>
                <div style={styles.headerBadge}>{markers.length}</div>
            </div>
            {markers.length > 0 && (
                <div style={styles.searchRow}>
                    <Feather name="search" size={14} color="#6b7280" />
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
                            ? `${marker.categories.length} ${marker.categories.length === 1 ? 'категория' : 'категории'}`
                            : 'Категории не выбраны';
                        const hasImage = !!marker.image;

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
                                            <img src={marker.image} alt="Фото" style={styles.previewImage} />
                                        ) : (
                                            <div style={styles.placeholderImage}>Нет фото</div>
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
                                            <Feather name="edit-2" size={13} color="#0f3d2e" />
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
                                            <Feather name="trash-2" size={13} color="#7f1d1d" />
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
                />
            )}
        </div>
    );
};

interface EditMarkerModalProps {
    marker: MarkerData;
    index: number;
    categoryTravelAddress: { id: number; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    onClose: () => void;
    onRemove: (index: number) => void;
}

const EditMarkerModal: React.FC<EditMarkerModalProps> = ({
                                                             marker,
                                                             index,
                                                             categoryTravelAddress,
                                                             handleMarkerChange,
                                                             handleImageUpload,
                                                             onClose,
                                                             onRemove,
                                                         }) => {
    const [address, setAddress] = useState<string>(marker.address || '');
    const [categories, setCategories] = useState<any[]>(marker.categories || []);

    useEffect(() => {
        setAddress(marker.address || '');
        setCategories(marker.categories || []);
    }, [marker, index]);

    if (typeof document === 'undefined') return null;

    const handleSave = () => {
        handleMarkerChange(index, 'address', address);
        handleMarkerChange(index, 'categories', categories);
        onClose();
    };

    const handleDelete = () => {
        const shortAddr = address || marker.address || 'эту точку';
        // eslint-disable-next-line no-alert
        const confirmed = window.confirm(`Удалить точку "${shortAddr}" из маршрута? Это действие нельзя отменить.`);
        if (!confirmed) return;
        onRemove(index);
        onClose();
    };

    return ReactDOM.createPortal(
        <div style={styles.modalOverlay}>
            <div style={styles.modalBackdrop} onClick={onClose} />
            <div style={styles.modalContent}>
                <div style={styles.editForm}>
                    <div style={styles.editHeader}>
                        <div>
                            <div style={styles.editTitle}>Точка #{index + 1}</div>
                            <div style={styles.editSubtitle}>{marker.address || 'Без адреса'}</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
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
                            items={categoryTravelAddress}
                            value={categories}
                            onChange={(selected: any) => setCategories(selected as any[])}
                            labelField="name"
                            valueField="id"
                        />
                        <div style={styles.fieldHint}>
                            Например: смотровая площадка, кемпинг, парковка, заправка, кафе.
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Изображение точки</label>
                        {marker.id == null ? (
                            <div style={styles.fieldHint}>
                                Фото можно будет добавить после сохранения маршрута.
                                Нажмите «Сохранить маршрут» внизу шага и затем откройте точку снова.
                            </div>
                        ) : (
                            <>
                                <ImageUploadComponent
                                    collection="travelImageAddress"
                                    idTravel={String(marker.id)}
                                    oldImage={marker.image}
                                    onUpload={(imageUrl) => handleImageUpload(index, imageUrl)}
                                />
                                <div style={styles.fieldHint}>
                                    Фото поможет путешественникам узнать место. Можно загрузить одно главное изображение.
                                </div>
                            </>
                        )}
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
                                onClick={onClose}
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
                            <Feather name="trash-2" size={14} color={palette.danger} />
                            <span>Удалить точку</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
};

const palette = DESIGN_TOKENS.colors;

const styles: any = {
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
        color: '#111827',
    },
    headerBadge: {
        fontSize: '12px',
        fontWeight: 700,
        padding: '2px 10px',
        borderRadius: '999px',
        backgroundColor: '#eef2ff',
        color: '#3730a3',
    },
    searchRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '10px',
        border: '1px solid #e5e7eb',
        backgroundColor: '#fff',
        marginBottom: '12px',
    },
    searchInput: {
        width: '100%',
        border: 'none',
        outline: 'none',
        fontSize: '13px',
        color: '#111827',
        backgroundColor: 'transparent',
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        fontSize: '13px',
        lineHeight: 1.4,
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    markerItem: {
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '10px 12px',
        backgroundColor: '#fff',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    },
    editingItem: {
        border: '1px solid rgba(79, 70, 229, 0.35)',
        boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.16)',
    },
    activeItem: {
        border: '1px solid rgba(17, 94, 71, 0.35)',
        boxShadow: '0 0 0 3px rgba(17, 94, 71, 0.12)',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    indexBadge: {
        width: '26px',
        height: '26px',
        borderRadius: '999px',
        backgroundColor: '#f3f4f6',
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        flexShrink: 0,
    },
    thumbnailWrapper: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
    },
    placeholderImage: {
        fontSize: '10px',
        color: '#9ca3af',
        textAlign: 'center',
        padding: '4px',
        lineHeight: 1.2,
    },
    previewText: {
        flex: 1,
        minWidth: 0,
    },
    markerTitle: {
        fontSize: '13px',
        fontWeight: 700,
        color: '#111827',
        lineHeight: 1.25,
        marginBottom: '4px',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    },
    metaRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
    },
    badge: {
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '999px',
        backgroundColor: '#e5f3ef',
        color: '#115e47',
    },
    badgeMuted: {
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '999px',
        backgroundColor: '#e5e7eb',
        color: '#4b5563',
    },
    actions: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginLeft: '8px',
        flexShrink: 0,
    },
    editButton: {
        backgroundColor: '#eef2ff',
        color: '#1f2937',
        border: '1px solid #e5e7eb',
        padding: '6px 10px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '11px',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 600,
    },
    deleteButton: {
        backgroundColor: '#fee2e2',
        color: '#7f1d1d',
        border: '1px solid #fecaca',
        padding: '6px 10px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '11px',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 600,
    },
    editForm: {
        display: 'flex',
        flexDirection: 'column',
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
        color: '#111827',
    },
    editSubtitle: {
        fontSize: '12px',
        color: '#4b5563',
        marginTop: '2px',
        maxWidth: '260px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    closeIconButton: {
        border: 'none',
        backgroundColor: 'transparent',
        fontSize: '16px',
        lineHeight: 1,
        cursor: 'pointer',
        color: '#6b7280',
        padding: '2px 6px',
        borderRadius: '999px',
    },
    helperText: {
        fontSize: '12px',
        color: '#4b5563',
        lineHeight: 1.4,
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontSize: '12px',
    },
    fieldLabel: {
        fontWeight: 500,
        color: '#111827',
    },
    fieldHint: {
        fontSize: '11px',
        color: '#6b7280',
        lineHeight: 1.4,
    },
    input: {
        width: '100%',
        padding: '8px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '13px',
    },
    imagePreview: {
        width: '100px',
        height: '100px',
        objectFit: 'cover',
        borderRadius: '6px',
        backgroundColor: '#f0f0f0',
        marginTop: '4px',
    },
    actionsRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        marginTop: '4px',
        flexWrap: 'wrap',
    },
    primaryActions: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
    },
    primaryButton: {
        backgroundColor: palette.primary,
        color: '#fff',
        border: 'none',
        padding: '6px 14px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
    },
    secondaryButton: {
        backgroundColor: '#fff',
        color: palette.text,
        border: `1px solid ${palette.border}`,
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
    },
    deleteTextButton: {
        backgroundColor: 'transparent',
        color: palette.danger,
        border: 'none',
        padding: '4px 0',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap',
    },
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBackdrop: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    modalContent: {
        position: 'relative',
        backgroundColor: '#fff',
        borderRadius: '12px',
        maxWidth: '720px',
        width: '90%',
        maxHeight: '90vh',
        padding: '20px 24px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        overflowY: 'auto',
    },
};

export default React.memo(MarkersListComponent);
