# Example app

The repository includes a full example app in the **`example/`** folder: an Expo app that demonstrates the checkout flow with `usePaymentCheckout`, cart management, and platform-specific buttons.

## What’s in the example

- **Checkout flow** — Add items (e.g. “Coffee”, “Subscription”), see cart and total, then pay with Apple Pay or Google Pay.
- **Status** — Check whether the device can make payments or only set up cards.
- **Cart UI** — Add/clear items and display total.
- **Result handling** — Success and error messages; reset and clear cart after success.
- **Nitro `callback`** — Buttons use `callback(handlePayment)` from `react-native-nitro-modules` so `onPress` works correctly with Nitro host components.

## Run the example

From the repo root:

```bash
cd example
bun install
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

Or from the root (if scripts are set up):

```bash
bun run ios
# or
bun run android
```

## What to copy from the example

Use the checkout screen in the example app as a reference for:

1. Calls `usePaymentCheckout` with `merchantIdentifier`, `countryCode`, and `currencyCode`.
2. Shows a loading state while `isCheckingStatus` is true.
3. Renders “Quick Add” buttons that call `addItems` or `addItem`.
4. Displays the cart (items + total) and a “Clear” action.
5. Renders **ApplePayButton** on iOS and **GooglePayButton** on Android with `callback(handlePayment)`.
6. On successful payment, shows an alert and calls `reset()` and `clearItems()`.

Copy these patterns into your app: config setup, cart handling, button usage, and `callback(...)` wrapping where needed.

## Plugin config in the example

The example’s **`app.json`** includes the React Native Pay plugin (e.g. with a demo Merchant ID and Google Pay enabled). Change `merchantIdentifier` (and any gateway settings) to your own for real payments.

## Next

- [Quick Start](/docs/quick-start) — Minimal integration in your app
- [API: usePaymentCheckout](/docs/api/use-payment-checkout) — Hook options and return value
- [Common mistakes](/docs/guides/common-mistakes) — What to avoid
