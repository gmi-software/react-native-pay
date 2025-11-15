import type { HybridObject } from 'react-native-nitro-modules'
import type {
  PayServiceStatus,
  PaymentRequest,
  PaymentResult,
} from '../types/Payment'

export interface PaymentHandler
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  payServiceStatus(): PayServiceStatus
  startPayment(request: PaymentRequest): Promise<PaymentResult>
  canMakePayments(usingNetworks: string[]): boolean
}
