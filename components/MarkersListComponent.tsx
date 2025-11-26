import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { MarkerData } from "@/src/types/types";
import ImageUploadComponent from '@/components/imageUpload/ImageUploadComponent';
import MultiSelectField from '@/components/MultiSelectField';

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
        <div id="markers-list-root" style={styles.container}>
            <h3 style={styles.header}>Точки на карте ({markers.length})</h3>
            {markers.length > 0 && (
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Найти точку по адресу"
                    style={styles.searchInput}
                />
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
                                    ...(isActive ? (styles.activeItem as React.CSSProperties) : {}),
                                }}
                                onClick={() => setActiveIndex?.(index)}
                            >
                                <div style={styles.row}>
                                    <div style={styles.indexBadge}>#{index + 1}</div>
                                    <div style={styles.thumbnailWrapper}>
                                        {hasImage ? (
                                            <img src={marker.image} alt="Фото" style={styles.previewImage} />
                                        ) : (
                                            <div style={styles.placeholderImage}>Нет фото</div>
                                        )}
                                    </div>
                                    <div style={styles.previewText}>
                                        <div style={styles.titleRow}>
                                            <span style={styles.markerTitle} title={marker.address || 'Без адреса'}>
                                                {marker.address || 'Без адреса'}
                                            </span>
                                        </div>
                                        <div style={styles.metaRow}>
                                            <span style={styles.badge}>{categoriesLabel}</span>
                                            {hasImage && <span style={styles.badgeMuted}>Есть фото</span>}
                                        </div>
                                    </div>
                                    <div style={styles.actions}>
                                        <button onClick={() => onEdit(index)} style={styles.editButton}>
                                            Редактировать
                                        </button>
                                        <button onClick={() => onRemove(index)} style={styles.deleteButton}>
                                            Удалить
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
                        <MultiSelectField
                            label=""
                            items={categoryTravelAddress}
                            value={categories}
                            onChange={(selected) => setCategories(selected as any[])}
                            labelField="name"
                            valueField="id"
                        />
                        <div style={styles.fieldHint}>
                            Например: смотровая площадка, кемпинг, парковка, заправка, кафе.
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>Изображение точки</label>
                        <ImageUploadComponent
                            collection="travelImageAddress"
                            idTravel={marker.id}
                            oldImage={marker.image}
                            onUpload={(imageUrl) => handleImageUpload(index, imageUrl)}
                        />
                        <div style={styles.fieldHint}>
                            Фото поможет путешественникам узнать место. Можно загрузить одно главное изображение.
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

const styles = {
    container: {
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '16px',
        maxHeight: '400px',
        overflowY: 'auto',
    },
    header: {
        fontSize: '16px',
        fontWeight: 600,
        marginBottom: '8px',
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
        borderRadius: '8px',
        padding: '8px 10px',
        backgroundColor: '#f9fafb',
    },
    editingItem: {
        border: '1px solid #4b7c6f',
        backgroundColor: '#e6f7ff',
        borderRadius: '8px',
        padding: '12px',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    indexBadge: {
        fontSize: '12px',
        color: '#6b7280',
        minWidth: '28px',
    },
    thumbnailWrapper: {
        width: '44px',
        height: '44px',
        borderRadius: '8px',
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
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4px',
        marginBottom: '2px',
    },
    markerTitle: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#111827',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
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
        backgroundColor: '#4b7c6f',
        color: 'white',
        border: 'none',
        padding: '4px 8px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
        whiteSpace: 'nowrap',
    },
    deleteButton: {
        backgroundColor: '#d9534f',
        color: 'white',
        border: 'none',
        padding: '4px 8px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
        whiteSpace: 'nowrap',
    },
    closeButton: {
        backgroundColor: '#6b7280',
        color: 'white',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
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
