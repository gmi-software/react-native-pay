# Button components

Native payment buttons: **ApplePayButton** (iOS) and **GooglePayButton** (Android). Use the one that matches the platform. On the other platform a button renders nothing and, in development, logs a warning.

## ApplePayButton (iOS only)

Renders the system Apple Pay button. Only available on iOS.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `buttonType` | `ApplePayButtonType` | Yes | Button label type. |
| `buttonStyle` | `ApplePayButtonStyle` | Yes | Visual style. |
| `onPress` | `() => void` | No | Called when the user taps the button. |
| `disabled` | `boolean` | No | Ignores taps while `true`. See [Disabled buttons](#disabled-buttons). |
| `style` | `ViewStyle` | No | Layout/style (e.g. width, height). |

**ApplePayButtonType:**  
`'buy'` | `'setUp'` | `'book'` | `'donate'` | `'continue'` | `'reload'` | `'addMoney'` | `'topUp'` | `'order'` | `'rent'` | `'support'` | `'contribute'` | `'tip'`

**ApplePayButtonStyle:**  
`'white'` | `'whiteOutline'` | `'black'`

### Example

```tsx
import { ApplePayButton } from '@gmisoftware/react-native-pay'

const handlePayment = async () => {
  // Call startPayment() from usePaymentCheckout here
}

<ApplePayButton
  buttonType="buy"
  buttonStyle="black"
  onPress={handlePayment}
  style={{ width: '100%', height: 48 }}
/>
```

---

## GooglePayButton (Android only)

Renders the Google Pay button. Only available on Android.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `buttonType` | `GooglePayButtonType` | Yes | Button label type. |
| `theme` | `'dark' \| 'light'` | Yes | Button theme. |
| `radius` | `number` | No | Corner radius in dp, like other React Native sizes. |
| `supportedNetworks` | `string[]` | No | The card networks your payment accepts, as in `PaymentRequest.supportedNetworks`. Default: `visa`, `mastercard`, `amex`, `discover`. |
| `googlePayAllowedAuthMethods` | `string[]` | No | As in `PaymentRequest.googlePayAllowedAuthMethods`. Default: both. |
| `merchantCapabilities` | `string[]` | No | As in `PaymentRequest.merchantCapabilities`. `'Debit'` without `'Credit'` leaves credit cards out. Default: every card type. |
| `onPress` | `() => void` | No | Called when the user taps the button. |
| `disabled` | `boolean` | No | Ignores taps while `true`. See [Disabled buttons](#disabled-buttons). |
| `style` | `ViewStyle` | No | Layout/style (e.g. width, height). |

The button can show the payer's card, so give it the same `supportedNetworks`, `googlePayAllowedAuthMethods` and `merchantCapabilities` as the payment, under the same names. Otherwise it may show a card the payment then refuses. With `usePaymentCheckout`, pass them from `paymentRequest`. With an unknown network, auth method or merchant capability, the button keeps its previous configuration, or does not appear on the first render, and logs an error in debug builds.

**GooglePayButtonType:**  
`'buy'` | `'book'` | `'checkout'` | `'donate'` | `'order'` | `'pay'` | `'subscribe'` | `'plain'`

### Example

```tsx
import { GooglePayButton } from '@gmisoftware/react-native-pay'

const handlePayment = async () => {
  // Call startPayment() from usePaymentCheckout here
}

<GooglePayButton
  buttonType="buy"
  theme="dark"
  radius={8}
  supportedNetworks={['visa', 'mastercard']}
  onPress={handlePayment}
  style={{ width: '100%', height: 48 }}
/>
```

---

## Disabled buttons

With `disabled`, the button ignores taps, for example while a payment is in progress. It looks the same as an enabled button. Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/apple-pay) ask you not to make the Apple Pay button appear unavailable, and Google's [brand guidelines](https://developers.google.com/pay/api/android/guides/brand-guidelines) do not allow changing the Google Pay button's color. If the payment cannot start yet, for example before the payer picks a size, Apple suggests keeping the button enabled and explaining the problem after the tap.

```tsx
import { ApplePayButton, usePaymentCheckout } from '@gmisoftware/react-native-pay'

function PayButton() {
  const { startPayment, isProcessing } = usePaymentCheckout({
    merchantName: 'Your Store',
    currencyCode: 'USD',
    countryCode: 'US',
  })

  return (
    <ApplePayButton
      buttonType="buy"
      buttonStyle="black"
      onPress={startPayment}
      disabled={isProcessing}
      style={{ width: '100%', height: 48 }}
    />
  )
}
```

---

## Platform-specific usage

Render one button per platform:

```tsx
import { Platform } from 'react-native'
import { ApplePayButton, GooglePayButton } from '@gmisoftware/react-native-pay'

const handlePayment = async () => {
  // Call startPayment() from usePaymentCheckout here
}

const style = { width: '100%', height: 48 } as const

{Platform.OS === 'ios' ? (
  <ApplePayButton buttonType="buy" buttonStyle="black" onPress={handlePayment} style={style} />
) : (
  <GooglePayButton buttonType="buy" theme="dark" onPress={handlePayment} style={style} />
)}
```

## Next

- [usePaymentCheckout](/docs/api/use-payment-checkout) — Hook that provides cart and startPayment
- [HybridPaymentHandler](/docs/api/hybrid-payment-handler) — Low-level API
