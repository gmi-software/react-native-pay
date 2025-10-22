import type { HybridObject } from 'react-native-nitro-modules'

export interface ApplePayStatus {
  canMakePayments: boolean
  canSetupCards: boolean
}

export type PaymentItemType = 'final' | 'pending'

export interface PaymentItem {
  label: string
  amount: number
  type: PaymentItemType
}

export interface PaymentRequest {
  merchantIdentifier: string
  countryCode: string
  currencyCode: string
  paymentItems: PaymentItem[]
  merchantCapabilities: string[]
  supportedNetworks: string[]
  shippingType?: string
  shippingMethods?: PaymentItem[]
  billingContactRequired?: boolean
  shippingContactRequired?: boolean
}

export interface PaymentResult {
  success: boolean
  transactionId?: string
  error?: string
}

export interface PaymentHandler extends HybridObject<{ ios: 'swift' }> {
  applePayStatus(): ApplePayStatus
  startPayment(request: PaymentRequest): Promise<PaymentResult>
  canMakePayments(usingNetworks: string[]): boolean
}
