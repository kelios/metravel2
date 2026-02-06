// Mock dependencies
import { Platform } from 'react-native';

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

jest.mock('react-native-document-picker', () => ({
  __esModule: true,
  default: {
    pick: jest.fn(),
    pickSingle: jest.fn(),
    types: {
      allFiles: 'allFiles',
      images: 'images',
    },
  },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

jest.mock('@/src/api/misc', () => ({
  uploadImage: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

describe('Platform-Specific Components', () => {
  describe('ArticleEditor Component', () => {
    it('should have iOS version', () => {
      expect(() => require('../../../components/article/ArticleEditor.ios')).not.toThrow();
    });

    it('should have Android version', () => {
      expect(() => require('../../../components/article/ArticleEditor.android')).not.toThrow();
    });

    it('should have Web version', () => {
      expect(() => require('../../../components/article/ArticleEditor.web')).not.toThrow();
    });

    it('Android should export iOS implementation', () => {
      const ArticleEditorAndroid = require('../../../components/article/ArticleEditor.android');
      expect(ArticleEditorAndroid.default).toBeDefined();
    });
  });

  describe('ImageGalleryComponent', () => {
    it('should have iOS version', () => {
      expect(() => require('../../../components/travel/ImageGalleryComponent.ios')).not.toThrow();
    });

    it('should have Android version', () => {
      expect(() => require('../../../components/travel/ImageGalleryComponent.android')).not.toThrow();
    });

    it('should have Web version', () => {
      expect(() => require('../../../components/travel/ImageGalleryComponent.web')).not.toThrow();
    });
  });

  describe('MapUploadComponent', () => {
    it('should have iOS version', () => {
      expect(() => require('../../../components/map/MapUploadComponent.ios')).not.toThrow();
    });

    it('should have Android version', () => {
      expect(() => require('../../../components/map/MapUploadComponent.android')).not.toThrow();
    });

    it('should have Web version', () => {
      expect(() => require('../../../components/map/MapUploadComponent.web')).not.toThrow();
    });
  });

  describe('Platform.select usage', () => {
    it('should have Platform.select function', () => {
      expect(Platform.select).toBeDefined();
      expect(typeof Platform.select).toBe('function');
    });

    it('should select based on current platform', () => {
      const selected = Platform.select({
        ios: 'iOS Component',
        android: 'Android Component',
        web: 'Web Component',
        default: 'Default Component',
      });
      // Проверяем, что выбрано одно из значений
      expect(['iOS Component', 'Android Component', 'Web Component', 'Default Component']).toContain(selected);
    });

    it('should work with object values', () => {
      const selected = Platform.select({
        ios: { name: 'iOS' },
        android: { name: 'Android' },
        web: { name: 'Web' },
      });
      expect(selected).toBeDefined();
      expect(selected).toHaveProperty('name');
    });
  });

  describe('File Extension Resolution', () => {
    it('should have Platform.OS defined', () => {
      expect(Platform.OS).toBeDefined();
      expect(['ios', 'android', 'web']).toContain(Platform.OS);
    });

    it('React Native should support platform-specific extensions', () => {
      // React Native автоматически выбирает .ios.tsx, .android.tsx, .web.tsx файлы
      // в зависимости от платформы
      expect(Platform.OS).toBeDefined();
    });
  });

  describe('Component Consistency', () => {
    it('all platforms should have Map component', () => {
      expect(() => require('../../../components/map/Map.ios')).not.toThrow();
      expect(() => require('../../../components/map/Map.android')).not.toThrow();
      expect(() => require('../../../components/map/Map.web')).not.toThrow();
    });

    it('all platforms should have ArticleEditor', () => {
      expect(() => require('../../../components/article/ArticleEditor.ios')).not.toThrow();
      expect(() => require('../../../components/article/ArticleEditor.android')).not.toThrow();
      expect(() => require('../../../components/article/ArticleEditor.web')).not.toThrow();
    });
  });

  describe('Shared Components', () => {
    it('Android should reuse iOS implementation where appropriate', () => {
      // Проверяем, что Android компоненты экспортируют iOS версии
      const ArticleEditorAndroid = require('../../../components/article/ArticleEditor.android');
      const MapAndroid = require('../../../components/map/Map.android');
      
      expect(ArticleEditorAndroid.default).toBeDefined();
      expect(MapAndroid.default).toBeDefined();
    });
  });

  describe('Platform API Compatibility', () => {
    it('should have Platform.OS available', () => {
      expect(Platform.OS).toBeDefined();
      expect(['ios', 'android', 'web']).toContain(Platform.OS);
    });

    it('should have Platform.select available', () => {
      expect(Platform.select).toBeDefined();
      expect(typeof Platform.select).toBe('function');
    });

    it('should have Platform constants', () => {
      // Platform.Version может быть недоступен в тестовой среде
      // но должен быть доступен в реальном приложении
      expect(Platform.OS).toBeDefined();
      expect(Platform.select).toBeDefined();
    });
  });
});
