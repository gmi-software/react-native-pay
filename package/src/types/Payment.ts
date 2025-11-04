/**
 * Payment types based on PassKit framework
 * @see https://developer.apple.com/documentation/passkit
 */

import type { CNContact } from './Contact'

export type PaymentItemType = 'final' | 'pending'

export type PaymentMethodType =
  | 'unknown'
  | 'debit'
  | 'credit'
  | 'prepaid'
  | 'store'

export type PaymentNetwork =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'jcb'
  | 'maestro'
  | 'electron'
  | 'elo'
  | 'idcredit'
  | 'interac'
  | 'privateLabel'

export type PassActivationState =
  | 'activated'
  | 'requiresActivation'
  | 'activating'
  | 'suspended'
  | 'deactivated'

export interface PKPass {
  passTypeIdentifier: string
  serialNumber: string
  organizationName?: string
}

export interface PKSecureElementPass extends PKPass {
  primaryAccountIdentifier: string
  primaryAccountNumberSuffix: string
  deviceAccountIdentifier: string
  deviceAccountNumberSuffix: string
  passActivationState: PassActivationState
  devicePassIdentifier?: string
  pairedTerminalIdentifier?: string
}

export interface PaymentItem {
  label: string
  amount: number
  type: PaymentItemType
}

export interface PaymentMethod {
  displayName?: string
  network?: PaymentNetwork
  type: PaymentMethodType
  secureElementPass?: PKSecureElementPass // Available from iOS 13.4+
  billingAddress?: CNContact // Available from iOS 13.0+
}

export interface PaymentToken {
  paymentMethod: PaymentMethod
  transactionIdentifier: string
  paymentData: string // Base64 encoded Data from PKPaymentToken
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
  token?: PaymentToken
  error?: string
}

export interface ApplePayStatus {
  canMakePayments: boolean
  canSetupCards: boolean
}
