# Compatibility

Supported versions and upgrade notes.

## Peer dependencies

- **react** — `*` (compatible with current React 18/19)
- **react-native** — `*` (0.70+ recommended)
- **react-native-nitro-modules** — **>= 0.31.4** (required)
- **expo** — **>= 53.0.0** (if using Expo)

Install the correct Nitro version first; the payment library depends on it.

## Recommended versions

- **React Native** 0.70 or newer
- **Expo** 53+ when using Expo

## Expo plugin behavior

- **merchantIdentifier** — Optional in the plugin config. If omitted, Apple Pay entitlements are not added (use for Android-only or when you add Apple Pay later).
- **enableGooglePay** — Defaults to **false**. Set to **true** to enable Google Pay on Android.

## Platform support

| Platform | Apple Pay | Google Pay |
|----------|-----------|------------|
| iOS      | Yes (ApplePayButton, usePaymentCheckout, HybridPaymentHandler) | N/A (use Google Pay on Android) |
| Android  | N/A       | Yes (GooglePayButton, usePaymentCheckout, HybridPaymentHandler) |

Use `Platform.OS` (or equivalent) to render the correct button and to pass platform-specific config (e.g. Google Pay options only on Android).

## Breaking changes and migrations

- Check the package **changelog** or **GitHub releases** for version-specific notes.
- When upgrading, run `npx expo prebuild --clean` and re-test on both platforms.
- If you use TypeScript, run `bun run typecheck` (or your typecheck script) after upgrading.

## FAQ

**Do I need Expo?**  
No. The library works in bare React Native too. The Expo plugin only simplifies adding Apple Pay entitlements and Google Pay metadata; in a bare project you configure those in Xcode and Android Studio yourself.

**Can I use only Apple Pay or only Google Pay?**  
Yes. Omit `enableGooglePay` (or set false) for iOS-only; omit `merchantIdentifier` for Android-only. In code, only render the button for the platform you support.

**Which gateways are supported for Google Pay?**  
Any gateway that supports the [Google Pay API](https://developers.google.com/pay/api/android) and the gateway token format. Commonly used: Stripe, Braintree, Square, Adyen, Authorize.net, Checkout.com. Set `googlePayGateway` and `googlePayGatewayMerchantId` accordingly.

**Where do I report issues?**  
[GitHub Issues](https://github.com/gmi-software/react-native-pay/issues).
