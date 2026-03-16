# Common mistakes

Avoid these to get Apple Pay and Google Pay working reliably.

## 1. Calling startPayment with an empty cart

**Symptom:** Error like “Cart is empty” or `startPayment()` returns `null`.

**Fix:** Ensure the cart has at least one item before the user taps the payment button. Use `items.length > 0` to show the button only when there is something to pay.

---

## 2. Wrong or missing Merchant ID (iOS)

**Symptom:** Apple Pay button not showing, or “Cannot make payments”.

**Fix:**

- Use the **exact** Merchant ID from Apple Developer (e.g. `merchant.com.yourcompany.app`) in:
  - Expo plugin: `merchantIdentifier`
- Run `npx expo prebuild --clean` after changing the plugin.
- Ensure the App ID has Apple Pay enabled and is linked to this Merchant ID.

---

## 3. Google Pay not enabled (Android)

**Symptom:** Google Pay button missing or “Google Pay unavailable”.

**Fix:**

- In the Expo plugin, set **`enableGooglePay: true`**.
- Run prebuild and rebuild the app.
- On device/emulator: ensure Google Play Services is available and the user has added a card in Google Pay.
- For production, set **googlePayMerchantId**, **googlePayGateway**, **googlePayGatewayMerchantId**, and **googlePayEnvironment: 'PRODUCTION'** in your checkout config.

---

## 4. Using the wrong button on the platform

**Symptom:** Crash or no button (e.g. ApplePayButton on Android).

**Fix:** Render one button per platform:

```tsx
Platform.OS === 'ios' ? <ApplePayButton ... /> : <GooglePayButton ... />
```

---

## 5. onPress not firing (Nitro)

**Symptom:** Tapping the payment button does nothing.

**Fix:** With Nitro host components, wrap the handler with `callback` from `react-native-nitro-modules`:

```tsx
import { callback } from 'react-native-nitro-modules'
<ApplePayButton onPress={callback(handlePay)} ... />
```

---

## 6. Wrong Apple Pay button type/style (iOS)

**Symptom:** TypeScript or runtime error about invalid prop.

**Fix:** Use only the supported enums from the implementation:

- **buttonType:** `'buy'` | `'setUp'` | `'book'` | `'donate'` | `'continue'` | `'reload'` | `'addMoney'` | `'topUp'` | `'order'` | `'rent'` | `'support'` | `'contribute'` | `'tip'` (no `'plain'`, `'inStore'`, `'checkout'`, or `'subscribe'`).
- **buttonStyle:** `'white'` | `'whiteOutline'` | `'black'` (no `'automatic'`).

---

## 7. Testing without a card

**Symptom:** “Cannot make payments” or sheet not completing.

**Fix:** Use a **real device** with a valid card added in Wallet (iOS) or Google Pay (Android). Simulator/emulator support is limited.

---

## 8. Forgetting to run prebuild after plugin change

**Symptom:** Entitlements or manifest not updated; payment still fails.

**Fix:** After any change to the Expo plugin config, run:

```bash
npx expo prebuild --clean
```

Then rebuild and run the app.
