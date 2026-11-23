import type {
  HybridView,
  HybridViewProps,
  HybridViewMethods,
} from 'react-native-nitro-modules'

export type ApplePayButtonType =
  | 'buy'
  | 'setUp'
  | 'book'
  | 'donate'
  | 'continue'
  | 'reload'
  | 'addMoney'
  | 'topUp'
  | 'order'
  | 'rent'
  | 'support'
  | 'contribute'
  | 'tip'
  | 'plain'
  | 'checkout'
  | 'subscribe'
  | 'inStore'
export type ApplePayButtonStyle = 'white' | 'whiteOutline' | 'black'

export interface ApplePayButtonProps extends HybridViewProps {
  buttonType: ApplePayButtonType
  buttonStyle: ApplePayButtonStyle
  /**
   * iOS 26+: show the plain button instead of the payer's default card art.
   * Defaults to `false`, as on iOS. Ignored on earlier versions.
   */
  disableCardArt?: boolean
  /** Corner radius in points. Defaults to the system radius. */
  cornerRadius?: number
  onPress?: () => void
}

export interface ApplePayButtonMethods extends HybridViewMethods {
  // No additional methods needed for the button
}

export type ApplePayButton = HybridView<
  ApplePayButtonProps,
  ApplePayButtonMethods,
  { ios: 'swift' }
>
