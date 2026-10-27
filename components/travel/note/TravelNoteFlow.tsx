import React, { useMemo } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';

import { asBottomDimension, useScrollBottomPadding } from '@/components/layout/bottomChromeInset';
import GallerySection from '@/components/travel/GallerySection';
import LocationSearchInput from '@/components/travel/LocationSearchInput';
import TravelWizardHeader from '@/components/travel/TravelWizardHeader';
import WizardStepFooter from '@/components/travel/upsert/WizardStepFooter';
import { WIZARD_KEYBOARD_BEHAVIOR } from '@/components/travel/upsert/wizardKeyboard';
import type { UpsertTravelController } from '@/components/travel/upsert/useUpsertTravelController';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { translate as i18nT, translatePlural } from '@/i18n';
import type { ModerationIssue } from '@/utils/formValidation';
import {
  NOTE_MAX_PHOTOS,
  NOTE_MIN_TEXT_LENGTH,
  NOTE_PHOTOS_STEP,
  NOTE_STORY_STEP,
  NOTE_TOTAL_STEPS,
  getNoteTextLength,
} from '@/utils/travelNote';

import { useTravelNoteFlow, type NotePlace } from './useTravelNoteFlow';

type Colors = UpsertTravelController['colors'];
type Styles = ReturnType<typeof createStyles>;

interface TravelNoteFlowProps {
  controller: UpsertTravelController;
}

const IssuesBanner = ({ issues, styles, colors, onOpenStep }: {
  issues: ModerationIssue[];
  styles: Styles;
  colors: Colors;
  onOpenStep: (step: number) => void;
}) => (
  <View style={styles.issues} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="travel-note.issues">
    <Text style={styles.issuesTitle}>{i18nT('travel:components.travel.note.issues.title')}</Text>
    {issues.map((issue) => (
      <View key={issue.key} style={styles.issueRow}>
        <Feather name="alert-circle" size={16} color={colors.danger} />
        <Text style={styles.issueText}>{issue.label}</Text>
        {issue.targetStep === NOTE_PHOTOS_STEP ? (
          <Button
            label={i18nT('travel:components.travel.note.issues.openPhotos')}
            variant="ghost"
            size="sm"
            onPress={() => onOpenStep(NOTE_PHOTOS_STEP)}
          />
        ) : null}
      </View>
    ))}
  </View>
);

const PlaceSummary = ({ place, styles, colors }: { place: NotePlace; styles: Styles; colors: Colors }) => (
  <View style={styles.placeCard} testID="travel-note.place">
    <Feather name="map-pin" size={18} color={colors.primary} />
    <View style={styles.placeBody}>
      <Text style={styles.placeAddress}>{place.address}</Text>
      {place.countryLabel ? (
        <Text style={styles.placeCountry}>
          {i18nT('travel:components.travel.note.place.country', { value1: place.countryLabel })}
        </Text>
      ) : null}
    </View>
  </View>
);

const SubmittedScreen = ({ styles, colors, onOpenTravels }: {
  styles: Styles;
  colors: Colors;
  onOpenTravels: () => void;
}) => (
  <View style={styles.submitted} testID="travel-note.submitted">
    <Feather name="check-circle" size={48} color={colors.success} />
    <Text style={styles.submittedTitle} accessibilityRole="header">
      {i18nT('travel:components.travel.note.submitted.title')}
    </Text>
    <Text style={styles.submittedText}>{i18nT('travel:components.travel.note.submitted.text')}</Text>
    <Button
      label={i18nT('travel:components.travel.note.submitted.openTravels')}
      onPress={onOpenTravels}
      testID="travel-note.open-travels"
    />
  </View>
);

/**
 * Короткая заметка о поездке (#2666): экран «Фото» и экран «Место и рассказ».
 * Работает поверх того же контроллера, что и полный мастер.
 */
export default function TravelNoteFlow({ controller }: TravelNoteFlowProps) {
  const router = useRouter();
  const { colors, wizard, formData } = controller;
  const { isMobile } = useResponsive();
  const styles = useMemo(() => createStyles(colors, isMobile), [colors, isMobile]);
  const contentBottomPadding = useScrollBottomPadding(DESIGN_TOKENS.spacing.xl);
  const note = useTravelNoteFlow(controller);
  const isStoryStep = note.step === NOTE_STORY_STEP;
  const storyLength = getNoteTextLength(formData.description);
  const missingChars = Math.max(0, NOTE_MIN_TEXT_LENGTH - storyLength);

  if (note.submittedId) {
    return (
      <SafeAreaView style={styles.safeContainer} edges={['left', 'right', 'bottom']}>
        <SubmittedScreen styles={styles} colors={colors} onOpenTravels={() => router.replace('/metravel')} />
      </SafeAreaView>
    );
  }

  const onBack = isStoryStep ? wizard.handleBack : wizard.handleExit;
  const onPrimary = isStoryStep ? note.handleSubmit : wizard.handleNext;
  const primaryLabel = isStoryStep
    ? i18nT('travel:components.travel.note.submit')
    : i18nT('travel:components.travel.note.next');

  return (
    <SafeAreaView style={styles.safeContainer} edges={['left', 'right', 'bottom']} testID="travel-note.root">
      <KeyboardAvoidingView style={styles.flex} behavior={WIZARD_KEYBOARD_BEHAVIOR} keyboardVerticalOffset={0}>
        <TravelWizardHeader
          canGoBack
          onBack={onBack}
          title={isStoryStep
            ? i18nT('travel:components.travel.note.story.title')
            : i18nT('travel:components.travel.note.photos.title')}
          subtitle={i18nT('travel:common.stepProgress', { value1: note.step, value2: NOTE_TOTAL_STEPS })}
          progressPercent={Math.round((note.step / NOTE_TOTAL_STEPS) * 100)}
          errorCount={note.issues.length}
          autosaveBadge={controller.autosaveBadge}
          isSaveInFlight={controller.isManualSaveInFlight || note.isSubmitting}
          onPrimary={onPrimary}
          primaryLabel={primaryLabel}
          primaryDisabled={note.isSubmitting}
          primaryTestID={isStoryStep ? 'travel-note.submit' : 'travel-note.next'}
          onSave={controller.handleManualSave}
          currentStep={note.step}
          totalSteps={NOTE_TOTAL_STEPS}
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: asBottomDimension(contentBottomPadding) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inner}>
            {note.issues.length > 0 ? (
              <IssuesBanner issues={note.issues} styles={styles} colors={colors} onOpenStep={wizard.handleStepSelect} />
            ) : null}

            {isStoryStep ? (
              <>
                <View style={[styles.section, styles.placeSection]}>
                  <Text style={styles.sectionTitle}>{i18nT('travel:components.travel.note.place.title')}</Text>
                  <Text style={styles.sectionHint}>{i18nT('travel:components.travel.note.place.hint')}</Text>
                  <LocationSearchInput
                    onLocationSelect={note.handlePlaceSelect}
                    placeholder={i18nT('travel:components.travel.note.place.placeholder')}
                  />
                  {note.placeError ? (
                    <Text style={styles.errorText} accessibilityRole="alert">{note.placeError}</Text>
                  ) : null}
                  {note.place ? <PlaceSummary place={note.place} styles={styles} colors={colors} /> : null}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle} nativeID="travel-note-name-label">
                    {i18nT('travel:components.travel.note.name.title')}
                  </Text>
                  <Text style={styles.sectionHint}>{i18nT('travel:components.travel.note.name.hint')}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.name ?? ''}
                    onChangeText={note.handleNameChange}
                    placeholder={i18nT('travel:components.travel.note.name.placeholder')}
                    placeholderTextColor={colors.textMuted}
                    maxLength={200}
                    accessibilityLabel={i18nT('travel:components.travel.note.name.title')}
                    accessibilityLabelledBy="travel-note-name-label"
                    testID="travel-note.name"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle} nativeID="travel-note-story-label">
                    {i18nT('travel:components.travel.note.story.label')}
                  </Text>
                  <Text style={styles.sectionHint}>{i18nT('travel:components.travel.note.story.hint')}</Text>
                  <TextInput
                    style={[styles.input, styles.storyInput]}
                    value={note.storyText}
                    onChangeText={note.handleStoryChange}
                    placeholder={i18nT('travel:components.travel.note.story.placeholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    accessibilityLabel={i18nT('travel:components.travel.note.story.label')}
                    accessibilityLabelledBy="travel-note-story-label"
                    testID="travel-note.story"
                  />
                  <Text
                    style={[styles.counter, missingChars === 0 && styles.counterDone]}
                    accessibilityLiveRegion="polite"
                    testID="travel-note.story-counter"
                  >
                    {missingChars > 0
                      ? translatePlural('travel:components.travel.note.story.missing', missingChars, { value1: missingChars })
                      : i18nT('travel:components.travel.note.story.enough')}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{i18nT('travel:components.travel.note.photos.sectionTitle')}</Text>
                <Text style={styles.sectionHint}>
                  {i18nT('travel:components.travel.note.photos.hint', { value1: NOTE_MAX_PHOTOS })}
                </Text>
                <GallerySection
                  images={formData.gallery}
                  travelId={formData.id}
                  onChange={note.handleGalleryChange}
                  resolveTravelId={note.ensureTravelId}
                  maxImages={NOTE_MAX_PHOTOS}
                />
              </View>
            )}
          </View>
        </ScrollView>

        <WizardStepFooter
          onBack={onBack}
          onPrimary={onPrimary}
          primaryLabel={primaryLabel}
          primaryDisabled={note.isSubmitting}
          primaryTestID={isStoryStep ? 'travel-note.footer-submit' : 'travel-note.footer-next'}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: Colors, isMobile: boolean) => StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: isMobile ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.lg,
    paddingTop: DESIGN_TOKENS.spacing.sm,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 720,
    gap: isMobile ? DESIGN_TOKENS.spacing.sm : DESIGN_TOKENS.spacing.md,
  },
  section: {
    padding: isMobile ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Выпадающий список поиска места ложится поверх следующих карточек.
  placeSection: {
    zIndex: 2,
  },
  sectionTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xxs,
  },
  sectionHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  input: {
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  storyInput: {
    minHeight: 160,
  },
  counter: {
    marginTop: DESIGN_TOKENS.spacing.xs,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  counterDone: {
    color: colors.success,
  },
  errorText: {
    marginTop: DESIGN_TOKENS.spacing.xs,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.danger,
  },
  placeCard: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.primarySoft,
  },
  placeBody: {
    flex: 1,
  },
  placeAddress: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  placeCountry: {
    marginTop: 2,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  issues: {
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.dangerSoft,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  issuesTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  issueText: {
    flexShrink: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
  },
  submitted: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    padding: DESIGN_TOKENS.spacing.xl,
    gap: DESIGN_TOKENS.spacing.md,
  },
  submittedTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  submittedText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
});
