import { getHostComponent } from 'react-native-nitro-modules'
import type {
  ApplePayButtonProps,
  ApplePayButtonMethods,
} from './specs/ApplePayButton.nitro'
import type {
  GooglePayButtonProps,
  GooglePayButtonMethods,
} from './specs/GooglePayButton.nitro'
import { getPaymentHandler } from './paymentHandler'

export const HybridPaymentHandler = getPaymentHandler()

export type { PaymentHandler } from './specs/PaymentHandler.nitro'

import ApplePayButtonConfig from '../nitrogen/generated/shared/json/ApplePayButtonConfig.json'
import GooglePayButtonConfig from '../nitrogen/generated/shared/json/GooglePayButtonConfig.json'

export const ApplePayButton = getHostComponent<
  ApplePayButtonProps,
  ApplePayButtonMethods
>('ApplePayButton', () => ApplePayButtonConfig)

export const GooglePayButton = getHostComponent<
  GooglePayButtonProps,
  GooglePayButtonMethods
>('GooglePayButton', () => GooglePayButtonConfig)

export * from './types'
export * from './utils'
export * from './hooks'
