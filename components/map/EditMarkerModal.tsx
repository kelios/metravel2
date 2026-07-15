// components/map/EditMarkerModal.tsx
// C3.2: Extracted from MarkersListComponent.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import Feather from '@expo/vector-icons/Feather';
import { MarkerData } from '@/types/types';
import PhotoUploadWithPreview from '@/components/travel/PhotoUploadWithPreview';
import MultiSelectField from '@/components/forms/MultiSelectField';
import { isPointCategoryCreateEnabled } from '@/config/featureFlags';
import { createPointCategory } from '@/api/misc';
import type { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


const MultiSelectFieldAny: any = MultiSelectField;

export interface EditMarkerModalProps {
    marker: MarkerData;
    index: number;
    categoryTravelAddress: { id: number | string; name: string }[];
    handleMarkerChange: (index: number, field: string, value: string | string[]) => void;
    handleImageUpload: (index: number, imageUrl: string) => void;
    handleMarkerSave?: (index: number, payload: { address: string; categories: string[]; image: string }) => Promise<void> | void;
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
    handleMarkerSave,
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
    const [localImage, setLocalImage] = useState<string>(marker.image || '');
    const [extraCategories, setExtraCategories] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        setAddress(marker.address || '');
        setCategories(normalizeCategories(marker.categories));
        setLocalImage(marker.image || '');
        setExtraCategories([]);
    }, [marker, index, normalizeCategories]);

    const categoryItems = useMemo(() => {
        const seen = new Set(normalizedCategoryItems.map((c) => String(c.id)));
        return [...normalizedCategoryItems, ...extraCategories.filter((c) => !seen.has(c.id))];
    }, [normalizedCategoryItems, extraCategories]);

    const allowCreateCategory = isPointCategoryCreateEnabled();
    const handleCreateCategory = useCallback(async (name: string): Promise<string> => {
        const created = await createPointCategory(name);
        const idStr = String(created.id);
        setExtraCategories((prev) =>
            prev.some((c) => c.id === idStr) ? prev : [...prev, { id: idStr, name: created.name }],
        );
        return idStr;
    }, []);

    const handleLocalImageUpload = useCallback((imageUrl: string) => {
        setLocalImage(imageUrl);
        handleImageUpload(index, imageUrl);
    }, [handleImageUpload, index]);

    if (typeof document === 'undefined') return null;

    const persistEdits = () => {
        handleMarkerChange(index, 'address', address);
        handleMarkerChange(index, 'categories', categories);
        handleMarkerChange(index, 'image', localImage);
    };

    const handleClose = () => {
        persistEdits();
        onClose();
    };

    const handleSave = async () => {
        const trimmedAddress = address.trim().slice(0, 100);
        if (handleMarkerSave) {
            await handleMarkerSave(index, {
                address: trimmedAddress,
                categories,
                image: localImage,
            });
        } else {
            handleMarkerChange(index, 'address', trimmedAddress);
            handleMarkerChange(index, 'categories', categories);
            handleMarkerChange(index, 'image', localImage);
        }
        onClose();
    };

    const handleDelete = () => {
        const shortAddr = address || marker.address || i18nT('map:components.map.EditMarkerModal.etu_tochku_054e1134');
        const confirmed = window.confirm(i18nT('map:components.map.EditMarkerModal.udalit_tochku_value1_iz_marshruta_eto_deystv_229ad7bd', { value1: shortAddr }));
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
                            <div style={styles.editTitle}>{i18nT('map:components.map.EditMarkerModal.tochka_35020a41')}{index + 1}</div>
                            <div style={styles.editSubtitle}>{marker.address || i18nT('map:components.map.EditMarkerModal.bez_adresa_31af1956')}</div>
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
                        {i18nT('map:components.map.EditMarkerModal.opishite_mesto_tak_chtoby_vy_sami_cherez_god_1d45d9bf')}</div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>{i18nT('map:components.map.EditMarkerModal.adres_tochki_cfb17459')}</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value.slice(0, 100))}
                            maxLength={100}
                            style={styles.input}
                            placeholder={i18nT('map:components.map.EditMarkerModal.naprimer_parkovka_u_ozera_sucha_b5fd5cc9')}
                        />
                        <div style={{...styles.fieldHint, fontSize: '0.85em', color: colors.textMuted}}>
                            {i18nT('map:components.map.EditMarkerModal.mozhno_ostavit_adres_iz_karty_ili_sokratit_d_67e7e4c3')}{address.length}/100)
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>{i18nT('map:components.map.EditMarkerModal.kategorii_tochki_cb4d4962')}</label>
                        <MultiSelectFieldAny
                            label=""
                            items={categoryItems}
                            value={categories}
                            onChange={(selected: any) => {
                                const next = normalizeCategories(selected as any[]);
                                setCategories(next);
                                handleMarkerChange(index, 'categories', next);
                            }}
                            allowCreate={allowCreateCategory}
                            onCreateItem={handleCreateCategory}
                            createLabel={i18nT('map:components.map.EditMarkerModal.dobavit_kategoriyu_bb7b37c2')}
                            labelField="name"
                            valueField="id"
                            placeholder={i18nT('map:components.map.EditMarkerModal.vyberite_de6e6bdc')}
                            style={styles.multiSelect}
                            placeholderStyle={styles.multiSelectPlaceholder}
                            selectedTextStyle={styles.multiSelectSelectedText}
                            inputSearchStyle={styles.multiSelectSearchInput}
                            containerStyle={styles.multiSelectDropdownContainer}
                        />
                        <div style={styles.fieldHint}>
                            {i18nT('map:components.map.EditMarkerModal.vyberite_kategorii_kotorye_opisyvayut_etu_to_ec75aa9d')}</div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.fieldLabel}>{i18nT('map:components.map.EditMarkerModal.izobrazhenie_tochki_d9618978')}</label>
                        {marker.id != null ? (
                            <>
                                <PhotoUploadWithPreview
                                    collection="travelImageAddress"
                                    idTravel={String(marker.id)}
                                    oldImage={localImage}
                                    onUpload={handleLocalImageUpload}
                                    placeholder={i18nT('map:components.map.EditMarkerModal.peretaschite_foto_tochki_marshruta_3a234cc4')}
                                    maxSizeMB={10}
                                />
                                <div style={styles.fieldHint}>
                                    {i18nT('map:components.map.EditMarkerModal.foto_pomozhet_puteshestvennikam_uznat_mesto__e45440f7')}</div>
                            </>
                        ) : (
                            <div style={styles.fieldHint}>
                                {i18nT('map:components.map.EditMarkerModal.snachala_sohranite_marshrut_zatem_otkroyte_t_4fff3196')}</div>
                        )}
                    </div>

                    <div style={styles.actionsRow}>
                        <div style={styles.primaryActions}>
                            <button
                                type="button"
                                onClick={() => {
                                    void handleSave();
                                }}
                                style={styles.primaryButton}
                            >
                                {i18nT('map:components.map.EditMarkerModal.sohranit_4853bb8f')}</button>
                            <button
                                type="button"
                                onClick={handleClose}
                                style={styles.secondaryButton}
                            >
                                {i18nT('map:components.map.EditMarkerModal.otmena_0a02aca0')}</button>
                        </div>
                        <button
                            type="button"
                            onClick={handleDelete}
                            style={styles.deleteTextButton}
                        >
                            <Feather name="trash-2" size={14} color={colors.danger} />
                            <span>{i18nT('map:components.map.EditMarkerModal.udalit_tochku_b058b974')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default React.memo(EditMarkerModal);
