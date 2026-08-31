/**
 * Пикер фото отзыва: предел трёх файлов и удаление выбранного (#1579).
 */

import { useState } from 'react'
import { Platform } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

import QuestReviewPhotoPicker, {
  type QuestReviewPhotoDraft,
} from '@/components/quests/QuestReviewPhotoPicker'

const mockLaunchLibrary = jest.fn()
const mockRequestMediaPermissions = jest.fn()
const mockRequestCameraPermissions = jest.fn()
const mockCompressTravelPhoto = jest.fn(async (uri: string) => ({
  uri,
  width: 100,
  height: 100,
}))

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchLibrary(...args),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestMediaPermissions(...args),
  requestCameraPermissionsAsync: (...args: unknown[]) => mockRequestCameraPermissions(...args),
}))

jest.mock('@/utils/imageCompressor', () => ({
  compressTravelPhoto: (...args: unknown[]) => mockCompressTravelPhoto(...(args as [string])),
}))

// `ImageCardMedia` до загрузки рисует только плейсхолдер, поэтому пропы слота
// проверяются на самом примитиве.
jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: any) => <View testID={props.testID || 'image-card-media'} {...props} />,
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
    backgroundSecondary: '#f3f4f6',
    borderLight: '#e5e7eb',
    primary: '#2563eb',
    primaryText: '#1d4ed8',
    textOnPrimary: '#ffffff',
    danger: '#dc2626',
  }),
}))

const asset = (name: string) => ({ uri: `file:///${name}`, fileName: name, mimeType: 'image/jpeg' })

function Host({ initial = [] as QuestReviewPhotoDraft[] }) {
  const [value, setValue] = useState<QuestReviewPhotoDraft[]>(initial)
  return <QuestReviewPhotoPicker value={value} onChange={setValue} />
}

describe('QuestReviewPhotoPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCompressTravelPhoto.mockImplementation(async (uri: string) => ({
      uri,
      width: 100,
      height: 100,
    }))
    mockRequestMediaPermissions.mockResolvedValue({ status: 'granted' })
    mockRequestCameraPermissions.mockResolvedValue({ status: 'granted' })
  })

  it('keeps three photos and refuses the fourth with a readable message', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [asset('a.jpg'), asset('b.jpg'), asset('c.jpg'), asset('d.jpg')],
    })

    const view = render(<Host />)
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))

    await waitFor(() =>
      expect(view.getByTestId('quest-review-photo-picker-counter')).toHaveTextContent(
        'Выбрано 3 из 3',
      ),
    )
    // Лишний файл не проглатывается молча: отказ объявлен текстом.
    expect(view.getByTestId('quest-review-photo-picker-error')).toHaveTextContent(
      'Больше 3 фото приложить нельзя.',
    )
    expect(view.getByTestId('quest-review-photo-picker-thumbs').children).toHaveLength(3)
  })

  it('asks the picker for only the remaining slots', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset('a.jpg')] })

    const view = render(<Host />)
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))
    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalledTimes(1))
    expect(mockLaunchLibrary.mock.calls[0][0]).toMatchObject({ selectionLimit: 3 })

    mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset('b.jpg')] })
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))
    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalledTimes(2))
    expect(mockLaunchLibrary.mock.calls[1][0]).toMatchObject({ selectionLimit: 2 })
  })

  it('leaves the selection untouched when the player cancels the picker', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset('a.jpg')] })
    const view = render(<Host />)
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))
    await waitFor(() =>
      expect(view.getByTestId('quest-review-photo-picker-counter')).toHaveTextContent(
        'Выбрано 1 из 3',
      ),
    )

    mockLaunchLibrary.mockResolvedValueOnce({ canceled: true, assets: [] })
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))

    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalledTimes(2))
    expect(view.getByTestId('quest-review-photo-picker-counter')).toHaveTextContent(
      'Выбрано 1 из 3',
    )
    expect(view.queryByTestId('quest-review-photo-picker-error')).toBeNull()
  })

  it('explains a denied gallery permission instead of failing silently', async () => {
    mockRequestMediaPermissions.mockResolvedValueOnce({ status: 'denied' })

    const view = render(<Host />)
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))

    await waitFor(() =>
      expect(view.getByTestId('quest-review-photo-picker-error')).toHaveTextContent(
        'Нет доступа к галерее. Разрешите его в настройках устройства.',
      ),
    )
    expect(mockLaunchLibrary).not.toHaveBeenCalled()
  })

  it('opens the Android gallery without asking for a permission the build blocks', async () => {
    // READ_MEDIA_IMAGES снят на уровне сборки (`app.json` → blockedPermissions,
    // `AndroidManifest.xml` → tools:node="remove"), поэтому запрос разрешения на
    // Android не может быть удовлетворён: гейт по его статусу закрыл бы галерею
    // навсегда. Выбор идёт через системный Photo Picker — без разрешения.
    const original = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    try {
      mockRequestMediaPermissions.mockResolvedValue({ status: 'denied', granted: false })
      mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset('a.jpg')] })

      const view = render(<Host />)
      fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))

      await waitFor(() =>
        expect(view.getByTestId('quest-review-photo-picker-counter')).toHaveTextContent(
          'Выбрано 1 из 3',
        ),
      )
      expect(mockRequestMediaPermissions).not.toHaveBeenCalled()
      expect(view.queryByTestId('quest-review-photo-picker-error')).toBeNull()
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true })
    }
  })

  it('takes the real File on web and refuses a picker result without one', async () => {
    // На web RN-дескриптор {uri,name,type} FormData сериализует в строку
    // "[object Object]", и сервер отвечает 400 — поэтому нужен настоящий File
    // из asset.file (ловушка из hooks/useAvatarUpload.ts:188).
    const original = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
      mockLaunchLibrary.mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'blob:web', fileName: 'no-file.jpg', mimeType: 'image/jpeg' }],
      })
      const view = render(<Host />)
      fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))

      await waitFor(() =>
        expect(view.getByTestId('quest-review-photo-picker-error')).toHaveTextContent(
          'Не удалось прочитать файл изображения.',
        ),
      )
      expect(view.getByTestId('quest-review-photo-picker-counter')).toHaveTextContent(
        'Выбрано 0 из 3',
      )
      // Разрешения на web не запрашиваются: их там нет.
      expect(mockRequestMediaPermissions).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true })
    }
  })

  it('renders the preview through the shared media primitive with contain', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset('a.jpg')] })

    const view = render(<Host />)
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))

    const preview = await view.findByTestId(/quest-review-photo-picker-preview-/)
    // Локальный URI прокси не переписывает (utils/imageProxy.ts:228,258),
    // а `contain` — инвариант docs/RULES.md → Images and placeholders.
    expect(preview.props.src).toBe('file:///a.jpg')
    expect(preview.props.fit).toBe('contain')
    expect(preview.props.alt).toBe('a.jpg')
  })

  it('describes the compressed JPEG instead of the original iOS PNG', async () => {
    mockCompressTravelPhoto.mockResolvedValueOnce({
      uri: 'file:///cache/ImageManipulator/converted.jpg',
      width: 100,
      height: 100,
    })
    mockLaunchLibrary.mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///IMG_0106.png',
          fileName: 'IMG_0106.png',
          mimeType: 'image/png',
        },
      ],
    })
    const onChange = jest.fn()

    const view = render(<QuestReviewPhotoPicker value={[]} onChange={onChange} />)
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange.mock.calls[0][0][0]).toMatchObject({
      name: 'IMG_0106.png',
      previewUri: 'file:///cache/ImageManipulator/converted.jpg',
      file: {
        uri: 'file:///cache/ImageManipulator/converted.jpg',
        name: 'IMG_0106.jpg',
        type: 'image/jpeg',
      },
    })
  })

  it('removes a selected photo', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: false, assets: [asset('a.jpg')] })
    const view = render(<Host />)
    fireEvent.press(view.getByTestId('quest-review-photo-picker-add'))

    await waitFor(() =>
      expect(view.getByTestId('quest-review-photo-picker-counter')).toHaveTextContent(
        'Выбрано 1 из 3',
      ),
    )

    fireEvent.press(view.getByLabelText('Убрать фото a.jpg'))
    expect(view.getByTestId('quest-review-photo-picker-counter')).toHaveTextContent(
      'Выбрано 0 из 3',
    )
  })
})
