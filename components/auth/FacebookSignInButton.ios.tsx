import type { FacebookSignInButtonProps } from '@/components/auth/facebookLoginTypes'

/**
 * Facebook Login не входит в iPhone-сборку (#1895): `react-native-fbsdk-next`
 * исключён из iOS-autolinking в `package.json` → `expo.autolinking.ios.exclude`,
 * а Info.plist не содержит Facebook-ключей. Metro резолвит этот файл раньше
 * `.native.tsx`, поэтому iOS-бандл не тянет JS Meta SDK, а privacy manifest
 * приложения (tracking=false) совпадает с фактическим составом IPA. Android и
 * web остаются на своих реализациях за гейтом `EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED`.
 */
export default function FacebookSignInButton(_props: FacebookSignInButtonProps) {
  return null
}
