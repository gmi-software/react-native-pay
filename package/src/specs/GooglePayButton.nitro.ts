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
  /** Corner radius in dp, like other React Native sizes. */
  radius?: number
  /**
   * As `PaymentRequest.supportedNetworks`. Pass the same values as the
   * request, so the button shows a card the payer can use.
   */
  supportedNetworks?: string[]
  /** As `PaymentRequest.googlePayAllowedAuthMethods`. Defaults to both. */
  googlePayAllowedAuthMethods?: string[]
  /**
   * As `PaymentRequest.merchantCapabilities`. `'Debit'` without `'Credit'`
   * leaves credit cards out.
   */
  merchantCapabilities?: string[]
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
