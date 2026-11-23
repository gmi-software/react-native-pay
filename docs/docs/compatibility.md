# Compatibility

Supported versions and upgrade notes.

## Peer dependencies

- **react** — `*` (compatible with current React 18/19)
- **react-native** — `*` (0.70+ recommended)
- **react-native-nitro-modules** — **>= 0.36.0** (required)
- **expo** — **>= 53.0.0**, optional (only if you use Expo; tested with SDK 57 / React Native 0.86). Package managers don't install it for bare React Native apps.
- **Android minSdkVersion** — **26+** (required for Nitro Modules prefab)

Install the correct Nitro version first; the payment library depends on it.

## Native requirements

- **iOS** — the minimum iOS version your React Native version supports (`min_ios_version_supported`); visionOS 1.0+.
- **Android** — compileSdk and targetSdk 36, NDK 29.0.14206865, minSdk 26. To change them, set `compileSdkVersion`, `targetSdkVersion`, `ndkVersion` or `minSdkVersion` in the root project's `ext` block. When the root project doesn't define one, the library falls back to its `NitroPay_*` Gradle property, so a `NitroPay_*` property has no effect on a value the root `ext` already sets.
- **Google Pay** — the library depends on `com.google.android.gms:play-services-wallet` 20.0.0.

## Recommended versions

- **React Native** 0.70 or newer (0.86 with Expo SDK 57)
- **Expo** 53–57 when using Expo

## Expo plugin behavior

- **merchantIdentifier** — Optional in the plugin config. If omitted, Apple Pay entitlements are not added (use for Android-only or when you add Apple Pay later).
- **enableGooglePay** — Optional. Set to **true** to enable Google Pay on Android, or **false** to remove the Google Pay manifest entry. If omitted, the plugin leaves the Android manifest as it is.

## Platform support

| Platform | Apple Pay | Google Pay |
|----------|-----------|------------|
| iOS      | Yes (ApplePayButton, usePaymentCheckout, HybridPaymentHandler) | N/A (use Google Pay on Android) |
| Android  | N/A       | Yes (GooglePayButton, usePaymentCheckout, HybridPaymentHandler) |

Use `Platform.OS` (or equivalent) to render the correct button and to pass platform-specific config (e.g. Google Pay options only on Android).

## Breaking changes and migrations

### 0.0.16

- Regenerated Nitrogen bindings for **react-native-nitro-modules 0.36+** (Expo SDK 57 / React Native 0.86).
- **Peer dependency** `react-native-nitro-modules` is now **>= 0.36.0** (was >= 0.35.0).
- Example app upgraded to **Expo SDK 57** (React Native 0.86, React 19.2.3).

### 0.0.15

- Regenerated Nitrogen bindings for **react-native-nitro-modules 0.35+** (JavaPart/CxxPart JNI model).
- **Peer dependency** `react-native-nitro-modules` is now **>= 0.35.0** (was >= 0.31.4).
- **Android minSdkVersion 26+** is required (Nitro Modules prefab). Set `minSdkVersion` to at least 26 in `expo-build-properties` or your app's `build.gradle`.
- Consumers on nitro 0.31.x must stay on **0.0.14** or upgrade nitro-modules first.

- Check the package **changelog** or **GitHub releases** for version-specific notes.
- When upgrading, run `npx expo prebuild --clean` and re-test on both platforms.
- If you use TypeScript, run `bun run typecheck` (or your typecheck script) after upgrading.

## FAQ

**Do I need Expo?**  
No. The library works in bare React Native too. The Expo plugin only simplifies adding Apple Pay entitlements and Google Pay metadata; in a bare project you configure those in Xcode and Android Studio yourself.

**Can I use only Apple Pay or only Google Pay?**  
Yes. Omit `enableGooglePay` for iOS-only (`false` removes an entry another plugin added); omit plugin `merchantIdentifier` for Android-only. In code, only render the button for the platform you support.

**Which gateways are supported for Google Pay?**  
Any gateway that supports the [Google Pay API](https://developers.google.com/pay/api/android) and the gateway token format. Commonly used: Stripe, Braintree, Square, Adyen, Authorize.net, Checkout.com. Set `googlePayMerchantId`, `googlePayGateway`, and `googlePayGatewayMerchantId` accordingly. A PCI DSS compliant merchant that decrypts tokens itself can use [`'direct'` tokenization](/docs/setup/android-google-pay#direct-tokenization) instead.

**Where do I report issues?**  
[GitHub Issues](https://github.com/gmi-software/react-native-pay/issues).
