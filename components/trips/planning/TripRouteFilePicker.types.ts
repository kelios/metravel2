export type PickedTripRouteFile = {
  name: string;
  size: number | null;
  text: string;
};

export type TripRouteFilePickerError = 'tooLarge' | 'read';

export type TripRouteFilePickerProps = {
  label: string;
  maxBytes: number;
  disabled?: boolean;
  loading?: boolean;
  onPicked: (file: PickedTripRouteFile) => void;
  onError: (error: TripRouteFilePickerError) => void;
  onBusyChange?: (busy: boolean) => void;
  testID?: string;
};
