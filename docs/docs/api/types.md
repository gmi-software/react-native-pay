# Types

TypeScript types exported from `@gmisoftware/react-native-pay`. Use them for request/result handling and server integration.

## PaymentAmount

A monetary amount in the currency's major unit (dollars, not cents).

```ts
type PaymentAmount = number | string
```

- **Decimal string** (`'19.99'`): exact. Must match `^-?\d+(\.\d+)?$`; no exponents, spaces, or thousands separators.
- **Number** (`19.99`): read as the shortest decimal that round-trips, so `19.99` stays exactly `19.99`. Results of float arithmetic such as `0.1 + 0.2` (`0.30000000000000004`) fail validation instead of being rounded.

Before a payment starts, every amount is validated and sent to native code as a decimal string with the currency's number of decimal places (ISO 4217: 2 for USD, 0 for JPY, 3 for KWD). Native code converts it with `NSDecimalNumber` (iOS) and `BigDecimal` (Android), never through `Double`. A payment does not start when:

- an amount is not a finite number or a plain decimal string (`NaN`, `Infinity`, `'abc'`);
- an amount has more decimal places than the currency allows (`1.005` in USD, `'1200.5'` in JPY);
- the total of `paymentItems` is negative. Negative line items (discounts) are allowed.

Google Pay accepts at most two decimal places, so on Android a three-decimal amount such as `'1.234'` KWD fails with an error.

---

## PaymentItem

A single line item (label, amount, type).

```ts no-check
interface PaymentItem {
  label: string
  amount: PaymentAmount // number | string
  type: 'final' | 'pending'
}
```

`type` is exported as `PaymentItemType`.

- **final** — Confirmed amount (e.g. product price, tax).
- **pending** — Estimate (e.g. shipping that may change).

If any item is `pending`, the total is an estimate too: Google Pay receives `totalPriceStatus: 'ESTIMATED'` and Apple Pay marks the total summary item as `.pending`. Every item is sent to Google Pay as a `LINE_ITEM` display item, with `status` set to `FINAL` or `PENDING`.

---

## PaymentRequest

Full request passed to the native layer (or to `HybridPaymentHandler.startPayment`).

```ts no-check
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

`merchantName` is the business name shown to the payer: the name on the Google Pay sheet and the label of the Apple Pay total. Apple Pay shows the last summary item as the total ("Pay *label*"), so on iOS the library appends a total item labelled with `merchantName` after your `paymentItems`, also when there is only one item. Don't add your own "Total" item. If `merchantName` is missing or blank, Android uses the app's label from the manifest and iOS uses the app's display name (`CFBundleDisplayName`, then `CFBundleName`).

`merchantCapabilities` takes [`MerchantCapability`](#merchantcapability) values.

---

## PaymentResult

Returned from `startPayment()` (hook or handler).

```ts no-check
interface PaymentResult {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
}
```

Send `token` (and optionally `transactionId`) to your backend to complete the charge with your gateway.

---

## StartPaymentOptions

Optional second argument of `HybridPaymentHandler.startPayment()`. The hook takes `onAuthorize` in its config instead.

```ts no-check
interface StartPaymentOptions {
  onAuthorize?: (token: PaymentToken) => Promise<PaymentAuthorizationResult>
}

interface PaymentAuthorizationResult {
  status: 'success' | 'failure'
  error?: string // becomes PaymentResult.error on failure
}
```

See [Charge before the sheet closes](/docs/guides/server-processing#charge-before-the-sheet-closes).

---

## PaymentToken

The token you send to your server. **Do not log or expose; treat as sensitive.**

```ts no-check
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

```ts no-check
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

## MerchantCapability

Apple Pay merchant capabilities, used in `merchantCapabilities` (iOS only; Android ignores the field).

```ts
type MerchantCapability = '3DS' | 'EMV' | 'Credit' | 'Debit'
```

- `'3DS'` and `'EMV'` are payment protocols. PassKit needs at least one of them. EMV only covers China UnionPay, so every other card needs 3DS.
- `'Credit'` and `'Debit'` limit the accepted card types.

iOS matches the values case-insensitively and adds `'3DS'` when neither `'3DS'` nor `'EMV'` is given, so `[]` is sent as 3DS and `['Credit']` as 3DS + Credit. Any other value fails the payment: the result has `success: false` and `error: 'Unknown merchant capability "<value>". Use "3DS", "EMV", "Credit" or "Debit"'`.

---

## Pass types (iOS)

These iOS-only types appear in payment-related metadata returned by Apple Pay APIs (for example pass details tied to the selected card) and are mostly useful in advanced/native-integrated flows.

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

These fields are populated from the contact information the user approves in the Apple Pay sheet.

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

```ts no-check
type ApplePayStatus = PayServiceStatus
```
