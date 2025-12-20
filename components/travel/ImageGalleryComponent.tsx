import { Platform } from 'react-native';

// Platform resolver for TS tooling/IDE. Runtime will pick the platform file.
 
const Component =
    Platform.OS === 'web'
        ? require('./ImageGalleryComponent.web').default
        : Platform.OS === 'ios'
        ? require('./ImageGalleryComponent.ios').default
        : require('./ImageGalleryComponent.android').default;

export default Component;
