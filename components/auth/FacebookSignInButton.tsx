type FacebookSignInButtonProps = {
    onSuccess: (credential: string) => void;
    onError?: (error: string) => void;
    onCancel?: () => void;
    disabled?: boolean;
};

/** Facebook Login is currently a web-only rollout. */
export default function FacebookSignInButton(_props: FacebookSignInButtonProps) {
    return null;
}
