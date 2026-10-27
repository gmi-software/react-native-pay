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
  shippingType?: string            // ShippingType value, iOS only
  shippingMethods?: ShippingMethod[] // → PaymentResult.shippingMethod
  billingContactRequired?: boolean  // → PaymentResult.billingContact
  shippingContactRequired?: boolean // → PaymentResult.shippingContact
  emailRequired?: boolean           // → PaymentResult.emailAddress
  phoneNumberRequired?: boolean     // → PaymentResult.phoneNumber
  // Google Pay (Android)
  googlePayMerchantId?: string
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
  googlePayAllowedAuthMethods?: string[] // GooglePayAuthMethod values
}
```

On iOS, `applePayMerchantIdentifier` is optional and only needed when you want to override the Merchant ID configured in the native app entitlements.

`merchantName` is the business name shown to the payer: the name on the Google Pay sheet and the label of the Apple Pay total. Apple Pay shows the last summary item as the total ("Pay *label*"), so on iOS the library appends a total item labelled with `merchantName` after your `paymentItems`, also when there is only one item. Don't add your own "Total" item. If `merchantName` is missing or blank, Android uses the app's label from the manifest and iOS uses the app's display name (`CFBundleDisplayName`, then `CFBundleName`).

`merchantCapabilities` takes [`MerchantCapability`](#merchantcapability) values.

`supportedNetworks` takes [`PaymentNetwork`](#paymentnetwork) names, matched ignoring case, and limits the cards the payer can choose on both platforms. A name that is not a `PaymentNetwork` fails the payment, with an `error` that contains `Unknown payment network "<value>". Use a PaymentNetwork value such as "visa" or "mastercard"`. A network the platform does not offer is left out, so one cross-platform list works: Android drops `cartesBancaires`, for example. The payment fails when no network is left.

`googlePayAllowedAuthMethods` takes [`GooglePayAuthMethod`](#googlepayauthmethod) values and defaults to both. Android only.

`billingContactRequired`, `shippingContactRequired`, `emailRequired` and `phoneNumberRequired` ask the payer for contact details, which come back in the result as [`PaymentDetails`](#paymentdetails). On Android, a phone number is collected with an address. See [Shipping and contact details](/docs/guides/contact-details).

`shippingType` takes a [`ShippingType`](#shippingtype) value. `shippingMethods` takes [`ShippingMethod`](#shippingmethod) values; the selected one is added to the total. The first is selected by default on iOS and is always the one charged on Android.

---

## PaymentResult

Returned from `startPayment()` (hook or handler).

```ts no-check
interface PaymentResult extends PaymentDetails {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
  // From PaymentDetails, set only when requested:
  // billingContact, shippingContact, emailAddress, phoneNumber, shippingMethod
}
```

Send `token` (and optionally `transactionId`) to your backend to complete the charge with your gateway. A successful result also holds the contact details and shipping method the request asked for; see [PaymentDetails](#paymentdetails).

---

## StartPaymentOptions

Optional second argument of `HybridPaymentHandler.startPayment()`. The hook takes `onAuthorize` in its config instead.

```ts no-check
interface StartPaymentOptions {
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>
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

- **displayName** — Describes the card to the payer, as the wallet words it: `PKPaymentMethod.displayName` on iOS, `paymentMethodData.description` on Android (for example "Visa •••• 1234"). Show it as is; don't parse it.
- **network** — The card's [`PaymentNetwork`](#paymentnetwork), or `'unknown'` for a network the library cannot name. Use `network` rather than `displayName` for logic.
- **type** — How the card is funded: `PKPaymentMethod.type` on iOS, Google Pay's `cardFundingSource` on Android. Android reports `'credit'`, `'debit'` or `'prepaid'`, and `'unknown'` when Google Pay does not know; `'store'` (a store card) is iOS only.

---

## PaymentNetwork

Card networks. Use these names in `supportedNetworks`; results report one of them in `token.paymentMethod.network`.

```ts
type PaymentNetwork =
  | 'visa' | 'mastercard' | 'amex' | 'discover'
  | 'jcb' | 'maestro' | 'electron' | 'elo'
  | 'idcredit' | 'interac' | 'privateLabel'
  | 'cartesBancaires' | 'chinaUnionPay' | 'dankort' | 'eftpos'
  | 'girocard' | 'mada' | 'mir' | 'quicPay' | 'suica' | 'vPay'
  | 'waon' | 'nanaco' | 'bancontact' | 'postFinance' | 'pagoBancomat'
  | 'tmoney' | 'meeza' | 'napas' | 'bankAxept' | 'himyan' | 'jaywan'
  | 'myDebit'
  | 'unknown' // results only
```

| Platform | Offers |
|----------|--------|
| Google Pay | `visa`, `mastercard`, `amex`, `discover`, `jcb`, `interac`, and `electron`, `maestro` and `elo` for Brazilian combo cards |
| Apple Pay | Every network but `unknown`. Some need a newer iOS: `bancontact` 16, `postFinance` 16.4, `pagoBancomat` and `tmoney` 17, `meeza` 17.4, `napas` and `bankAxept` 17.5, `himyan` and `jaywan` 18.4, `myDebit` 26 |

`'unknown'` is never a valid request value. A result reports it for a card on a network that is not listed here, instead of guessing.

---

## PayServiceStatus

Resolved by `HybridPaymentHandler.payServiceStatus()`.

```ts
interface PayServiceStatus {
  isSupported: boolean   // the device can pay with Apple Pay / Google Pay
  hasActiveCard: boolean // a card on the checked networks is ready
}
```

| | iOS | Android |
|---|---|---|
| `isSupported` | `PKPaymentAuthorizationViewController.canMakePayments()` | `isReadyToPay` |
| `hasActiveCard` | `canMakePayments(usingNetworks:capabilities:)` | `isReadyToPay` with `existingPaymentMethodRequired: true` and the request's card parameters |

In the Google Pay `TEST` environment, `hasActiveCard` is `true` whether or not the user has a card. See [Check availability](/docs/guides/availability).

## PayServiceStatusOptions

What `payServiceStatus` checks. Pass the values your payment request uses, so `hasActiveCard` counts only cards the payment accepts.

```ts
interface PayServiceStatusOptions {
  supportedNetworks?: string[]           // default: ['visa', 'mastercard', 'amex', 'discover']
  merchantCapabilities?: string[]        // default: ['3DS']
  googlePayAllowedAuthMethods?: string[] // Android only. Default: both
  googlePayEnvironment?: 'TEST' | 'PRODUCTION' // Android only. Default: 'TEST'
}
```

The values are checked as in `startPayment`, and the Promise rejects with the same configuration error for a value the payment would refuse.

---

## GooglePayEnvironment

Used in config and `PaymentRequest` for Android.

```ts
type GooglePayEnvironment = 'TEST' | 'PRODUCTION'
```

Use `'TEST'` for development/sandbox; `'PRODUCTION'` for live charges. Android uses `'TEST'` when the value is omitted. See [Testing payments](/docs/guides/testing#test-environment).

---

## GooglePayAuthMethod

How Google Pay may authenticate the card, used in `googlePayAllowedAuthMethods` (Android only).

```ts
type GooglePayAuthMethod = 'PAN_ONLY' | 'CRYPTOGRAM_3DS'
```

- `'PAN_ONLY'` — Cards saved to the payer's Google account. The token holds the card number.
- `'CRYPTOGRAM_3DS'` — Cards tokenized on the device. The token holds a 3-D Secure cryptogram. Google Pay does not offer `jcb` or `discover` with it.

The default is both. Pass `['CRYPTOGRAM_3DS']` when your gateway or Strong Customer Authentication requires device tokens. Android matches the values ignoring case, and any other value fails the payment, with an `error` that contains `Unknown Google Pay auth method "<value>". Use "PAN_ONLY" or "CRYPTOGRAM_3DS"`. They are separate from `merchantCapabilities`: every Apple Pay card is a device token, so iOS has nothing like `'PAN_ONLY'`.

---

## MerchantCapability

Merchant capabilities, used in `merchantCapabilities`. They come from Apple Pay; Android only reads `'Credit'` and `'Debit'`.

```ts
type MerchantCapability = '3DS' | 'EMV' | 'Credit' | 'Debit'
```

- `'3DS'` and `'EMV'` are Apple Pay payment protocols. PassKit needs at least one of them. EMV only covers China UnionPay, so every other card needs 3DS. Android ignores them.
- `'Credit'` and `'Debit'` limit the accepted card types.

Both platforms match the values case-insensitively. Any other value fails the payment: the result has `success: false` and `error: 'Unknown merchant capability "<value>". Use "3DS", "EMV", "Credit" or "Debit"'`.

iOS adds `'3DS'` when neither `'3DS'` nor `'EMV'` is given, so `[]` is sent as 3DS and `['Credit']` as 3DS + Credit.

Google Pay can leave credit cards out, but not debit cards:

| `merchantCapabilities` | iOS accepts | Android accepts |
|---|---|---|
| `['3DS']` | Every card type | Every card type |
| `['3DS', 'Debit']` | Debit cards | Every card type but credit cards |
| `['3DS', 'Credit']` | Credit cards | Every card type |
| `['3DS', 'Credit', 'Debit']` | Credit and debit cards | Every card type |

For `'Debit'` without `'Credit'`, Android sends `allowCreditCards: false` to Google Pay, which UK gambling merchants must do. Prepaid cards stay allowed. To refuse debit cards on Android, check the card on your server before you charge it. Give [`GooglePayButton`](/docs/api/components#googlepaybutton-android-only) and [`payServiceStatus`](#payservicestatusoptions) the same `merchantCapabilities`, so they are sent the same card types as the payment.

---

## ShippingType

How Apple Pay labels the address, used in `PaymentRequest.shippingType` (iOS only; Android ignores the field).

```ts
type ShippingType = 'shipping' | 'delivery' | 'storePickup' | 'servicePickup'
```

For example, `'delivery'` shows "Delivery Address" instead of "Shipping Address". Without `shippingType`, Apple Pay uses `'shipping'`. Any other value fails the payment: the result has `success: false` and `error: 'Unknown shipping type "<value>". Use "shipping", "delivery", "storePickup" or "servicePickup"'`.

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

## PaymentDetails

What the payer chose in the payment sheet besides the card, on both platforms. Each field is set only when the `PaymentRequest` asked for it. `PaymentResult` includes these fields, and `onAuthorize` receives them as its second argument. See [Shipping and contact details](/docs/guides/contact-details).

```ts no-check
interface PaymentDetails {
  billingContact?: PaymentContact  // billingContactRequired
  shippingContact?: PaymentContact // shippingContactRequired
  emailAddress?: string            // emailRequired
  phoneNumber?: string             // phoneNumberRequired, as the payer entered it
  shippingMethod?: ShippingMethod  // the selected entry of shippingMethods
}
```

---

## ShippingMethod

A delivery option in `PaymentRequest.shippingMethods`. See [Shipping methods](/docs/guides/contact-details#shipping-methods).

```ts no-check
interface ShippingMethod {
  identifier: string    // unique within the request, returned in PaymentResult.shippingMethod
  label: string         // e.g. 'Express'
  amount: PaymentAmount // added to the total while selected; must not be negative
  detail?: string       // e.g. 'Next business day'
}
```

The selected method appears as its own line in the sheet and is included in the total. `PaymentResult.shippingMethod` is the selected entry as you sent it. On Android, Google Pay cannot offer a choice yet, so the first method is charged and returned.

---

## PaymentContact

A name and postal address the payer chose. Parts the payer left empty are omitted.

```ts no-check
interface PaymentContact {
  name?: string        // full name, e.g. 'Jane Appleseed'
  givenName?: string   // iOS only
  familyName?: string  // iOS only
  postalAddress?: CNPostalAddress
}
```

In `postalAddress`, `street` joins the address lines with `'\n'`, `isoCountryCode` is uppercase ISO 3166-1 alpha-2, and `country` (the country name) is iOS only.

---

## Contact types

`CNPostalAddress` is used by [`PaymentContact`](#paymentcontact). The other types describe `PaymentMethod.billingAddress`, the card's billing contact on iOS. For a billing address on both platforms, use `billingContactRequired` and read `PaymentResult.billingContact`.

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
