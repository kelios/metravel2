import type React from 'react'
import type { TextInput, View } from 'react-native'

import type { TravelFilters } from '@/hooks/useTravelFilters'
import type { MarkerData, TravelFormData } from '@/types/types'

import type { Styles } from './styles'

export interface StepMeta {
  title?: string;
  subtitle?: string;
  tipTitle?: string;
  tipBody?: string;
  nextLabel?: string;
}

export interface TravelWizardStepRouteProps {
  currentStep: number;
  totalSteps: number;
  formData: TravelFormData;
  markers: MarkerData[];
  setMarkers: (data: MarkerData[]) => void;
  categoryTravelAddress: TravelFilters['categoryTravelAddress'];
  countries: TravelFilters['countries'];
  travelId?: string | null;
  selectedCountryIds: string[];
  onCountrySelect: (countryId: string) => void;
  onCountryDeselect: (countryId: string) => void;
  onBack: () => void;
  onNext: () => void;
  onManualSave?: (dataOverride?: TravelFormData) => Promise<TravelFormData | void>;
  isFiltersLoading?: boolean;
  stepMeta?: StepMeta;
  progress?: number;
  autosaveBadge?: string;
  isSaveInFlight?: boolean;
  focusAnchorId?: string | null;
  onAnchorHandled?: () => void;
  onStepSelect?: (step: number) => void;
  onPreview?: () => void;
  onOpenPublic?: () => void;
}

export interface ManualPointState {
  coords: string;
  lat: string;
  lng: string;
  photoPreviewUrl: string | null;
}

export interface ManualPointPanelProps {
  isVisible: boolean;
  state: ManualPointState;
  styles: Styles;
  fileInputRef: React.RefObject<any>;
  panelRef?: React.RefObject<View | null>;
  coordsInputRef?: React.RefObject<TextInput | null>;
  onToggle: () => void;
  onPhotoPick: () => void;
  onPhotoSelected: (event: any) => void;
  onClearPhoto: () => void;
  onCoordsChange: (value: string) => void;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  onLatSignToggle: () => void;
  onLngSignToggle: () => void;
  onAdd: () => void;
  onCancel: () => void;
}

export interface CountriesFieldProps {
  countries: TravelFilters['countries'];
  isFiltersLoading?: boolean;
  selectedCountryIds: string[];
  styles: Styles;
}

export interface RouteMapCardProps {
  categoryTravelAddress: TravelFilters['categoryTravelAddress'];
  countries: TravelFilters['countries'];
  markers: MarkerData[];
  styles: Styles;
  isCompactLayout: boolean;
  anchorRef: React.RefObject<View | null>;
  onMarkersChange: (markers: MarkerData[]) => void;
  onCountrySelect: (countryId: string) => void;
  onCountryDeselect: (countryId: string) => void;
  onPhotoMarkerReady: (payload: { markers: MarkerData[]; derivedCountryId: number | null }) => void;
  onMarkerEditSave: (markers: MarkerData[]) => void;
  onMarkerAdded: (payload: { markers: MarkerData[]; derivedCountryId: number | null }) => void;
}
