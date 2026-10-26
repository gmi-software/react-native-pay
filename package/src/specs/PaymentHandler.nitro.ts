import type { HybridObject } from 'react-native-nitro-modules'
import type {
  PayServiceStatus,
  PayServiceStatusOptions,
  PaymentRequest,
  PaymentResult,
  StartPaymentOptions,
} from '../types/Payment'

export interface PaymentHandler
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  payServiceStatus(options?: PayServiceStatusOptions): PayServiceStatus
  startPayment(
    request: PaymentRequest,
    options?: StartPaymentOptions
  ): Promise<PaymentResult>
  canMakePayments(usingNetworks: string[]): boolean
  isPaymentInProgress(): boolean
}
