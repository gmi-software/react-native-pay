import { NitroModules, getHostComponent } from 'react-native-nitro-modules'
import type {
  ApplePayButtonProps,
  ApplePayButtonMethods,
} from './specs/ApplePayButton.nitro'
import type { PaymentHandler } from './specs/PaymentHandler.nitro'

export const HybridPaymentHandler =
  NitroModules.createHybridObject<PaymentHandler>('PaymentHandler')

export type {
  ApplePayStatus,
  PaymentItem,
  PaymentItemType,
  PaymentRequest,
  PaymentResult,
  PaymentHandler,
} from './specs/PaymentHandler.nitro'

// Import the generated view config
import ApplePayButtonConfig from '../nitrogen/generated/shared/json/ApplePayButtonConfig.json'

export const ApplePayButton = getHostComponent<
  ApplePayButtonProps,
  ApplePayButtonMethods
>('ApplePayButton', () => ApplePayButtonConfig)
