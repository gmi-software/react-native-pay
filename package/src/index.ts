import { getPaymentHandler } from './paymentHandler'

export const HybridPaymentHandler = getPaymentHandler()

export type { PaymentHandler } from './specs/PaymentHandler.nitro'

export {
  ApplePayButton,
  type ApplePayButtonProps,
} from './components/ApplePayButton'
export {
  GooglePayButton,
  type GooglePayButtonProps,
} from './components/GooglePayButton'
export type {
  ApplePayButtonStyle,
  ApplePayButtonType,
} from './specs/ApplePayButton.nitro'
export type {
  GooglePayButtonTheme,
  GooglePayButtonType,
} from './specs/GooglePayButton.nitro'

export * from './types'
export * from './utils'
export * from './hooks'
