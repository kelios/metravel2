import { Platform } from 'react-native';

import AppleSignInButtonNative from './AppleSignInButton.native';
import AppleSignInButtonWeb from './AppleSignInButton.web';
import type { AppleSignInButtonProps } from '@/components/auth/appleSignInTypes';

/**
 * IOS-05: Sign in with Apple — platform router.
 *
 * Как и у `GoogleSignInButton`, этот файл в рантайме не резолвится: Metro берёт
 * `.web.tsx` на вебе и `.native.tsx` на нативе, Jest по голому специфаеру берёт
 * `.native.tsx`, tsc — `.web.tsx` через `moduleSuffixes`. Он существует только
 * как безрасширенный хвост этой цепочки и обязан оставаться тонким делегатом,
 * иначе вторая копия реализации разъезжается с настоящей.
 */
export default function AppleSignInButton(props: AppleSignInButtonProps) {
    if (Platform.OS === 'web') {
        return <AppleSignInButtonWeb {...props} />;
    }

    return <AppleSignInButtonNative {...props} />;
}
