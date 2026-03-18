# Button components

Native payment buttons: **ApplePayButton** (iOS) and **GooglePayButton** (Android). Use the one that matches the platform; the library does not render both on the same screen.

## ApplePayButton (iOS only)

Renders the system Apple Pay button. Only available on iOS.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `buttonType` | `ApplePayButtonType` | Yes | Button label type. |
| `buttonStyle` | `ApplePayButtonStyle` | Yes | Visual style. |
| `onPress` | `() => void` | No | Called when the user taps the button. |
| `style` | `ViewStyle` | No | Layout/style (e.g. width, height). |

**ApplePayButtonType:**  
`'buy'` | `'setUp'` | `'book'` | `'donate'` | `'continue'` | `'reload'` | `'addMoney'` | `'topUp'` | `'order'` | `'rent'` | `'support'` | `'contribute'` | `'tip'`

**ApplePayButtonStyle:**  
`'white'` | `'whiteOutline'` | `'black'`

### Example

```tsx
import { ApplePayButton } from '@gmisoftware/react-native-pay'

<ApplePayButton
  buttonType="buy"
  buttonStyle="black"
  onPress={handlePayment}
  style={{ width: '100%', height: 48 }}
/>
```

### Nitro and onPress

If `onPress` does not fire, use Nitro's `callback(...)` wrapper. See [Troubleshooting: Nitro callback for onPress](/docs/troubleshooting#nitro-callback-for-onpress).

---

## GooglePayButton (Android only)

Renders the Google Pay button. Only available on Android.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `buttonType` | `GooglePayButtonType` | Yes | Button label type. |
| `theme` | `'dark' \| 'light'` | Yes | Button theme. |
| `radius` | `number` | No | Corner radius in dp. |
| `onPress` | `() => void` | No | Called when the user taps the button. |
| `style` | `ViewStyle` | No | Layout/style (e.g. width, height). |

**GooglePayButtonType:**  
`'buy'` | `'book'` | `'checkout'` | `'donate'` | `'order'` | `'pay'` | `'subscribe'` | `'plain'`

### Example

```tsx
import { GooglePayButton } from '@gmisoftware/react-native-pay'

<GooglePayButton
  buttonType="buy"
  theme="dark"
  radius={8}
  onPress={handlePayment}
  style={{ width: '100%', height: 48 }}
/>
```

### Nitro and onPress

Same as Apple: if needed, use `callback(handlePayment)` for `onPress`. See [Troubleshooting: Nitro callback for onPress](/docs/troubleshooting#nitro-callback-for-onpress).

---

## Platform-specific usage

Render one button per platform:

```tsx
import { Platform } from 'react-native'
import { ApplePayButton, GooglePayButton } from '@gmisoftware/react-native-pay'

{Platform.OS === 'ios' ? (
  <ApplePayButton buttonType="buy" buttonStyle="black" onPress={handlePay} style={styles.button} />
) : (
  <GooglePayButton buttonType="buy" theme="dark" onPress={handlePay} style={styles.button} />
)}
```

## Next

- [usePaymentCheckout](/docs/api/use-payment-checkout) — Hook that provides cart and startPayment
- [HybridPaymentHandler](/docs/api/hybrid-payment-handler) — Low-level API
