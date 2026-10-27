export interface GalleryItem {
  id: string
  stableKey?: string
  url: string
  caption?: string
  isUploading?: boolean
  uploadProgress?: number
  error?: string | null
  hasLoaded?: boolean
}

export interface GalleryValueItem {
  id?: string | number
  url: string
  caption?: string
}

export interface ImageGalleryComponentProps {
  collection: string
  idTravel: string
  initialImages: GalleryItem[]
  maxImages?: number
  onChange?: (items: GalleryValueItem[]) => void
  /**
   * Пока у записи нет id, галерея всё равно принимает файлы и перед первой
   * загрузкой просит id у владельца формы (#2666: заметка создаёт черновик
   * только когда автор выбрал фото). `null` — черновик создать не удалось.
   */
  resolveTravelId?: () => Promise<string | null>
}
