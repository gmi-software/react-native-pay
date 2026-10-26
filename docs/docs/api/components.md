# Button components

Native payment buttons: **ApplePayButton** (iOS) and **GooglePayButton** (Android). Use the one that matches the platform; the library does not render both on the same screen.

## ApplePayButton (iOS only)

Renders the system Apple Pay button. Only available on iOS.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `buttonType` | `ApplePayButtonType` | Yes | Button label type. |
| `buttonStyle` | `ApplePayButtonStyle` | Yes | Visual style. |
| `onPress` | `() => void`, wrapped with `callback()` | No | Called when the user taps the button. Must be wrapped, see [Nitro and onPress](#nitro-and-onpress). |
| `style` | `ViewStyle` | No | Layout/style (e.g. width, height). |

**ApplePayButtonType:**  
`'buy'` | `'setUp'` | `'book'` | `'donate'` | `'continue'` | `'reload'` | `'addMoney'` | `'topUp'` | `'order'` | `'rent'` | `'support'` | `'contribute'` | `'tip'`

**ApplePayButtonStyle:**  
`'white'` | `'whiteOutline'` | `'black'`

### Example

```tsx
import { ApplePayButton } from '@gmisoftware/react-native-pay'
import { callback } from 'react-native-nitro-modules'

const handlePayment = async () => {
  // Call startPayment() from usePaymentCheckout here
}

<ApplePayButton
  buttonType="buy"
  buttonStyle="black"
  onPress={callback(handlePayment)}
  style={{ width: '100%', height: 48 }}
/>
```

### Nitro and onPress

`ApplePayButton` is a Nitro view, so `onPress` must be wrapped with `callback()` from `react-native-nitro-modules`. A bare function does not reach the native button, and tapping it does nothing. See [Troubleshooting: Nitro callback for onPress](/docs/troubleshooting#nitro-callback-for-onpress).

---

## GooglePayButton (Android only)

Renders the Google Pay button. Only available on Android.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `buttonType` | `GooglePayButtonType` | Yes | Button label type. |
| `theme` | `'dark' \| 'light'` | Yes | Button theme. |
| `radius` | `number` | No | Corner radius in dp. |
| `supportedNetworks` | `string[]` | No | The card networks your payment accepts, as in `PaymentRequest.supportedNetworks`. Default: `visa`, `mastercard`, `amex`, `discover`. |
| `allowedAuthMethods` | `string[]` | No | As in `PaymentRequest.googlePayAllowedAuthMethods`. Default: both. |
| `merchantCapabilities` | `string[]` | No | As in `PaymentRequest.merchantCapabilities`. `'Debit'` without `'Credit'` leaves credit cards out. Default: every card type. |
| `onPress` | `() => void`, wrapped with `callback()` | No | Called when the user taps the button. Must be wrapped, see [Nitro and onPress](#nitro-and-onpress). |
| `style` | `ViewStyle` | No | Layout/style (e.g. width, height). |

The button can show the payer's card, so give it the same `supportedNetworks`, `allowedAuthMethods` and `merchantCapabilities` as the payment. Otherwise it may show a card the payment then refuses. With `usePaymentCheckout`, pass `paymentRequest.supportedNetworks`, `paymentRequest.googlePayAllowedAuthMethods` and `paymentRequest.merchantCapabilities`. With an unknown network, auth method or merchant capability, the button keeps its previous configuration, or does not appear on the first render, and logs an error in debug builds.

**GooglePayButtonType:**  
`'buy'` | `'book'` | `'checkout'` | `'donate'` | `'order'` | `'pay'` | `'subscribe'` | `'plain'`

### Example

```tsx
import { GooglePayButton } from '@gmisoftware/react-native-pay'
import { callback } from 'react-native-nitro-modules'

const handlePayment = async () => {
  // Call startPayment() from usePaymentCheckout here
}

<GooglePayButton
  buttonType="buy"
  theme="dark"
  radius={8}
  supportedNetworks={['visa', 'mastercard']}
  onPress={callback(handlePayment)}
  style={{ width: '100%', height: 48 }}
/>
```

### Nitro and onPress

Same as Apple: `onPress` must be wrapped, as in `onPress={callback(handlePayment)}`. See [Troubleshooting: Nitro callback for onPress](/docs/troubleshooting#nitro-callback-for-onpress).

---

## Platform-specific usage

Render one button per platform:

```tsx
import { Platform } from 'react-native'
import { ApplePayButton, GooglePayButton } from '@gmisoftware/react-native-pay'
import { callback } from 'react-native-nitro-modules'

const handlePayment = async () => {
  // Call startPayment() from usePaymentCheckout here
}

const style = { width: '100%', height: 48 } as const

{Platform.OS === 'ios' ? (
  <ApplePayButton buttonType="buy" buttonStyle="black" onPress={callback(handlePayment)} style={style} />
) : (
  <GooglePayButton buttonType="buy" theme="dark" onPress={callback(handlePayment)} style={style} />
)}
```

## Next

- [usePaymentCheckout](/docs/api/use-payment-checkout) — Hook that provides cart and startPayment
- [HybridPaymentHandler](/docs/api/hybrid-payment-handler) — Low-level API
