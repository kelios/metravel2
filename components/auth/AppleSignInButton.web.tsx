import type { AppleSignInButtonProps } from '@/components/auth/appleSignInTypes';

/**
 * IOS-05: Sign in with Apple раскатан только на нативную поверхность.
 *
 * Web-вход через Apple — отдельный контракт (Apple JS SDK + `redirect_uri`,
 * другой audience на сервере), поэтому здесь возвращаем `null` и НЕ тянем
 * `expo-apple-authentication` в web-бандл: `LoginForm`/`RegistrationForm`
 * лежат на критическом пути главной, лишний нативный модуль там — регресс веса.
 */
export default function AppleSignInButton(_props: AppleSignInButtonProps) {
    return null;
}
