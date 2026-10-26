import type {
  HybridView,
  HybridViewProps,
  HybridViewMethods,
} from 'react-native-nitro-modules'

export type GooglePayButtonType =
  | 'buy'
  | 'book'
  | 'checkout'
  | 'donate'
  | 'order'
  | 'pay'
  | 'subscribe'
  | 'plain'

export type GooglePayButtonTheme = 'dark' | 'light'

export interface GooglePayButtonProps extends HybridViewProps {
  buttonType: GooglePayButtonType
  theme: GooglePayButtonTheme
  radius?: number
  /**
   * As `PaymentRequest.supportedNetworks`. Pass the same values as the
   * request, so the button shows a card the payer can use.
   */
  supportedNetworks?: string[]
  /** As `PaymentRequest.googlePayAllowedAuthMethods`. Defaults to both. */
  allowedAuthMethods?: string[]
  onPress?: () => void
}

export interface GooglePayButtonMethods extends HybridViewMethods {
  // No additional methods needed for the button
}

export type GooglePayButton = HybridView<
  GooglePayButtonProps,
  GooglePayButtonMethods,
  { android: 'kotlin' }
>
