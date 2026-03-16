# Types

TypeScript types exported from `@gmisoftware/react-native-pay`. Use them for request/result handling and server integration.

## PaymentItem

A single line item (label, amount, type).

```ts
interface PaymentItem {
  label: string
  amount: number
  type: 'final' | 'pending'
}
```

`type` is exported as `PaymentItemType`.

- **final** — Confirmed amount (e.g. product price, tax).
- **pending** — Estimate (e.g. shipping that may change).

---

## PaymentRequest

Full request passed to the native layer (or to `HybridPaymentHandler.startPayment`).

```ts
interface PaymentRequest {
  applePayMerchantIdentifier?: string
  merchantName?: string
  countryCode: string
  currencyCode: string
  paymentItems: PaymentItem[]
  merchantCapabilities: string[]
  supportedNetworks: string[]
  shippingType?: string
  shippingMethods?: PaymentItem[]
  billingContactRequired?: boolean
  shippingContactRequired?: boolean
  // Google Pay (Android)
  googlePayMerchantId?: string
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
}
```

On iOS, `applePayMerchantIdentifier` is optional and only needed when you want to override the Merchant ID configured in the native app entitlements.

---

## PaymentResult

Returned from `startPayment()` (hook or handler).

```ts
interface PaymentResult {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
}
```

Send `token` (and optionally `transactionId`) to your backend to complete the charge with your gateway.

---

## PaymentToken

The token you send to your server. **Do not log or expose; treat as sensitive.**

```ts
interface PaymentToken {
  paymentMethod: PaymentMethod
  transactionIdentifier: string
  paymentData: string  // Opaque token payload (format depends on platform + gateway)
}
```

- **paymentMethod** — Card/network and optional billing contact.
- **transactionIdentifier** — Unique id for this payment session.
- **paymentData** — Opaque payload for your gateway.
  - iOS: Base64-encoded Apple Pay token data.
  - Android: Google Pay tokenization payload (`tokenizationData.token`), gateway-dependent.

---

## PaymentMethod

Describes the selected payment instrument.

```ts
interface PaymentMethod {
  displayName?: string
  network?: PaymentNetwork
  type: PaymentMethodType
  secureElementPass?: PKSecureElementPass  // iOS
  billingAddress?: CNContact                // iOS
}

type PaymentMethodType = 'unknown' | 'debit' | 'credit' | 'prepaid' | 'store'
```

`PaymentMethodType` is exported separately for direct typing.

---

## PaymentNetwork

Supported card networks.

```ts
type PaymentNetwork =
  | 'visa' | 'mastercard' | 'amex' | 'discover'
  | 'jcb' | 'maestro' | 'electron' | 'elo'
  | 'idcredit' | 'interac' | 'privateLabel'
```

---

## PayServiceStatus

Returned by `HybridPaymentHandler.payServiceStatus()`.

```ts
interface PayServiceStatus {
  canMakePayments: boolean
  canSetupCards: boolean
}
```

---

## GooglePayEnvironment

Used in config and `PaymentRequest` for Android.

```ts
type GooglePayEnvironment = 'TEST' | 'PRODUCTION'
```

Use `'TEST'` for development/sandbox; `'PRODUCTION'` for live charges.

---

## Pass types (iOS)

```ts
type PassActivationState =
  | 'activated'
  | 'requiresActivation'
  | 'activating'
  | 'suspended'
  | 'deactivated'

interface PKPass {
  passTypeIdentifier: string
  serialNumber: string
  organizationName?: string
}

interface PKSecureElementPass extends PKPass {
  primaryAccountIdentifier: string
  primaryAccountNumberSuffix: string
  deviceAccountIdentifier: string
  deviceAccountNumberSuffix: string
  passActivationState: PassActivationState
  devicePassIdentifier?: string
  pairedTerminalIdentifier?: string
}
```

---

## Contact types

Used on iOS when `billingContactRequired` / `shippingContactRequired` is requested in `PaymentRequest`.

```ts
type CNContactType = 'person' | 'organization'

interface CNPhoneNumber {
  stringValue: string
}

interface CNPostalAddress {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  isoCountryCode?: string
}

interface CNLabeledPhoneNumber {
  label?: string
  value: CNPhoneNumber
}

interface CNLabeledEmailAddress {
  label?: string
  value: string
}

interface CNLabeledPostalAddress {
  label?: string
  value: CNPostalAddress
}

interface CNContact {
  identifier: string
  contactType: CNContactType
  namePrefix: string
  givenName: string
  middleName: string
  familyName: string
  previousFamilyName: string
  nameSuffix: string
  nickname: string
  organizationName: string
  departmentName: string
  jobTitle: string
  phoneticGivenName: string
  phoneticMiddleName: string
  phoneticFamilyName: string
  phoneticOrganizationName?: string
  note: string
  imageDataAvailable?: boolean
  phoneNumbers: CNLabeledPhoneNumber[]
  emailAddresses: CNLabeledEmailAddress[]
  postalAddresses: CNLabeledPostalAddress[]
}
```

---

## Backward compatibility alias

```ts
type ApplePayStatus = PayServiceStatus
```
