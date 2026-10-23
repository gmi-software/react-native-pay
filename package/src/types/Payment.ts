/**
 * Payment types based on PassKit framework
 * @see https://developer.apple.com/documentation/passkit
 */

import type { CNContact, PaymentContact } from './Contact'

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

export type GooglePayEnvironment = 'TEST' | 'PRODUCTION'

/**
 * Apple Pay merchant capability. `'3DS'` and `'EMV'` are payment protocols
 * (EMV only covers China UnionPay); `'Credit'` and `'Debit'` limit the
 * accepted card types. iOS adds `'3DS'` when neither protocol is given.
 */
export type MerchantCapability = '3DS' | 'EMV' | 'Credit' | 'Debit'

/**
 * How Apple Pay labels the shipping address and the shipping methods, for
 * example "Delivery Address" for `'delivery'`. iOS only.
 */
export type ShippingType =
  | 'shipping'
  | 'delivery'
  | 'storePickup'
  | 'servicePickup'

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

/**
 * A monetary amount in the currency's major unit: `'19.99'` or `19.99`.
 *
 * Decimal strings are exact. Numbers are read as the shortest decimal that
 * round-trips (`19.99`, never `19.98999…`), so float arithmetic results such
 * as `0.1 + 0.2` fail validation instead of being rounded silently.
 */
export type PaymentAmount = number | string

export interface PaymentItem {
  label: string
  amount: PaymentAmount
  type: PaymentItemType
}

/**
 * A delivery option the payer can choose in the payment sheet.
 * @see PaymentRequest.shippingMethods
 */
export interface ShippingMethod {
  /**
   * Identifies the method in `PaymentResult.shippingMethod`. Must be unique
   * within the request.
   */
  identifier: string
  /** For example `'Express'`. */
  label: string
  /** Added to the total while the method is selected. Must not be negative. */
  amount: PaymentAmount
  /** Shown with the label, for example `'Arrives in 1–2 days'`. */
  detail?: string
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
  // Optional Apple Pay override for apps with multiple configured merchant IDs.
  // When omitted, iOS resolves the first configured entitlement automatically.
  applePayMerchantIdentifier?: string
  // Business name shown to the payer. iOS labels the Apple Pay total with it
  // ("Pay <merchantName>"); both platforms fall back to the app's name.
  merchantName?: string
  countryCode: string
  currencyCode: string
  paymentItems: PaymentItem[]
  // `MerchantCapability` values. Not typed as such: Nitro would generate a
  // native enum that rejects `'3ds'` or unknown values without a message.
  merchantCapabilities: string[]
  supportedNetworks: string[]
  /**
   * A `ShippingType` value. iOS only; Android ignores it. An unknown value
   * fails the payment on iOS. Not typed as `ShippingType` for the same
   * reason as `merchantCapabilities`.
   */
  shippingType?: string
  /**
   * Delivery options for the payer. The selected method is added to the
   * total as its own line and returned as `PaymentResult.shippingMethod`.
   * The order matters: the first method is selected by default on iOS, and
   * is the one charged on Android, where Google Pay cannot offer a choice
   * yet. Use it with `shippingContactRequired`.
   */
  shippingMethods?: ShippingMethod[]
  /**
   * Ask for the billing name and postal address, returned as
   * `PaymentResult.billingContact`.
   */
  billingContactRequired?: boolean
  /**
   * Ask for the shipping name and postal address, returned as
   * `PaymentResult.shippingContact`.
   */
  shippingContactRequired?: boolean
  /** Ask for an email address, returned as `PaymentResult.emailAddress`. */
  emailRequired?: boolean
  /**
   * Ask for a phone number, returned as `PaymentResult.phoneNumber`.
   * Google Pay only collects a phone number with an address. Without
   * `shippingContactRequired`, Android asks for it with the billing address,
   * and asks for at least the billing name, country and postal code even
   * when `billingContactRequired` is off.
   */
  phoneNumberRequired?: boolean
  // Google Pay specific configuration (Android only)
  googlePayMerchantId?: string
  googlePayEnvironment?: GooglePayEnvironment
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
}

/**
 * What the payer chose in the payment sheet besides the card. Each field is
 * set only when the `PaymentRequest` asked for it.
 *
 * Passed to `StartPaymentOptions.onAuthorize` and included in `PaymentResult`.
 */
export interface PaymentDetails {
  /** Requested with `PaymentRequest.billingContactRequired`. */
  billingContact?: PaymentContact
  /** Requested with `PaymentRequest.shippingContactRequired`. */
  shippingContact?: PaymentContact
  /** Requested with `PaymentRequest.emailRequired`. */
  emailAddress?: string
  /** As the payer entered it. Requested with `PaymentRequest.phoneNumberRequired`. */
  phoneNumber?: string
  /**
   * The selected entry of `PaymentRequest.shippingMethods`, as you sent it.
   * On Android, always the first one.
   */
  shippingMethod?: ShippingMethod
}

export interface PaymentResult extends PaymentDetails {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
}

export type PaymentAuthorizationStatus = 'success' | 'failure'

/**
 * What your server decided about an authorized payment. Returned from
 * `StartPaymentOptions.onAuthorize`.
 */
export interface PaymentAuthorizationResult {
  status: PaymentAuthorizationStatus
  // Reported as `PaymentResult.error` when `status` is `'failure'`.
  error?: string
}

export interface StartPaymentOptions {
  /**
   * Called with the token after the user authorizes the payment. Charge it on
   * your server and resolve with the outcome. On iOS the Apple Pay sheet stays
   * up until this settles and then shows success or failure. On Android it
   * runs after the Google Pay sheet has closed.
   * It must settle within 25 seconds, or the payment fails with a timeout and
   * its later result is ignored. A rejection counts as `'failure'`.
   * On iOS, after a `'failure'` or a timeout the user can retry from the same
   * sheet, which calls this again with a new token. Make the charge idempotent
   * per order ID, not per token.
   * `details` holds the contact details and shipping method the request
   * asked for, so you can check them before charging.
   */
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>
}

/**
 * Wallet readiness on this device, from `HybridPaymentHandler.payServiceStatus()`.
 */
export interface PayServiceStatus {
  /**
   * The device can pay with Apple Pay or Google Pay, with or without a card.
   * iOS: `PKPaymentAuthorizationViewController.canMakePayments()`.
   * Android: `isReadyToPay` without `existingPaymentMethodRequired`.
   */
  isSupported: boolean
  /**
   * The user has a card ready on one of the checked networks.
   * iOS: `canMakePayments(usingNetworks:capabilities:)`.
   * Android: `isReadyToPay` with `existingPaymentMethodRequired: true`.
   * `false` when no checked network is recognised.
   */
  hasActiveCard: boolean
}

/**
 * What `payServiceStatus` checks. Pass the values your payment request uses.
 */
export interface PayServiceStatusOptions {
  // Networks a card must be on to count for `hasActiveCard`. Defaults to
  // `['visa', 'mastercard', 'amex', 'discover']`.
  supportedNetworks?: string[]
  // iOS only. `MerchantCapability` values a card must support. Defaults to
  // `['3DS']`; `'3DS'` is added when neither `'3DS'` nor `'EMV'` is given.
  merchantCapabilities?: string[]
  // Android only. The Google Pay environment to ask. Defaults to `'TEST'`.
  googlePayEnvironment?: GooglePayEnvironment
}

/**
 * What `canMakePayments(usingNetworks, options)` checks besides the networks.
 */
export interface CanMakePaymentsOptions {
  // iOS only. Same as `PayServiceStatusOptions.merchantCapabilities`.
  merchantCapabilities?: string[]
  // Android only. The Google Pay environment to ask. Defaults to `'TEST'`.
  googlePayEnvironment?: GooglePayEnvironment
}

// Backward compatibility alias
export type ApplePayStatus = PayServiceStatus
