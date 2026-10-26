<img width="1660" height="512" alt="react-native-pay" src="https://github.com/user-attachments/assets/b06a4afb-5a0b-4605-a0e1-75793ab4df15" />

<div align="center">

A unified React Native payment module supporting **Apple Pay** (iOS) and **Google Pay** (Android) with a consistent, type-safe API.

[![npm version](https://img.shields.io/npm/v/@gmisoftware/react-native-pay.svg)](https://www.npmjs.com/package/@gmisoftware/react-native-pay)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Expo Compatible](https://img.shields.io/badge/Expo-Compatible-000020.svg)](https://expo.dev/)

Built with [Nitro Modules](https://nitro.margelo.com/) for high-performance native integration.

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [Documentation](#documentation) • [API Reference](#api-reference)

**Full documentation** is available at [gmi-software.github.io/react-native-pay](https://gmi-software.github.io/react-native-pay/). The Docusaurus source lives in **[`docs/`](docs/)**; run `bun run docs:start` to view it locally, or `bun run docs:build` to build static files.

This package presents native payment sheets and returns tokens. Your backend and gateway integration still perform the actual charge.

</div>

---

## Features

- ✅ **Unified API** - Shared payment request/result model across Apple Pay and Google Pay
- ✅ **One Hook for Checkout State** - `usePaymentCheckout()` handles availability checks, cart state, and payment-sheet start
- ✅ **Native UI Components** - Platform-specific payment buttons with full customization
- ✅ **Type-Safe** - Comprehensive TypeScript definitions with full IntelliSense support
- ✅ **Configurable** - Dynamic environment and gateway configuration for both platforms
- ✅ **Built-in Cart** - Shopping cart functionality with batch operations
- ✅ **Modern Architecture** - Built with Nitro Modules for optimal performance
- ✅ **Expo Compatible** - Config plugins for seamless Expo integration
- ✅ **Production Focused** - Built for real-world apps with backend gateway processing

---

## Installation

### Step 1: Install React Native Nitro Modules

This package requires `react-native-nitro-modules` to work. Install it first:

```bash
npm install react-native-nitro-modules
# or
yarn add react-native-nitro-modules
# or
bun add react-native-nitro-modules
```

### Step 2: Install React Native Pay

```bash
npm install @gmisoftware/react-native-pay
# or
yarn add @gmisoftware/react-native-pay
# or
bun add @gmisoftware/react-native-pay
```

### Prerequisites

- React Native 0.70+
- React Native Nitro Modules 0.36.0+ (required)
- Android `minSdkVersion` 26+ (required for Nitro Modules prefab)
- Expo 53–57 (if using Expo; SDK 57 requires Node.js 22.13+)

---

## Platform Setup

### iOS Setup (Apple Pay)

#### 1. Configure Expo Config Plugin

Add the Apple Pay plugin to your `app.json` or `app.config.js`:

```js
{
  "expo": {
    "plugins": [
      [
        "@gmisoftware/react-native-pay",
        {
          "merchantIdentifier": "merchant.com.yourcompany.app"
        }
      ]
    ]
  }
}
```

#### 2. Apple Developer Account Setup

1. **Create a Merchant ID** in Apple Developer Portal:
   - Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list/merchant)
   - Create a new Merchant ID (e.g., `merchant.com.yourcompany.app`)
   - Add it to your app's capabilities

2. **Enable Apple Pay** in your App ID:
   - Go to your App ID settings
   - Enable "Apple Pay Payment Processing"
   - Associate your Merchant ID

3. **Create Payment Processing Certificate**:
   - Create a Payment Processing Certificate for your Merchant ID
   - Download and install it in your payment processor (Stripe, etc.)

#### 3. Run Prebuild (Expo)

```bash
npx expo prebuild --clean
```

### Android Setup (Google Pay)

**Minimum SDK:** set `minSdkVersion` to **26** or higher (e.g. via `expo-build-properties`). Nitro Modules 0.36 prefab requires API 26+.

#### 1. Configure Expo Config Plugin

Add the Google Pay plugin to your `app.json` or `app.config.js`:

```js
{
  "expo": {
    "plugins": [
      [
        "@gmisoftware/react-native-pay",
        {
          "enableGooglePay": true
        }
      ]
    ]
  }
}
```

#### 2. Google Cloud Console Setup

1. **Enable Google Pay API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the Google Pay API for your project

2. **Register Your App** (Production Only):
   - Submit your app for Google Pay approval
   - Provide screenshots and business information
   - Get your production gateway merchant ID from your payment processor

#### 3. Run Prebuild (Expo)

```bash
npx expo prebuild --clean
```

### Combined Setup (Both Platforms)

For apps supporting both platforms:

```js
{
  "expo": {
    "plugins": [
      [
        "@gmisoftware/react-native-pay",
        {
          "merchantIdentifier": "merchant.com.yourcompany.app",
          "enableGooglePay": true
        }
      ]
    ]
  }
}
```

---

## Quick Start

### Basic Example with Hook (Recommended)

The easiest way to integrate payments - one hook handles everything:

```tsx
import React from 'react'
import {
  usePaymentCheckout,
  ApplePayButton,
  GooglePayButton,
  formatAmount,
} from '@gmisoftware/react-native-pay'
import { Platform, View, Text, Button, ActivityIndicator } from 'react-native'
import { callback } from 'react-native-nitro-modules'

function CheckoutScreen() {
  const {
    // Payment availability
    canMakePayments,

    // Cart management
    items,
    total,
    addItem,
    addItems,
    removeItem,

    // Payment processing
    startPayment,
    isProcessing,
    error,
  } = usePaymentCheckout({
    merchantName: 'Your Store',
    currencyCode: 'USD',
    countryCode: 'US',
  })

  const handleAddCoffee = () => {
    addItem('Coffee', 4.99)
  }

  const handleAddFullOrder = () => {
    addItems([
      { label: 'Coffee', amount: 4.99 },
      { label: 'Sandwich', amount: 8.99 },
      { label: 'Tax', amount: 1.20, type: 'final' }
    ])
  }

  const handlePay = async () => {
    const result = await startPayment()

    if (result?.success && result.token) {
      // Send result.token to your server for processing
      console.log('Payment successful:', result.transactionId)
      console.log('Token:', result.token)

      // Call your backend
      await fetch('https://api.yourserver.com/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: result.token,
          transactionId: result.transactionId,
        }),
      })
    }
  }

  if (!canMakePayments) {
    return (
      <View>
        <Text>Apple Pay or Google Pay is not available on this device</Text>
      </View>
    )
  }

  return (
    <View style={{ padding: 20 }}>
      <Button title="Add Coffee ($4.99)" onPress={handleAddCoffee} />
      <Button title="Add Full Order" onPress={handleAddFullOrder} />

      {items.map((item, index) => (
        <View key={index} style={{ flexDirection: 'row', padding: 10 }}>
          <Text>{item.label}: ${formatAmount(item.amount)}</Text>
          <Button title="Remove" onPress={() => removeItem(index)} />
        </View>
      ))}

      <Text style={{ fontSize: 20, marginVertical: 10 }}>
        Total: ${total.toFixed(2)}
      </Text>

      {error && (
        <Text style={{ color: 'red', marginVertical: 10 }}>
          Error: {error.message}
        </Text>
      )}

      {isProcessing ? (
        <ActivityIndicator size="large" />
      ) : (
        Platform.OS === 'ios' ? (
          <ApplePayButton
            buttonType="buy"
            buttonStyle="black"
            onPress={callback(handlePay)}
            style={{ width: '100%', height: 48 }}
          />
        ) : (
          <GooglePayButton
            buttonType="buy"
            theme="dark"
            radius={4}
            onPress={callback(handlePay)}
            style={{ width: '100%', height: 48 }}
          />
        )
      )}
    </View>
  )
}

export default CheckoutScreen
```

---

## Documentation

The **[`docs/`](docs/)** directory contains the full technical documentation (Docusaurus, English): introduction, quick start, installation & setup, API reference, guides, troubleshooting, and compatibility. Run `bun run docs:start` to serve it locally.

### Payment Flow Overview

```
1. Check availability      → usePaymentCheckout() or HybridPaymentHandler.payServiceStatus()
2. Build cart             → addItem() / addItems()
3. Display payment button → ApplePayButton / GooglePayButton
4. Process payment        → startPayment()
5. Handle result          → Send token to server
6. Complete transaction   → Server processes with payment gateway
```

### Google Pay Configuration

For Google Pay, you need to configure your payment gateway:

```typescript
import { usePaymentCheckout } from "@gmisoftware/react-native-pay";

const checkout = usePaymentCheckout({
  merchantName: "Your Store", // shown on the Google Pay sheet
  currencyCode: "USD",
  countryCode: "US",
  // Google Pay specific
  googlePayMerchantId: "your_google_pay_merchant_id",
  googlePayEnvironment: "TEST", // or 'PRODUCTION'
  googlePayGateway: "stripe",
  googlePayGatewayMerchantId: "your_stripe_merchant_id",
});
```

Without `merchantName`, the Google Pay sheet shows your app's label. If any cart item is `pending`, the total is sent as an estimate (`ESTIMATED` on Google Pay, `.pending` on Apple Pay).

#### Supported Payment Gateways

- **Stripe** - `googlePayGateway: 'stripe'`
- **Braintree** - `googlePayGateway: 'braintree'`
- **Square** - `googlePayGateway: 'square'`
- **Adyen** - `googlePayGateway: 'adyen'`
- **Authorize.net** - `googlePayGateway: 'authorizenet'`
- **Checkout.com** - `googlePayGateway: 'checkoutltd'`

For the complete list, see [Google Pay Gateway Tokens](https://developers.google.com/pay/api/android/reference/request-objects#gateway).

---

## API Reference

### `usePaymentCheckout(config)`

The all-in-one hook for handling payments. Manages availability checking, cart state, and payment processing.

#### Configuration

```typescript no-check
interface UsePaymentCheckoutConfig {
  merchantName?: string; // "Pay <merchantName>" on Apple Pay; defaults to the app name
  countryCode?: string; // Default: 'US'
  currencyCode?: string; // Default: 'USD'
  supportedNetworks?: string[]; // Default: ['visa', 'mastercard', 'amex', 'discover']
  merchantCapabilities?: MerchantCapability[]; // Default: ['3DS']
  applePayMerchantIdentifier?: string; // Optional iOS override
  // Google Pay specific (Android)
  googlePayMerchantId?: string;
  googlePayEnvironment?: "TEST" | "PRODUCTION";
  googlePayGateway?: string;
  googlePayGatewayMerchantId?: string;
  // Contact details, returned in the result (see "Shipping and contact details")
  billingContactRequired?: boolean;
  shippingContactRequired?: boolean;
  emailRequired?: boolean;
  phoneNumberRequired?: boolean;
  // Charge the token while the sheet waits (see "Charging before the sheet closes")
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>;
}
```

#### Returns

```typescript no-check
interface UsePaymentCheckoutReturn {
  // Payment availability
  canMakePayments: boolean; // Can user make payments?
  canSetupCards: boolean; // Can user add cards?
  isCheckingStatus: boolean; // Loading state for availability check

  // Cart management
  items: PaymentItem[]; // Current cart items
  total: number; // Exact decimal total (NaN if an amount is invalid)
  addItem: (label: string, amount: number | string, type?: "final" | "pending") => void;
  addItems: (items: Array<{ label; amount; type? }>) => void;
  removeItem: (index: number) => void;
  updateItem: (index: number, updates: Partial<PaymentItem>) => void;
  clearItems: () => void;

  // Payment processing
  startPayment: () => Promise<PaymentResult | null>;
  isProcessing: boolean; // Payment in progress?
  result: PaymentResult | null; // Last payment result
  error: Error | null; // Last error

  // Utilities
  reset: () => void; // Reset payment state
  paymentRequest: PaymentRequest; // Full request object
}
```

#### Example

```typescript
import { usePaymentCheckout } from "@gmisoftware/react-native-pay";

const checkout = usePaymentCheckout({
  merchantName: "Your Store",
  currencyCode: "USD",
  countryCode: "US",
  googlePayMerchantId: "your_google_pay_merchant_id",
  googlePayEnvironment: "TEST",
  googlePayGateway: "stripe",
  googlePayGatewayMerchantId: "your_stripe_merchant_id",
});

// Add single item
checkout.addItem("Product", 29.99);

// Add multiple items at once
checkout.addItems([
  { label: "Product", amount: 29.99 },
  { label: "Shipping", amount: 5.0 },
  { label: "Tax", amount: 2.8, type: "final" },
]);

// Process payment
const result = await checkout.startPayment();
```

---

### `HybridPaymentHandler`

Low-level payment handler for direct control.

#### Methods

##### `payServiceStatus(): PayServiceStatus`

Check payment service availability.

```typescript
import { HybridPaymentHandler } from "@gmisoftware/react-native-pay";

const status = HybridPaymentHandler.payServiceStatus();
console.log("Can make payments:", status.canMakePayments);
console.log("Can setup cards:", status.canSetupCards);
```

**Returns:**

```typescript
interface PayServiceStatus {
  canMakePayments: boolean;
  canSetupCards: boolean;
}
```

##### `startPayment(request: PaymentRequest, options?: StartPaymentOptions): Promise<PaymentResult>`

Start a payment request.

```typescript
import { HybridPaymentHandler, normalizePaymentRequest } from "@gmisoftware/react-native-pay";

const result = await HybridPaymentHandler.startPayment(
  // Validates amounts before the sheet opens; see normalizePaymentRequest
  normalizePaymentRequest({
    merchantName: "Your Store",
    countryCode: "US",
    currencyCode: "USD",
    merchantCapabilities: ["3DS"],
    supportedNetworks: ["visa", "mastercard", "amex"],
    paymentItems: [{ label: "Coffee Subscription", amount: "29.99", type: "final" }],
    googlePayMerchantId: "your_google_pay_merchant_id",
  })
);
```

On iOS, the Apple Pay sheet lists your `paymentItems` and then a total labelled with `merchantName` ("Pay Your Store"). The library adds that total for you, so don't add your own "Total" item.

**Options:**

```typescript no-check
interface StartPaymentOptions {
  // Charge the token while the sheet waits (see "Charging before the sheet closes")
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>;
}

interface PaymentAuthorizationResult {
  status: "success" | "failure";
  error?: string; // Becomes PaymentResult.error on failure
}
```

**Returns:**

```typescript no-check
interface PaymentResult extends PaymentDetails {
  success: boolean;
  transactionId?: string;
  token?: PaymentToken;
  error?: string;
}

interface PaymentToken {
  paymentMethod: PaymentMethod;
  transactionIdentifier: string;
  paymentData: string; // Base64 encoded
}
```

##### `canMakePayments(usingNetworks: string[]): boolean`

Check if specific card networks are supported.

```typescript
import { HybridPaymentHandler } from "@gmisoftware/react-native-pay";

const canPay = HybridPaymentHandler.canMakePayments(["visa", "mastercard"]);
```

##### `isPaymentInProgress(): boolean`

Check whether a payment started with `startPayment` (directly or by `usePaymentCheckout`) has not settled yet. While it returns `true`, `startPayment` resolves with `{ success: false, error: "A payment is already in progress" }`.

```typescript
import { HybridPaymentHandler } from "@gmisoftware/react-native-pay";

const isBusy = HybridPaymentHandler.isPaymentInProgress();
```

---

### Button Components

Both buttons are Nitro views, so `onPress` must be wrapped with `callback()` from `react-native-nitro-modules`. A bare function does not reach the native button, and tapping it does nothing.

#### `ApplePayButton` (iOS)

Native Apple Pay button with full customization.

##### Props

```typescript no-check
interface ApplePayButtonProps {
  buttonType:
    | "buy"
    | "setUp"
    | "book"
    | "donate"
    | "continue"
    | "reload"
    | "addMoney"
    | "topUp"
    | "order"
    | "rent"
    | "support"
    | "contribute"
    | "tip";

  buttonStyle: "white" | "whiteOutline" | "black";

  onPress?: () => void; // wrap with callback() from react-native-nitro-modules
  style?: ViewStyle;
}
```

##### Example

```tsx
import { ApplePayButton } from "@gmisoftware/react-native-pay";
import { callback } from "react-native-nitro-modules";

const handlePayment = async () => {
  // Call startPayment() from usePaymentCheckout here
};

<ApplePayButton
  buttonType="buy"
  buttonStyle="black"
  onPress={callback(handlePayment)}
  style={{ width: '100%', height: 48 }}
/>
```

#### `GooglePayButton` (Android)

Native Google Pay button with customization.

##### Props

```typescript no-check
interface GooglePayButtonProps {
  buttonType:
    | "buy"
    | "book"
    | "checkout"
    | "donate"
    | "order"
    | "pay"
    | "subscribe"
    | "plain";

  theme: "dark" | "light";

  radius?: number; // Corner radius in dp

  onPress?: () => void; // wrap with callback() from react-native-nitro-modules
  style?: ViewStyle;
}
```

##### Example

```tsx
import { GooglePayButton } from "@gmisoftware/react-native-pay";
import { callback } from "react-native-nitro-modules";

const handlePayment = async () => {
  // Call startPayment() from usePaymentCheckout here
};

<GooglePayButton
  buttonType="buy"
  theme="dark"
  radius={8}
  onPress={callback(handlePayment)}
  style={{ width: '100%', height: 48 }}
/>
```

---

### Utility Functions

#### `createPaymentRequest(config)`

Create a complete payment request from simplified config.

```typescript
import { createPaymentRequest } from "@gmisoftware/react-native-pay";

const request = createPaymentRequest({
  amount: 29.99,
  label: "Coffee Subscription",
  merchantName: "Your Store",
  countryCode: "US",
  currencyCode: "USD",
  googlePayMerchantId: "your_google_pay_merchant_id",
  googlePayEnvironment: "TEST",
  googlePayGateway: "stripe",
  googlePayGatewayMerchantId: "your_merchant_id",
});
// request.paymentItems[0].amount === "29.99"
```

Throws if the amount is invalid for the currency (see [Amounts](#amounts)).

#### `normalizePaymentRequest(request)`

Validate every amount in a request you built yourself and convert it to an exact decimal string. `createPaymentRequest` and `usePaymentCheckout` call it for you.

```typescript no-check
import { normalizePaymentRequest } from "@gmisoftware/react-native-pay";

normalizePaymentRequest({ ...request, paymentItems: [{ label: "Book", amount: 19.9, type: "final" }] });
// paymentItems: [{ label: 'Book', amount: '19.90', type: 'final' }]
```

#### `createPaymentItem(label, amount, type)`

Create a payment item.

```typescript
import { createPaymentItem } from "@gmisoftware/react-native-pay";

const item = createPaymentItem("Subscription", "29.99", "final");
// { label: 'Subscription', amount: '29.99', type: 'final' }
```

#### `calculateTotal(items)`

Calculate the exact decimal total of payment items.

```typescript
import { calculateTotal, type PaymentItem } from "@gmisoftware/react-native-pay";

const items: PaymentItem[] = [
  { label: "Product", amount: 29.99, type: "final" },
  { label: "Tax", amount: 2.4, type: "final" },
];

const total = calculateTotal(items); // 32.39
```

#### `formatNetworkName(network)`

Format card network name for display.

```typescript
import { formatNetworkName } from "@gmisoftware/react-native-pay";

formatNetworkName("visa"); // "Visa"
formatNetworkName("mastercard"); // "Mastercard"
formatNetworkName("amex"); // "American Express"
```

---

## TypeScript Types

### Core Types

```typescript no-check
// Amount in the currency's major unit: "19.99" or 19.99 (see Amounts below)
type PaymentAmount = number | string;

// Payment Item
interface PaymentItem {
  label: string;
  amount: PaymentAmount;
  type: "final" | "pending";
}

// Payment Request
interface PaymentRequest {
  applePayMerchantIdentifier?: string;
  merchantName?: string; // "Pay <merchantName>" on Apple Pay; defaults to the app name
  countryCode: string;
  currencyCode: string;
  paymentItems: PaymentItem[];
  merchantCapabilities: string[]; // MerchantCapability values
  supportedNetworks: string[];
  shippingType?: string; // ShippingType value, iOS only
  shippingMethods?: ShippingMethod[]; // → PaymentResult.shippingMethod
  billingContactRequired?: boolean; // → PaymentResult.billingContact
  shippingContactRequired?: boolean; // → PaymentResult.shippingContact
  emailRequired?: boolean; // → PaymentResult.emailAddress
  phoneNumberRequired?: boolean; // → PaymentResult.phoneNumber
  // Google Pay specific
  googlePayMerchantId?: string;
  googlePayEnvironment?: "TEST" | "PRODUCTION";
  googlePayGateway?: string;
  googlePayGatewayMerchantId?: string;
}

// Payment Result
interface PaymentResult extends PaymentDetails {
  success: boolean;
  transactionId?: string;
  token?: PaymentToken;
  error?: string;
}

// Payment Token
interface PaymentToken {
  paymentMethod: PaymentMethod;
  transactionIdentifier: string;
  paymentData: string; // Base64 encoded
}

// Payment Method
interface PaymentMethod {
  displayName?: string;
  network?: PaymentNetwork;
  type: PaymentMethodType;
  secureElementPass?: PKSecureElementPass;
  billingAddress?: CNContact;
}

// Payment Networks
type PaymentNetwork =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "jcb"
  | "maestro"
  | "electron"
  | "elo"
  | "idcredit"
  | "interac"
  | "privateLabel";

// Payment Method Type
type PaymentMethodType = "unknown" | "debit" | "credit" | "prepaid" | "store";

// Apple Pay merchant capabilities
type MerchantCapability = "3DS" | "EMV" | "Credit" | "Debit";
```

### Amounts

Amounts are numbers (`19.99`) or decimal strings (`"19.99"`) in the currency's major unit. Before a payment starts, the library validates them and sends them to native code as exact decimal strings (`NSDecimalNumber` on iOS, `BigDecimal` on Android), never through `Double`. The payment does not start when:

- an amount is not a finite number or a plain decimal string (`NaN`, `"abc"`, `"1e3"`);
- an amount has more decimal places than the currency allows (ISO 4217: `1.005` in USD, `"1200.5"` in JPY). This includes unrounded float results such as `0.1 + 0.2`; round them with `formatAmount(value, currencyCode)`;
- the total is negative. Negative line items (discounts) are allowed.

Google Pay accepts at most two decimal places, so three-decimal amounts (`"1.234"` KWD) fail on Android.

### Merchant capabilities

`merchantCapabilities` is used by Apple Pay only. `"3DS"` and `"EMV"` are payment protocols, and PassKit needs at least one of them: EMV only covers China UnionPay, so every other card needs 3DS. `"Credit"` and `"Debit"` limit the accepted card types. iOS matches the values case-insensitively and adds `"3DS"` when neither protocol is given, so `["Credit"]` is sent as 3DS + Credit. Any other value fails the payment with `Unknown merchant capability "<value>". Use "3DS", "EMV", "Credit" or "Debit"`.

### Shipping and contact details

Set `billingContactRequired`, `shippingContactRequired`, `emailRequired` or `phoneNumberRequired` to ask the payer for a billing address, a shipping address, an email address or a phone number. Each one fills `billingContact`, `shippingContact`, `emailAddress` or `phoneNumber` in the result and in the second argument of `onAuthorize`, on both platforms. Google Pay only collects a phone number with an address: without `shippingContactRequired`, Android asks for it with at least the billing name, country and postal code.

`shippingMethods` (with `HybridPaymentHandler`) lets the payer pick a delivery option; the selected method is added to the total and returned as `shippingMethod`. The first one is selected by default on iOS. Google Pay cannot offer a choice yet, so Android charges the first method. See the [contact details guide](https://gmi-software.github.io/react-native-pay/docs/guides/contact-details).

`shippingType` (`"shipping"`, `"delivery"`, `"storePickup"` or `"servicePickup"`) only changes Apple Pay's labels. An unknown value fails the payment on iOS.

### Contact Types

```typescript no-check
interface PaymentDetails {
  billingContact?: PaymentContact; // billingContactRequired
  shippingContact?: PaymentContact; // shippingContactRequired
  emailAddress?: string; // emailRequired
  phoneNumber?: string; // phoneNumberRequired
  shippingMethod?: ShippingMethod; // the selected entry of shippingMethods
}

interface ShippingMethod {
  identifier: string; // unique within the request
  label: string;
  amount: PaymentAmount; // added to the total while selected
  detail?: string;
}

interface PaymentContact {
  name?: string;
  givenName?: string; // iOS only
  familyName?: string; // iOS only
  postalAddress?: CNPostalAddress; // isoCountryCode is uppercase
}

interface CNContact {
  identifier: string;
  contactType: "person" | "organization";
  namePrefix: string;
  givenName: string;
  middleName: string;
  familyName: string;
  previousFamilyName: string;
  nameSuffix: string;
  nickname: string;
  organizationName: string;
  departmentName: string;
  jobTitle: string;
  phoneticGivenName: string;
  phoneticMiddleName: string;
  phoneticFamilyName: string;
  phoneticOrganizationName?: string;
  note: string;
  imageDataAvailable?: boolean;
  phoneNumbers: CNLabeledPhoneNumber[];
  emailAddresses: CNLabeledEmailAddress[];
  postalAddresses: CNLabeledPostalAddress[];
}

interface CNPostalAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isoCountryCode?: string;
}
```

---

## Advanced Usage

### Manual Payment Flow (Without Hook)

For advanced use cases where you need more control:

```tsx
import {
  HybridPaymentHandler,
  createPaymentRequest,
  ApplePayButton,
  GooglePayButton,
} from '@gmisoftware/react-native-pay'
import { Platform } from 'react-native'
import { callback } from 'react-native-nitro-modules'

// 1. Check availability
const { canMakePayments } = HybridPaymentHandler.payServiceStatus()

// 2. Create payment request
const paymentRequest = createPaymentRequest({
  amount: 99.99,
  label: 'Premium Subscription',
  merchantName: 'Your Store',
  countryCode: 'US',
  currencyCode: 'USD',
  googlePayMerchantId: 'your_google_pay_merchant_id',
  googlePayEnvironment: 'PRODUCTION',
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_merchant_id',
})

// 3. Handle payment
const handlePayment = async () => {
  try {
    const result = await HybridPaymentHandler.startPayment(paymentRequest)

    if (result.success && result.token) {
      // Send the token to your server
      const response = await fetch('https://api.yourserver.com/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: result.token }),
      })
      if (!response.ok) throw new Error('Payment processing failed')
    } else {
      console.error('Payment failed:', result.error)
    }
  } catch (error) {
    console.error('Payment error:', error)
  }
}

// 4. Render the button. onPress must be wrapped with callback().
function PaymentButton() {
  if (!canMakePayments) return null

  return Platform.OS === 'ios' ? (
    <ApplePayButton
      buttonType="buy"
      buttonStyle="black"
      onPress={callback(handlePayment)}
    />
  ) : (
    <GooglePayButton
      buttonType="subscribe"
      theme="dark"
      onPress={callback(handlePayment)}
    />
  )
}
```

### Dynamic Cart Management

```typescript
import { formatAmount, usePaymentCheckout } from "@gmisoftware/react-native-pay";

const checkout = usePaymentCheckout({
  merchantName: "Your Store",
  currencyCode: "USD",
});

// Add items dynamically
const handleAddToCart = (product: { name: string; price: number }) => {
  checkout.addItem(product.name, product.price);
};

// Update quantity
const handleUpdateQuantity = (index: number, quantity: number) => {
  const item = checkout.items[index];
  checkout.updateItem(index, {
    amount: formatAmount(Number(item.amount) * quantity),
  });
};

// Apply discount
const handleApplyDiscount = (discountPercent: number) => {
  const discountAmount = checkout.total * (discountPercent / 100);
  checkout.addItem("Discount", formatAmount(-discountAmount), "final");
};

// Clear cart
const handleClearCart = () => {
  checkout.clearItems();
};
```

### Custom Payment Buttons

Create your own styled buttons:

```tsx
import { Platform, Pressable, Text } from 'react-native'

function CustomPayButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#000',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: 'bold' }}>
        {Platform.OS === 'ios' ? '  Pay' : 'G Pay'}
      </Text>
    </Pressable>
  )
}

// Use it with your handler, for example one that calls startPayment()
const handlePayment = async () => {}

<CustomPayButton onPress={handlePayment} />
```

### Charging Before the Sheet Closes

Pass `onAuthorize` to charge the token while the Apple Pay sheet is still up. The sheet then shows your real outcome instead of an unconditional success:

```typescript
import { useEffect } from "react";
import { usePaymentCheckout } from "@gmisoftware/react-native-pay";

const order = { id: "order_123", label: "Premium plan", total: "49.99" }; // your order

function useOrderPayment() {
  const checkout = usePaymentCheckout({
    currencyCode: "USD",
    onAuthorize: async (token) => {
      const response = await fetch("https://api.yourserver.com/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderId: order.id }),
      });
      return response.ok
        ? { status: "success" }
        : { status: "failure", error: "Payment failed" };
    },
  });
  const { addItem, clearItems } = checkout;

  // startPayment() returns null for an empty cart, so fill it before the tap.
  useEffect(() => {
    addItem(order.label, order.total);
    return clearItems;
  }, [addItem, clearItems]);

  return async () => {
    const result = await checkout.startPayment();
    // result?.success reflects your server's answer
  };
}
```

- `onAuthorize` must settle within 25 seconds. Otherwise the payment fails with "Payment authorization timed out", and its later result is ignored. Your server may still have charged the card.
- **Retries on iOS:** after a failure or a timeout the user can retry from the same sheet, and `onAuthorize` runs again with a new token. Make your server charge idempotent per order ID, not per token.
- A rejected promise counts as a failure.
- **Android:** Google Pay closes its sheet before returning the token, so `onAuthorize` runs afterwards and only decides the `PaymentResult`.

### Server-Side Processing

After receiving the payment token, process it on your server:

#### Node.js + Stripe Example

```javascript
// Backend API endpoint
app.post("/process-payment", async (req, res) => {
  const { token } = req.body;

  try {
    // For Apple Pay
    if (token.paymentData) {
      const charge = await stripe.charges.create({
        amount: 2999, // $29.99
        currency: "usd",
        source: token.paymentData, // Apple Pay token
        description: "Payment from React Native Pay",
      });
    }

    // For Google Pay
    // The token format depends on your gateway

    res.json({ success: true, chargeId: charge.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Architecture

### Package Structure

```
@gmisoftware/react-native-pay/
├── android/                          # Android implementation
│   ├── src/main/java/com/margelo/nitro/pay/
│   │   ├── Constants.kt              # Shared constants
│   │   ├── GooglePayButtonFactory.kt # Button factory
│   │   ├── GooglePayRequestBuilder.kt # Request builder
│   │   ├── HybridGooglePayButton.kt  # Button component
│   │   ├── HybridPaymentHandler.kt   # Payment handler
│   │   └── PaymentMapper.kt          # Data transformation
│   ├── build.gradle
│   └── CMakeLists.txt
│
├── ios/                              # iOS implementation
│   ├── ApplePayButtonFactory.swift   # Button factory
│   ├── HybridApplePayButton.swift    # Button component
│   ├── HybridPaymentHandler.swift    # Payment handler
│   └── PassKitTypeMapper.swift       # Type conversion
│
├── src/                              # TypeScript source
│   ├── specs/                        # Nitro specifications
│   │   ├── ApplePayButton.nitro.ts
│   │   ├── GooglePayButton.nitro.ts
│   │   └── PaymentHandler.nitro.ts
│   ├── types/                        # Type definitions
│   │   ├── Contact.ts                # Contact types
│   │   ├── Payment.ts                # Payment types
│   │   └── index.ts
│   ├── utils/                        # Utilities
│   │   ├── paymentHelpers.ts
│   │   └── index.ts
│   ├── hooks/                        # React hooks
│   │   ├── usePaymentCheckout.ts
│   │   └── index.ts
│   ├── plugin/                       # Expo config plugins
│   │   ├── withApplePay.ts
│   │   ├── withGooglePay.ts
│   │   └── index.ts
│   └── index.ts                      # Public API
│
├── nitrogen/                         # Generated code
│   └── generated/
│       ├── android/
│       ├── ios/
│       └── shared/
│
└── package.json
```

### Design Principles

1. **Platform Abstraction** - Single API for both iOS and Android
2. **Type Safety** - Full TypeScript coverage with runtime validation
3. **Performance** - Built with Nitro Modules for native speed
4. **Developer Experience** - Simple hooks API with sensible defaults
5. **Production Focused** - Designed around backend-controlled payment flows

---

## Troubleshooting

### iOS Issues

#### Apple Pay button not showing

- Verify merchant ID is correctly configured in Apple Developer Portal
- Check that entitlements are properly set in your Xcode project
- Ensure you've run `npx expo prebuild --clean`
- Test on a real device (Simulator requires additional setup)

#### "Cannot make payments" error

- Add a card to Apple Wallet on your test device
- Verify your merchant ID matches exactly
- Check that Apple Pay is enabled in Settings > Wallet & Apple Pay

### Android Issues

#### Google Pay button not showing

- Verify Google Pay is enabled in your AndroidManifest.xml
- Check that `enableGooglePay: true` is set in your plugin config
- Ensure Google Play Services is installed on the device
- Test with a real device (Emulator needs Google Play Services)

#### "Google Pay unavailable" error

- Add a card to Google Pay on your test device
- For testing, use `googlePayEnvironment: 'TEST'`
- Verify your gateway configuration is correct

### General Issues

#### Build errors with Nitro

```bash
# Clean and reinstall
rm -rf node_modules
rm -rf ios/Pods ios/build
rm -rf android/build android/app/build
npm install
cd ios && pod install
```

#### Type errors

```bash
# Regenerate types
cd package
npm run typescript
npm run specs
```

---

## Examples

Check out the `/example` directory for a complete working implementation with:

- Full checkout flow
- Cart management
- Error handling
- Platform-specific UI

Run the example:

```bash
cd example
npm install
npx expo prebuild
npx expo run:ios
npx expo run:android
```

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/gmi-software/react-native-pay.git
cd react-native-pay

# Install dependencies
npm install
cd package && npm install

# Generate Nitro bindings
cd package
npm run specs
```

### Code Style

- Follow existing TypeScript patterns
- Add JSDoc comments for public APIs
- Use Prettier for formatting (runs automatically)
- Ensure types are properly exported

### Testing

- Test on both iOS and Android
- Test with real devices (Simulator/Emulator support limited)
- Verify in both TEST and PRODUCTION modes

### Pull Requests

- Create a feature branch from `main`
- Write descriptive commit messages
- Update documentation for API changes
- Add examples for new features

---

## Roadmap

- [ ] Recurring payment support
- [x] Shipping address collection
- [ ] Multi-currency support
- [ ] Payment request validation
- [ ] Automated testing suite
- [ ] Detailed transaction logging
- [ ] Web support (via Payment Request API)

---

## License

MIT © [GMI Software](https://gmi.software)

---

## Credits

- Built with [Nitro Modules](https://nitro.margelo.com/) by [Margelo](https://margelo.com/)
- Developed by [GMI Software](https://gmi.software)

---

## Support

- 📧 Email: [info@gmi.software](mailto:info@gmi.software)
- 🐛 Issues: [GitHub Issues](https://github.com/gmi-software/react-native-pay/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/gmi-software/react-native-pay/discussions)

---

<div align="center">

Made with ❤️ by [gmi.software](https://gmi.software)

</div>
