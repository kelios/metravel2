// Native confirmations use `Alert.alert` in `confirmAction`; keep the shared
// root import from pulling the web dialog host and its UI chunk into native.
const ConfirmDialogHost = () => null

export default ConfirmDialogHost
