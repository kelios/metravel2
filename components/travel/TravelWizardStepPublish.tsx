import React, { useMemo } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useTravelPublishChecklist } from '@/components/travel/useTravelPublishChecklist';
import { useTravelPublishModeration } from '@/components/travel/useTravelPublishModeration';
import { useInstagramPublishFlow } from '@/components/travel/useInstagramPublishFlow';
import { useFacebookPublishFlow } from '@/components/travel/useFacebookPublishFlow';
import PublishChecklistCard from '@/components/travel/PublishChecklistCard';
import InstagramPublishPanel from '@/components/travel/InstagramPublishPanel';
import FacebookPublishPanel from '@/components/travel/FacebookPublishPanel';
import PublishModerationAdminPanel from '@/components/travel/PublishModerationAdminPanel';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PublishStatusSummaryPanel from '@/components/travel/PublishStatusSummaryPanel';
import {
    INSTAGRAM_CAPTION_MAX_LENGTH,
    INSTAGRAM_HASHTAG_MAX_COUNT,
} from '@/utils/instagramPublish';
import { createStyles } from '@/components/travel/travelWizardStepPublish.styles';
import type { TravelWizardStepPublishProps } from '@/components/travel/TravelWizardStepPublish.types';
import { translate as i18nT } from '@/i18n';

const TravelWizardStepPublish: React.FC<TravelWizardStepPublishProps> = ({
    currentStep,
    totalSteps,
    formData,
    countries = [],
    setFormData,
    isSuperAdmin,
    onManualSave,
    onGoBack,
    onFinish: _onFinish,
    onNavigateToIssue,
    onStepSelect,
    stepMeta,
    autosaveBadge,
    onPreview,
    onOpenPublic,
}) => {
    const colors = useThemedColors();
    const { isMobile } = useResponsive();

    // ✅ УЛУЧШЕНИЕ: Мемоизация стилей с динамическими цветами
    const styles = useMemo(() => createStyles(colors), [colors]);

    const {
        routePoints,
        galleryItems,
        requiredChecklist,
        recommendedChecklist,
        checklist,
        moderationIssuesByKey,
        qualityScore,
    } = useTravelPublishChecklist(formData);

    const missingRequiredCount = useMemo(
        () => requiredChecklist.filter((item) => !item.ok).length,
        [requiredChecklist],
    );

    const {
        status,
        setStatus,
        currentBackendStatus,
        pendingModeration,
        userPendingModeration,
        missingForModeration,
        rejectionComment,
        setRejectionComment,
        rejectConfirmVisible,
        setRejectConfirmVisible,
        primaryOverrideLabel,
        isSaving,
        scrollRef,
        missingBannerAnchorRef,
        handlePrimaryAction,
        handleApproveModeration,
        handleRejectModeration,
    } = useTravelPublishModeration({
        formData,
        setFormData,
        onManualSave,
        currentStep,
        isSuperAdmin,
        routePoints,
        galleryItems,
        checklist,
    });

    const instagram = useInstagramPublishFlow({ formData, countries });

    const facebook = useFacebookPublishFlow({
        formData,
        galleryItems,
        isSuperAdmin,
        defaultMessage: instagram.editableInstagramCaption,
    });

    const readinessNote = (
        <View style={styles.readinessNote}>
            <Text style={styles.readinessNoteText}>
                {i18nT('travel:components.travel.TravelWizardStepPublish.vy_na_poslednem_shage_mastera_indikator_poka_df37fcf6')}{qualityScore.score}%.
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeContainer}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <TravelWizardHeader
                    canGoBack={true}
                    onBack={onGoBack}
                    title={stepMeta?.title ?? i18nT('travel:components.travel.TravelWizardStepPublish.defaultTitle')}
                    subtitle={stepMeta?.subtitle ?? i18nT('travel:components.travel.TravelWizardStepPublish.defaultSubtitle')}
                    progressPercent={qualityScore.score}
                    errorCount={missingRequiredCount}
                    autosaveBadge={autosaveBadge}
                    onPrimary={handlePrimaryAction}
                    primaryLabel={
                        isSaving
                            ? i18nT('travel:components.travel.TravelWizardStepPublish.sohranenie_6ac62247')
                            : primaryOverrideLabel ??
                              (pendingModeration
                                  ? i18nT('travel:components.travel.TravelWizardStepPublish.otpravleno_na_moderatsiyu_6f9b87dd')
                                  : status === 'draft'
                                  ? i18nT('travel:components.travel.TravelWizardStepPublish.sohranit_chernovik_7d6023b4')
                                  : i18nT('travel:components.travel.TravelWizardStepPublish.otpravit_na_moderatsiyu_55154a94'))
                    }
                    primaryTestID="primary-button"
                    primaryDisabled={pendingModeration || isSaving}
                    tipTitle={stepMeta?.tipTitle}
                    tipBody={stepMeta?.tipBody}
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    onStepSelect={onStepSelect}
                    onPreview={onPreview}
                    onOpenPublic={onOpenPublic}
                    extraBelowProgress={isMobile ? undefined : readinessNote}
                />
                <ScrollView
                    ref={scrollRef}
                    style={styles.content}
                    contentContainerStyle={[styles.contentContainer, { paddingBottom: DESIGN_TOKENS.spacing.xl }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.contentInner}>
                    {isMobile ? readinessNote : null}
                    <PublishStatusSummaryPanel
                        colors={colors}
                        styles={styles}
                        currentBackendStatus={currentBackendStatus}
                        pendingModeration={pendingModeration}
                        userPendingModeration={userPendingModeration}
                        status={status}
                        missingForModeration={missingForModeration}
                        qualityScore={qualityScore}
                        onStatusChange={setStatus}
                        onNavigateToIssue={onNavigateToIssue}
                        missingBannerAnchor={missingBannerAnchorRef}
                    />

                    <PublishChecklistCard
                        colors={colors}
                        styles={styles}
                        checklist={checklist}
                        requiredChecklist={requiredChecklist}
                        recommendedChecklist={recommendedChecklist}
                        moderationIssuesByKey={moderationIssuesByKey}
                        onNavigateToIssue={onNavigateToIssue}
                    />

                    {isSuperAdmin && (pendingModeration || formData.moderation || status === 'moderation') && (
                        <PublishModerationAdminPanel
                            colors={colors}
                            styles={styles}
                            rejectionComment={rejectionComment}
                            onRejectionCommentChange={setRejectionComment}
                            onApprove={() => void handleApproveModeration()}
                            onReject={() => setRejectConfirmVisible(true)}
                        />
                    )}

                    {isSuperAdmin && (
                        <InstagramPublishPanel
                            colors={colors}
                            styles={styles}
                            editableInstagramCaption={instagram.editableInstagramCaption}
                            editableInstagramHashtags={instagram.editableInstagramHashtags}
                            editableInstagramImages={instagram.editableInstagramImages}
                            draggedInstagramImageIndex={instagram.draggedInstagramImageIndex}
                            instagramCaptionLength={instagram.instagramCaptionLength}
                            instagramHashtagCount={instagram.instagramHashtagCount}
                            instagramFinalLength={instagram.instagramFinalLength}
                            isInstagramCaptionTooLong={instagram.isInstagramCaptionTooLong}
                            isInstagramHashtagCountTooHigh={instagram.isInstagramHashtagCountTooHigh}
                            instagramCaptionMaxLength={INSTAGRAM_CAPTION_MAX_LENGTH}
                            instagramHashtagMaxCount={INSTAGRAM_HASHTAG_MAX_COUNT}
                            finalInstagramText={instagram.finalInstagramText}
                            onCaptionChange={instagram.handleInstagramCaptionChange}
                            onHashtagsChange={instagram.handleInstagramHashtagsChange}
                            onMoveImage={instagram.handleMoveInstagramImage}
                            onRemoveImage={instagram.handleRemoveInstagramImage}
                            onDragStart={instagram.handleInstagramDragStart}
                            onDrop={instagram.handleInstagramDrop}
                            onDragEnd={instagram.handleInstagramDragEnd}
                            onCopyText={() => void instagram.handleCopyInstagramText()}
                            onConnect={() => void instagram.handleConnectInstagram()}
                            onPublish={() => void instagram.handlePublishToInstagram()}
                            isConnecting={instagram.isConnectingInstagram}
                            isPublishing={instagram.isPublishingInstagram}
                        />
                    )}

                    {isSuperAdmin && facebook.facebookCapability?.configured && (
                        <FacebookPublishPanel
                            colors={colors}
                            styles={styles}
                            message={facebook.facebookMessage}
                            pageName={facebook.facebookCapability.pageName}
                            connected={facebook.facebookCapability.connected}
                            canPublish={facebook.facebookCapability.canPublish}
                            state={facebook.facebookState}
                            postUrl={facebook.facebookPostUrl}
                            photoOptions={facebook.facebookPhotoOptions}
                            selectedPhotoIds={facebook.facebookSelectedPhotoIds}
                            maxPhotoCount={facebook.facebookPhotoMaxCount}
                            onMessageChange={facebook.handleFacebookMessageChange}
                            onTogglePhoto={facebook.handleToggleFacebookPhoto}
                            onConnect={() => void facebook.handleConnectFacebook()}
                            onPublish={() => void facebook.handlePublishToFacebook()}
                            onOpenPost={() => void facebook.handleOpenFacebookPost()}
                        />
                    )}
                    </View>
                </ScrollView>

                <ConfirmDialog
                    visible={rejectConfirmVisible}
                    onClose={() => setRejectConfirmVisible(false)}
                    onConfirm={() => {
                        setRejectConfirmVisible(false);
                        void handleRejectModeration();
                    }}
                    title={i18nT('travel:components.travel.TravelWizardStepPublish.otklonit_moderatsiyu_27e138a4')}
                    message={
                        rejectionComment.trim()
                            ? i18nT('travel:components.travel.TravelWizardStepPublish.puteshestvie_vernetsya_v_chernoviki_avtor_po_7e1bc9af')
                            : i18nT('travel:components.travel.TravelWizardStepPublish.puteshestvie_vernetsya_v_chernoviki_i_budet__d9185285')
                    }
                    confirmText={i18nT('travel:components.travel.TravelWizardStepPublish.otklonit_a76b58b3')}
                    cancelText={i18nT('travel:components.travel.TravelWizardStepPublish.otmena_1fdffdc8')}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default React.memo(TravelWizardStepPublish);
