# react-native-pay

A unified React Native payment module supporting both Apple Pay (iOS) and Google Pay (Android) with a consistent API across platforms.

Built with [Nitro Modules](https://nitro.margelo.com/) for high-performance native integration.

## Features

- ✅ **Unified API** - Same interface for both Apple Pay and Google Pay
- ✅ **One Hook Does Everything** - Simple `usePaymentCheckout()` hook for complete payment flow
- ✅ **Native UI Components** - Platform-specific payment buttons
- ✅ **Type-Safe** - Full TypeScript support with comprehensive type definitions
- ✅ **Configurable** - Dynamic environment and gateway configuration
- ✅ **Built-in Cart** - Shopping cart functionality included
- ✅ **Modern Architecture** - Built with Nitro Modules for optimal performance
- ✅ **Expo Compatible** - Config plugins for easy integration with Expo

## Installation

```bash
npm install react-native-pay
# or
yarn add react-native-pay
# or
bun add react-native-pay
```

### iOS Setup

Add Apple Pay capability to your app and configure merchant identifiers in your Expo config:

```js
// app.json or app.config.js
{
  "plugins": [
    [
      "react-native-pay",
      {
        "merchantIdentifier": "merchant.com.yourcompany.app"
      }
    ]
  ]
}
```

### Android Setup

Enable Google Pay in your Expo config:

```js
// app.json or app.config.js
{
  "plugins": [
    [
      "react-native-pay",
      {
        "enableGooglePay": true
      }
    ]
  ]
}
```

## Usage

### Using the Hook (Recommended)

One hook does everything - availability checking, cart management, and payment processing:

```typescript
import {
  usePaymentCheckout,
  ApplePayButton,
  GooglePayButton,
} from 'react-native-pay'
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

  // Add single item
  const handleAddCoffee = () => addItem('Coffee', 4.99)

  // Add multiple items at once
  const handleAddFullOrder = () => addItems([
    { label: 'Coffee', amount: 4.99 },
    { label: 'Sandwich', amount: 8.99 },
    { label: 'Tax', amount: 1.20 }
  ])

  const handlePay = async () => {
    const result = await startPayment()
    if (result?.success) {
      // Send result.token to your server
      console.log('Payment successful:', result.transactionId)
    }
  }

  if (!canMakePayments) {
    return <Text>Payment not available</Text>
  }

  return (
    <View>
      <Button title="Add Coffee $4.99" onPress={handleAddCoffee} />
      <Button title="Add Full Order" onPress={handleAddFullOrder} />

      {items.map((item, i) => (
        <View key={i}>
          <Text>{item.label}: ${item.amount}</Text>
          <Button title="Remove" onPress={() => removeItem(i)} />
        </View>
      ))}

      <Text>Total: ${total.toFixed(2)}</Text>

      {error && <Text style={{ color: 'red' }}>{error.message}</Text>}

      {isProcessing ? (
        <ActivityIndicator />
      ) : (
        Platform.OS === 'ios' ? (
          <ApplePayButton onPress={handlePay} buttonType="buy" buttonStyle="black" />
        ) : (
          <GooglePayButton onPress={handlePay} buttonType="buy" theme="dark" />
        )
      )}
    </View>
  )
}
```

### Basic Payment Flow (Without Hooks)

```typescript
import {
  HybridPaymentHandler,
  ApplePayButton,
  GooglePayButton,
  createPaymentRequest,
} from 'react-native-pay'
import { Platform } from 'react-native'

// Check if payment service is available
const status = HybridPaymentHandler.payServiceStatus()
console.log('Can make payments:', status.canMakePayments)

// Create a payment request
const paymentRequest = createPaymentRequest({
  merchantIdentifier: 'merchant.com.yourcompany.app',
  amount: 29.99,
  label: 'Coffee Subscription',
  countryCode: 'US',
  currencyCode: 'USD',
  // Google Pay specific (optional)
  googlePayEnvironment: 'TEST', // or 'PRODUCTION'
  googlePayGateway: 'stripe',
  googlePayGatewayMerchantId: 'your_gateway_merchant_id',
})

// Handle payment
const handlePayment = async () => {
  try {
    const result = await HybridPaymentHandler.startPayment(paymentRequest)

    if (result.success) {
      console.log('Payment successful:', result.transactionId)
      console.log('Payment token:', result.token)
      // Send token to your server for processing
    } else {
      console.error('Payment failed:', result.error)
    }
  } catch (error) {
    console.error('Payment error:', error)
  }
}

// Render platform-specific button
{Platform.OS === 'ios' ? (
  <ApplePayButton
    buttonType="buy"
    buttonStyle="black"
    onPress={handlePayment}
    style={{ width: '100%', height: 48 }}
  />
) : (
  <GooglePayButton
    buttonType="buy"
    theme="dark"
    radius={4}
    onPress={handlePayment}
    style={{ width: '100%', height: 48 }}
  />
)}
```

### Payment Request Configuration

```typescript
interface PaymentRequest {
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
  // Google Pay specific (Android only)
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
}
```

### Utility Helpers

The package includes helpful utilities for common operations:

```typescript
import {
  createPaymentItem,
  calculateTotal,
  formatNetworkName,
} from 'react-native-pay'

// Create payment items
const item1 = createPaymentItem('Subscription', 29.99, 'final')
const item2 = createPaymentItem('Tax', 2.4, 'final')

// Calculate total
const total = calculateTotal([item1, item2]) // 32.39

// Format network names
formatNetworkName('visa') // "Visa"
formatNetworkName('amex') // "American Express"
```

## API Reference

### React Hook

#### `usePaymentCheckout(config)`

All-in-one hook for payment checkout flow.

**Configuration:**

```typescript
{
  merchantIdentifier: string
  countryCode?: string              // Default: 'US'
  currencyCode?: string              // Default: 'USD'
  supportedNetworks?: string[]       // Default: ['visa', 'mastercard', 'amex', 'discover']
  merchantCapabilities?: string[]    // Default: ['3DS']
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
}
```

**Returns:**

```typescript
{
  // Payment availability
  canMakePayments: boolean
  canSetupCards: boolean
  isCheckingStatus: boolean

  // Cart management
  items: PaymentItem[]
  total: number
  addItem: (label: string, amount: number, type?: 'final' | 'pending') => void
  addItems: (items: Array<{ label, amount, type? }>) => void  // Add multiple at once
  removeItem: (index: number) => void
  updateItem: (index: number, updates: Partial<PaymentItem>) => void
  clearItems: () => void

  // Payment processing
  startPayment: () => Promise<PaymentResult | null>
  isProcessing: boolean
  result: PaymentResult | null
  error: Error | null

  // Utilities
  reset: () => void
  paymentRequest: PaymentRequest  // Full request object
}
```

**Example:**

```typescript
const checkout = usePaymentCheckout({
  merchantIdentifier: 'merchant.com.example',
  currencyCode: 'USD',
  countryCode: 'US',
})

// Add single item
checkout.addItem('Product', 29.99)

// Add multiple items at once
checkout.addItems([
  { label: 'Product', amount: 29.99 },
  { label: 'Shipping', amount: 5.0 },
  { label: 'Tax', amount: 2.8, type: 'final' },
])

// Check total
console.log(checkout.total) // 37.79

// Process payment
const result = await checkout.startPayment()
if (result?.success) {
  // Handle success
}
```

### HybridPaymentHandler

#### `payServiceStatus(): PayServiceStatus`

Returns the current payment service availability.

```typescript
const status = HybridPaymentHandler.payServiceStatus()
console.log(status.canMakePayments) // boolean
console.log(status.canSetupCards) // boolean
```

#### `startPayment(request: PaymentRequest): Promise<PaymentResult>`

Initiates a payment request.

```typescript
const result = await HybridPaymentHandler.startPayment(paymentRequest)
```

#### `canMakePayments(usingNetworks: string[]): boolean`

Checks if the device can make payments using specific networks.

```typescript
const canPay = HybridPaymentHandler.canMakePayments(['visa', 'mastercard'])
```

### Button Components

#### ApplePayButton (iOS)

```typescript
<ApplePayButton
  buttonType="buy" | "setup" | "book" | "donate" | "order" | "continue" | ...
  buttonStyle="white" | "black" | "whiteOutline" | "automatic"
  onPress={() => handlePayment()}
  style={styles.button}
/>
```

#### GooglePayButton (Android)

```typescript
<GooglePayButton
  buttonType="buy" | "book" | "checkout" | "donate" | "order" | "pay" | "subscribe" | "plain"
  theme="dark" | "light"
  radius={4} // optional corner radius
  onPress={() => handlePayment()}
  style={styles.button}
/>
```

## Architecture

### Package Structure

```
package/
├── android/                          # Android implementation
│   └── src/main/java/com/.../pay/
│       ├── Constants.kt              # Shared constants
│       ├── GooglePayButtonFactory.kt # Button creation utility
│       ├── GooglePayRequestBuilder.kt # Payment request builder
│       ├── HybridGooglePayButton.kt  # Button component
│       ├── HybridPaymentHandler.kt   # Payment handler
│       ├── NitroPayPackage.kt        # RN package
│       └── PaymentMapper.kt          # Data mapper
├── ios/                              # iOS implementation
│   ├── ApplePayButtonFactory.swift   # Button creation utility
│   ├── HybridApplePayButton.swift    # Button component
│   ├── HybridPaymentHandler.swift    # Payment handler
│   └── PassKitTypeMapper.swift       # Type converter
├── src/                              # TypeScript/JavaScript
│   ├── specs/                        # Nitro type specs
│   │   ├── ApplePayButton.nitro.ts
│   │   ├── GooglePayButton.nitro.ts
│   │   └── PaymentHandler.nitro.ts
│   ├── types/                        # Type definitions
│   │   ├── Contact.ts
│   │   └── Payment.ts
│   ├── utils/                        # Utility helpers
│   │   └── paymentHelpers.ts
│   ├── plugin/                       # Expo config plugins
│   │   ├── withApplePay.ts
│   │   └── withGooglePay.ts
│   └── index.ts                      # Public API
└── nitrogen/                         # Generated code (auto-generated)
```

### Design Principles

1. **Separation of Concerns**: Each component has a single, well-defined responsibility
2. **Factory Pattern**: Button and request creation abstracted into factory classes
3. **Type Safety**: Comprehensive TypeScript definitions with runtime validation
4. **Code Reusability**: Shared utilities and helpers reduce duplication
5. **Platform Consistency**: Unified API abstracts platform differences

## Contributing

Contributions are welcome! Please ensure:

- Code follows existing patterns and style
- All TypeScript types are properly defined
- Native code is properly documented
- Tests pass (when available)

## License

MIT

## Credits

Built with [Nitro Modules](https://nitro.margelo.com/) by [Margelo](https://margelo.com/)
