export interface GalleryItem {
  id: string
  stableKey?: string
  url: string
  isUploading?: boolean
  uploadProgress?: number
  error?: string | null
  hasLoaded?: boolean
}

export interface GalleryValueItem {
  id?: string | number
  url: string
}

export interface ImageGalleryComponentProps {
  collection: string
  idTravel: string
  initialImages: GalleryItem[]
  maxImages?: number
  onChange?: (items: GalleryValueItem[]) => void
}
