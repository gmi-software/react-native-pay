import { NitroModules, getHostComponent } from 'react-native-nitro-modules'
import type {
  ApplePayButtonProps,
  ApplePayButtonMethods,
} from './specs/ApplePayButton.nitro'
import type {
  GooglePayButtonProps,
  GooglePayButtonMethods,
} from './specs/GooglePayButton.nitro'
import type { PaymentHandler } from './specs/PaymentHandler.nitro'

export const HybridPaymentHandler =
  NitroModules.createHybridObject<PaymentHandler>('PaymentHandler')

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
