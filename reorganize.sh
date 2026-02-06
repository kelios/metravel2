#!/bin/bash
set -e

cd /Users/juliasavran/Sites/metravel2/metravel2

# layout/
git mv components/AccountMenu.tsx components/layout/
git mv components/BottomDock.tsx components/layout/
git mv components/ConsentBanner.tsx components/layout/
git mv components/CustomHeader.tsx components/layout/
git mv components/CustomHeaderMobileMenu.tsx components/layout/
git mv components/Footer.tsx components/layout/
git mv components/FooterDesktop.tsx components/layout/
git mv components/HeaderContextBar.tsx components/layout/
git mv components/KeyboardShortcutsHelp.tsx components/layout/
git mv components/Logo.tsx components/layout/
git mv components/MainHubLayout.tsx components/layout/
git mv components/ReadingProgressBar.tsx components/layout/
git mv components/RenderRightMenu.tsx components/layout/
git mv components/ScrollToTopButton.tsx components/layout/
git mv components/SkipLinks.tsx components/layout/
git mv components/ThemeToggle.tsx components/layout/
git mv components/WebVitalsMonitor.tsx components/layout/
echo "layout done"

# ui/
git mv components/AnimatedCard.tsx components/ui/
git mv components/CollapsibleBlock.tsx components/ui/
git mv components/ConfirmDialog.tsx components/ui/
git mv components/EditScreenInfo.tsx components/ui/
git mv components/EmptyState.tsx components/ui/
git mv components/ErrorBoundary.tsx components/ui/
git mv components/ErrorDisplay.tsx components/ui/
git mv components/ExternalLink.tsx components/ui/
git mv components/NetworkStatus.tsx components/ui/
git mv components/NetworkStatus.web.tsx components/ui/
git mv components/PaginationComponent.tsx components/ui/
git mv components/ProgressIndicator.tsx components/ui/
git mv components/ReservedSpace.tsx components/ui/
git mv components/SafeHtml.tsx components/ui/
git mv components/SectionSkeleton.tsx components/ui/
git mv components/SkeletonLoader.tsx components/ui/
git mv components/StyledText.tsx components/ui/
git mv components/Themed.tsx components/ui/
git mv components/ThemedPaperProvider.native.tsx components/ui/
git mv components/ThemedPaperProvider.web.tsx components/ui/
git mv components/ToastHost.tsx components/ui/
git mv components/ToastHost.web.tsx components/ui/
echo "ui done"

# forms/
mkdir -p components/forms
git mv components/CheckboxComponent.tsx components/forms/
git mv components/CustomImageRenderer.tsx components/forms/
git mv components/FormFieldWithValidation.tsx components/forms/
git mv components/ForgotPasswordLink.tsx components/forms/
git mv components/MultiSelectField.tsx components/forms/
git mv components/NumberInputComponent.tsx components/forms/
git mv components/PasswordStrengthIndicator.tsx components/forms/
git mv components/QuillEditor.web.tsx components/forms/
git mv components/SearchAutocomplete.tsx components/forms/
git mv components/SelectComponent.tsx components/forms/
git mv components/SimpleMultiSelect.tsx components/forms/
git mv components/TextInputComponent.tsx components/forms/
echo "forms done"

# article/
mkdir -p components/article
git mv components/ArticleEditor.android.tsx components/article/
git mv components/ArticleEditor.ios.tsx components/article/
git mv components/ArticleEditor.tsx components/article/
git mv components/ArticleEditor.web.tsx components/article/
git mv components/ArticleListItem.tsx components/article/
echo "article done"

# home/
git mv components/PersonalizedRecommendations.tsx components/home/
git mv components/RecentViews.tsx components/home/
git mv components/WeeklyHighlights.tsx components/home/
git mv components/WelcomeBanner.tsx components/home/
echo "home done"

# listTravel/
git mv components/CategoryChips.tsx components/listTravel/
git mv components/FiltersPanelCollapsible.tsx components/listTravel/
git mv components/SortSelector.tsx components/listTravel/
echo "listTravel done"

# travel/
git mv components/FavoriteButton.tsx components/travel/
git mv components/OptimizedFavoriteButton.tsx components/travel/
git mv components/TravelCardCompact.tsx components/travel/
git mv components/WeatherWidget.tsx components/travel/
git mv components/WeatherWidget.web.css components/travel/
git mv components/YoutubeLinkComponent.tsx components/travel/
echo "travel done"

# Map/ (top-level Map components, not MapPage)
mkdir -p components/Map
git mv components/Map.android.tsx components/Map/Map.android.tsx
git mv components/Map.ios.tsx components/Map/Map.ios.tsx
git mv components/Map.tsx components/Map/Map.tsx
git mv components/Map.web.tsx components/Map/Map.web.tsx
git mv components/MapUploadComponent.android.tsx components/Map/
git mv components/MapUploadComponent.ios.tsx components/Map/
git mv components/MapUploadComponent.web.tsx components/Map/
git mv components/MarkersListComponent.tsx components/Map/
echo "Map done"

echo "ALL MOVES COMPLETE"
