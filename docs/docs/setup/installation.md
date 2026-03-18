# Installation

Install the payment library and its required dependency in your React Native (or Expo) app.

## Requirements

- **React Native** 0.70 or newer
- **react-native-nitro-modules** 0.31.4 or newer (required)
- **Expo** 53+ if you use Expo

## Step 1: Install Nitro Modules

This package depends on Nitro. Install it first:

```bash
npm install react-native-nitro-modules
# or
yarn add react-native-nitro-modules
# or
bun add react-native-nitro-modules
```

## Step 2: Install React Native Pay

```bash
npm install @gmisoftware/react-native-pay
# or
yarn add @gmisoftware/react-native-pay
# or
bun add @gmisoftware/react-native-pay
```

## Step 3: Configure the Expo plugin

Add the plugin in `app.json` or `app.config.js` so that:

- **iOS:** Apple Pay entitlements (Merchant ID) are set.
- **Android:** Google Pay is enabled in the manifest when you want it.

See [Expo plugin](/docs/setup/expo-plugin) for the exact config, then:

- [iOS (Apple Pay)](/docs/setup/ios-apple-pay) for Apple Developer setup.
- [Android (Google Pay)](/docs/setup/android-google-pay) for Google Pay and gateway setup.
- [Bare React Native setup](/docs/setup/bare-react-native) for manual Xcode/AndroidManifest configuration.

## Step 4: Prebuild (Expo)

After adding or changing the plugin:

```bash
npx expo prebuild --clean
```

Then run your app as usual (`npx expo run:ios` or `npx expo run:android`).

## Next

- [Expo plugin](/docs/setup/expo-plugin) — Plugin options and examples
- [iOS (Apple Pay)](/docs/setup/ios-apple-pay) — Merchant ID and certificates
- [Android (Google Pay)](/docs/setup/android-google-pay) — Google Pay API and gateway
- [Bare React Native setup](/docs/setup/bare-react-native) — Manual native configuration
