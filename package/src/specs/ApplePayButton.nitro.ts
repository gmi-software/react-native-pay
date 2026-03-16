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
export type ApplePayButtonStyle = 'white' | 'whiteOutline' | 'black'

export interface ApplePayButtonProps extends HybridViewProps {
  buttonType: ApplePayButtonType
  buttonStyle: ApplePayButtonStyle
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
