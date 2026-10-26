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
  payServiceStatus(options?: PayServiceStatusOptions): Promise<PayServiceStatus>
  startPayment(
    request: PaymentRequest,
    options?: StartPaymentOptions
  ): Promise<PaymentResult>
  isPaymentInProgress(): boolean
  // iOS only: opens Wallet to add a card. Does nothing on Android.
  openPaymentSetup(): void
}
