import { Platform } from 'react-native';

import GoogleSignInButtonNative from './GoogleSignInButton.native';
import GoogleSignInButtonWeb from './GoogleSignInButton.web';

interface GoogleSignInButtonProps {
    onSuccess: (credential: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
}

/**
 * AND-03: Google Sign-In button — platform router.
 *
 * Nothing resolves this file in practice: Metro takes `.web.tsx` on web and
 * `.native.tsx` on native, Jest resolves the bare specifier to `.native.tsx`,
 * and tsc picks `.web.tsx` via `moduleSuffixes` in tsconfig.json. It is kept
 * only as the extensionless fallback of that resolution chain, so it must stay
 * a thin delegate — it previously carried a second, full copy of the web
 * implementation, which silently drifted from the real one and cost an
 * iteration of #1477 spent editing code the browser never runs.
 */
export default function GoogleSignInButton(props: GoogleSignInButtonProps) {
    if (Platform.OS === 'web') {
        return <GoogleSignInButtonWeb {...props} />;
    }

    return <GoogleSignInButtonNative {...props} />;
}
