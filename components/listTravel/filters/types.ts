export interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

export interface FilterGroup {
  key: string;
  title: string;
  options: FilterOption[];
  multiSelect?: boolean;
  icon?: string;
}

export type FilterState = Record<string, string[]> & {
  year?: string | number;
  moderation?: number;
  draftsOnly?: boolean;
};
