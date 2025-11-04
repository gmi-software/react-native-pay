import type { HybridObject } from 'react-native-nitro-modules'
import type {
  ApplePayStatus,
  PaymentRequest,
  PaymentResult,
} from '../types/Payment'

export interface PaymentHandler extends HybridObject<{ ios: 'swift' }> {
  applePayStatus(): ApplePayStatus
  startPayment(request: PaymentRequest): Promise<PaymentResult>
  canMakePayments(usingNetworks: string[]): boolean
}
