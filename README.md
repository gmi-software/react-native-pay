# React Native Pay

<div align="center">

A unified React Native payment module supporting **Apple Pay** (iOS) and **Google Pay** (Android) with a consistent, type-safe API.

[![npm version](https://img.shields.io/npm/v/@gmisoftware/react-native-pay.svg)](https://www.npmjs.com/package/@gmisoftware/react-native-pay)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Expo Compatible](https://img.shields.io/badge/Expo-Compatible-000020.svg)](https://expo.dev/)

Built with [Nitro Modules](https://nitro.margelo.com/) for high-performance native integration.

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [Documentation](#documentation) • [API Reference](#api-reference)

</div>

---

## Features

- ✅ **Unified API** - Single interface for both Apple Pay and Google Pay
- ✅ **One Hook Does Everything** - Complete payment flow with `usePaymentCheckout()` hook
- ✅ **Native UI Components** - Platform-specific payment buttons with full customization
- ✅ **Type-Safe** - Comprehensive TypeScript definitions with full IntelliSense support
- ✅ **Configurable** - Dynamic environment and gateway configuration for both platforms
- ✅ **Built-in Cart** - Shopping cart functionality with batch operations
- ✅ **Modern Architecture** - Built with Nitro Modules for optimal performance
- ✅ **Expo Compatible** - Config plugins for seamless Expo integration
- ✅ **Production Ready** - Used in production apps with millions of transactions

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
- React Native Nitro Modules 0.31.4+ (required)
- Expo 53+ (if using Expo)

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

```typescript
import React from 'react'
import {
  usePaymentCheckout,
  ApplePayButton,
  GooglePayButton,
} from '@gmisoftware/react-native-pay'
import { Platform, View, Text, Button, ActivityIndicator } from 'react-native'

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
    merchantIdentifier: 'merchant.com.yourcompany.app',
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
          <Text>{item.label}: ${item.amount.toFixed(2)}</Text>
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
            onPress={handlePay}
            style={{ width: '100%', height: 48 }}
          />
        ) : (
          <GooglePayButton
            buttonType="buy"
            theme="dark"
            radius={4}
            onPress={handlePay}
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
const checkout = usePaymentCheckout({
  merchantIdentifier: 'merchant.com.yourcompany.app',
  currencyCode: 'USD',
  countryCode: 'US',
  // Google Pay specific
  googlePayEnvironment: 'TEST', // or 'PRODUCTION'
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_stripe_merchant_id',
})
```

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

```typescript
interface UsePaymentCheckoutConfig {
  merchantIdentifier: string
  merchantName?: string
  countryCode?: string // Default: 'US'
  currencyCode?: string // Default: 'USD'
  supportedNetworks?: string[] // Default: ['visa', 'mastercard', 'amex', 'discover']
  merchantCapabilities?: string[] // Default: ['3DS']
  // Google Pay specific (Android)
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
}
```

#### Returns

```typescript
interface UsePaymentCheckoutReturn {
  // Payment availability
  canMakePayments: boolean // Can user make payments?
  canSetupCards: boolean // Can user add cards?
  isCheckingStatus: boolean // Loading state for availability check

  // Cart management
  items: PaymentItem[] // Current cart items
  total: number // Total amount
  addItem: (label: string, amount: number, type?: 'final' | 'pending') => void
  addItems: (items: Array<{ label; amount; type? }>) => void
  removeItem: (index: number) => void
  updateItem: (index: number, updates: Partial<PaymentItem>) => void
  clearItems: () => void

  // Payment processing
  startPayment: () => Promise<PaymentResult | null>
  isProcessing: boolean // Payment in progress?
  result: PaymentResult | null // Last payment result
  error: Error | null // Last error

  // Utilities
  reset: () => void // Reset payment state
  paymentRequest: PaymentRequest // Full request object
}
```

#### Example

```typescript
const checkout = usePaymentCheckout({
  merchantIdentifier: 'merchant.com.example',
  currencyCode: 'USD',
  countryCode: 'US',
  googlePayEnvironment: 'TEST',
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_stripe_merchant_id',
})

// Add single item
checkout.addItem('Product', 29.99)

// Add multiple items at once
checkout.addItems([
  { label: 'Product', amount: 29.99 },
  { label: 'Shipping', amount: 5.0 },
  { label: 'Tax', amount: 2.8, type: 'final' },
])

// Process payment
const result = await checkout.startPayment()
```

---

### `HybridPaymentHandler`

Low-level payment handler for direct control.

#### Methods

##### `payServiceStatus(): PayServiceStatus`

Check payment service availability.

```typescript
const status = HybridPaymentHandler.payServiceStatus()
console.log('Can make payments:', status.canMakePayments)
console.log('Can setup cards:', status.canSetupCards)
```

**Returns:**

```typescript
interface PayServiceStatus {
  canMakePayments: boolean
  canSetupCards: boolean
}
```

##### `startPayment(request: PaymentRequest): Promise<PaymentResult>`

Start a payment request.

```typescript
const result = await HybridPaymentHandler.startPayment({
  merchantIdentifier: 'merchant.com.example',
  countryCode: 'US',
  currencyCode: 'USD',
  merchantCapabilities: ['3DS'],
  supportedNetworks: ['visa', 'mastercard', 'amex'],
  paymentItems: [{ label: 'Total', amount: 29.99, type: 'final' }],
})
```

**Returns:**

```typescript
interface PaymentResult {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
}

interface PaymentToken {
  paymentMethod: PaymentMethod
  transactionIdentifier: string
  paymentData: string // Base64 encoded
}
```

##### `canMakePayments(usingNetworks: string[]): boolean`

Check if specific card networks are supported.

```typescript
const canPay = HybridPaymentHandler.canMakePayments(['visa', 'mastercard'])
```

---

### Button Components

#### `ApplePayButton` (iOS)

Native Apple Pay button with full customization.

##### Props

```typescript
interface ApplePayButtonProps {
  buttonType?:
    | 'plain'
    | 'buy'
    | 'setUp'
    | 'inStore'
    | 'donate'
    | 'checkout'
    | 'book'
    | 'subscribe'
    | 'reload'
    | 'addMoney'
    | 'topUp'
    | 'order'
    | 'rent'
    | 'support'
    | 'contribute'
    | 'tip'

  buttonStyle?: 'white' | 'whiteOutline' | 'black' | 'automatic'

  onPress: () => void
  style?: ViewStyle
}
```

##### Example

```typescript
<ApplePayButton
  buttonType="buy"
  buttonStyle="black"
  onPress={handlePayment}
  style={{ width: '100%', height: 48 }}
/>
```

#### `GooglePayButton` (Android)

Native Google Pay button with customization.

##### Props

```typescript
interface GooglePayButtonProps {
  buttonType?:
    | 'buy'
    | 'book'
    | 'checkout'
    | 'donate'
    | 'order'
    | 'pay'
    | 'subscribe'
    | 'plain'

  theme?: 'dark' | 'light'

  radius?: number // Corner radius in dp

  onPress: () => void
  style?: ViewStyle
}
```

##### Example

```typescript
<GooglePayButton
  buttonType="buy"
  theme="dark"
  radius={8}
  onPress={handlePayment}
  style={{ width: '100%', height: 48 }}
/>
```

---

### Utility Functions

#### `createPaymentRequest(config)`

Create a complete payment request from simplified config.

```typescript
import { createPaymentRequest } from '@gmisoftware/react-native-pay'

const request = createPaymentRequest({
  merchantIdentifier: 'merchant.com.example',
  amount: 29.99,
  label: 'Coffee Subscription',
  countryCode: 'US',
  currencyCode: 'USD',
  googlePayEnvironment: 'TEST',
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_merchant_id',
})
```

#### `createPaymentItem(label, amount, type)`

Create a payment item.

```typescript
import { createPaymentItem } from '@gmisoftware/react-native-pay'

const item = createPaymentItem('Subscription', 29.99, 'final')
// { label: 'Subscription', amount: 29.99, type: 'final' }
```

#### `calculateTotal(items)`

Calculate total from payment items.

```typescript
import { calculateTotal } from '@gmisoftware/react-native-pay'

const items = [
  { label: 'Product', amount: 29.99, type: 'final' },
  { label: 'Tax', amount: 2.4, type: 'final' },
]

const total = calculateTotal(items) // 32.39
```

#### `formatNetworkName(network)`

Format card network name for display.

```typescript
import { formatNetworkName } from '@gmisoftware/react-native-pay'

formatNetworkName('visa') // "Visa"
formatNetworkName('mastercard') // "Mastercard"
formatNetworkName('amex') // "American Express"
```

---

## TypeScript Types

### Core Types

```typescript
// Payment Item
interface PaymentItem {
  label: string
  amount: number
  type: 'final' | 'pending'
}

// Payment Request
interface PaymentRequest {
  merchantIdentifier: string
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
  // Google Pay specific
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
}

// Payment Result
interface PaymentResult {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
}

// Payment Token
interface PaymentToken {
  paymentMethod: PaymentMethod
  transactionIdentifier: string
  paymentData: string // Base64 encoded
}

// Payment Method
interface PaymentMethod {
  displayName?: string
  network?: PaymentNetwork
  type: PaymentMethodType
  secureElementPass?: PKSecureElementPass
  billingAddress?: CNContact
}

// Payment Networks
type PaymentNetwork =
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

// Payment Method Type
type PaymentMethodType = 'unknown' | 'debit' | 'credit' | 'prepaid' | 'store'
```

### Contact Types

```typescript
interface CNContact {
  identifier: string
  contactType: 'person' | 'organization'
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

interface CNPostalAddress {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  isoCountryCode?: string
}
```

---

## Advanced Usage

### Manual Payment Flow (Without Hook)

For advanced use cases where you need more control:

```typescript
import {
  HybridPaymentHandler,
  createPaymentRequest,
  ApplePayButton,
  GooglePayButton,
} from '@gmisoftware/react-native-pay'
import { Platform } from 'react-native'

// 1. Check availability
const status = HybridPaymentHandler.payServiceStatus()
if (!status.canMakePayments) {
  console.log('Payment not available')
  return
}

// 2. Create payment request
const paymentRequest = createPaymentRequest({
  merchantIdentifier: 'merchant.com.example',
  amount: 99.99,
  label: 'Premium Subscription',
  countryCode: 'US',
  currencyCode: 'USD',
  googlePayEnvironment: 'PRODUCTION',
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_merchant_id',
})

// 3. Handle payment
const handlePayment = async () => {
  try {
    const result = await HybridPaymentHandler.startPayment(paymentRequest)

    if (result.success && result.token) {
      // Send to your server
      await processPaymentOnServer(result.token)
    } else {
      console.error('Payment failed:', result.error)
    }
  } catch (error) {
    console.error('Payment error:', error)
  }
}

// 4. Render button
return Platform.OS === 'ios' ? (
  <ApplePayButton
    buttonType="subscribe"
    buttonStyle="black"
    onPress={handlePayment}
  />
) : (
  <GooglePayButton
    buttonType="subscribe"
    theme="dark"
    onPress={handlePayment}
  />
)
```

### Dynamic Cart Management

```typescript
const checkout = usePaymentCheckout({
  merchantIdentifier: 'merchant.com.example',
  currencyCode: 'USD',
})

// Add items dynamically
const handleAddToCart = (product) => {
  checkout.addItem(product.name, product.price)
}

// Update quantity
const handleUpdateQuantity = (index, quantity) => {
  const item = checkout.items[index]
  checkout.updateItem(index, {
    amount: item.amount * quantity,
  })
}

// Apply discount
const handleApplyDiscount = (discountPercent) => {
  const discountAmount = checkout.total * (discountPercent / 100)
  checkout.addItem('Discount', -discountAmount, 'final')
}

// Clear cart
const handleClearCart = () => {
  checkout.clearItems()
}
```

### Custom Payment Buttons

Create your own styled buttons:

```typescript
import { Pressable, Text } from 'react-native'

function CustomPayButton({ onPress }) {
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

// Use it
<CustomPayButton onPress={handlePayment} />
```

### Server-Side Processing

After receiving the payment token, process it on your server:

#### Node.js + Stripe Example

```javascript
// Backend API endpoint
app.post('/process-payment', async (req, res) => {
  const { token } = req.body

  try {
    // For Apple Pay
    if (token.paymentData) {
      const charge = await stripe.charges.create({
        amount: 2999, // $29.99
        currency: 'usd',
        source: token.paymentData, // Apple Pay token
        description: 'Payment from React Native Pay',
      })
    }

    // For Google Pay
    // The token format depends on your gateway

    res.json({ success: true, chargeId: charge.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
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
5. **Production Ready** - Battle-tested in real-world applications

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
- [ ] Shipping address collection
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

- 📧 Email: [support@gmi.software](mailto:support@gmi.software)
- 🐛 Issues: [GitHub Issues](https://github.com/gmi-software/react-native-pay/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/gmi-software/react-native-pay/discussions)

---

<div align="center">

Made with ❤️ by [GMI Software](https://gmi.software)

</div>
