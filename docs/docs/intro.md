# Introduction

**React Native Pay** is a unified payment module for React Native that supports **Apple Pay** (iOS) and **Google Pay** (Android) through a single, type-safe API for presenting native payment sheets and returning payment tokens.

## What you get

- **One hook** — `usePaymentCheckout()` handles availability, cart, and payment flow.
- **Native buttons** — `ApplePayButton` and `GooglePayButton` for platform-correct UI.
- **Unified API** — Shared request/result model across platforms; button component remains platform-specific.
- **TypeScript** — Full types and IntelliSense for requests, results, and tokens.
- **Expo** — Config plugin for Apple Pay entitlements and Google Pay metadata.
- **Nitro Modules** — High-performance native bindings.

## Who this is for

- React Native apps (Expo or bare) that need **Apple Pay** and/or **Google Pay**.
- Teams that want a single integration instead of maintaining two separate SDKs.
- Apps that already use (or plan to use) a payment gateway (e.g. Stripe, Braintree) and need the **payment token** from the device to charge on the server.

## High-level flow

1. **Check availability** — `isSupported` and `hasActiveCard` from `usePaymentCheckout()` or `HybridPaymentHandler.payServiceStatus()`. See [Check availability](/docs/guides/availability).
2. **Build the cart** — `addItem()` / `addItems()` (or build a `PaymentRequest` yourself).
3. **Show the button** — `ApplePayButton` on iOS, `GooglePayButton` on Android.
4. **Start payment** — `startPayment()`; user completes the sheet; you receive a **token**.
5. **Send token to server** — Your backend uses the token with your payment gateway to complete the charge.

The library does not process payments itself; it gives you the token and metadata so your server can.

## What this library does and does not do

### What it does

- Renders native payment buttons (`ApplePayButton` / `GooglePayButton`).
- Starts Apple Pay / Google Pay sheets and returns `PaymentResult` + token payload.
- Provides hook-based cart helpers (`usePaymentCheckout`) and low-level API (`HybridPaymentHandler`).

### What it does not do

- It does **not** charge cards by itself.
- It does **not** replace your gateway SDK/backend payment flow.
- It does **not** bypass Apple Developer / Google Pay onboarding and account setup.

### What you can sell with Apple Pay and Google Pay

Use Apple Pay and Google Pay only for **physical goods** and for **services used outside the app**, such as a delivery, a ride, a ticket or a donation to an approved nonprofit. Digital content and in-app features, such as subscriptions to digital content, premium content or unlocked features, must as a rule use the stores' own billing, with the exceptions below. A subscription to physical goods, such as a monthly delivery, may use Apple Pay and Google Pay.

- **App Store:** [App Review Guideline 3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase) requires In-App Purchase to unlock features, subscriptions or premium content. Under [3.1.3(e)](https://developer.apple.com/app-store/review/guidelines/#payments), physical goods and services used outside the app must use other payment methods, such as Apple Pay. Under [3.1.3(d)](https://developer.apple.com/app-store/review/guidelines/#payments), real-time person-to-person services between two people, such as tutoring or a medical consultation, may also use other payment methods; one-to-few and one-to-many real-time services must use In-App Purchase.
- **Google Play:** the [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738) requires Google Play Billing for digital goods and in-app features. Developers enrolled in Google's [alternative billing program for users in the United States](https://support.google.com/googleplay/android-developer/answer/16497028) may offer another billing system to those users. Google Pay is not such a system: the [Google Pay setup page](https://developers.google.com/pay/api/android/guides/setup) limits it to physical goods and services and sends apps that sell digital goods to Play Billing.

An app that sells digital goods with this library can be rejected in App Review or removed from Google Play.

Apps that use Apple Pay must also follow [App Review Guideline 4.9](https://developer.apple.com/app-store/review/guidelines/#apple-pay):

- Show all material purchase information to the user before the sale.
- For recurring payments, such as a monthly delivery, disclose at least the length of the renewal term and that it continues until cancelled, what is provided during each period, the charges, and how to cancel.

### Still required for production

- Platform setup (Merchant ID, entitlements/capabilities, Google Pay API/project setup).
- Gateway configuration (environment, gateway identifiers, tokenization mode).
- Server-side processing (validation, idempotency, charge/intent creation, error handling).
- Real-device testing on iOS and Android before going live.

## Next steps

- [Quick Start](/docs/quick-start) — Get a minimal checkout running in minutes.
- [Payment flow](/docs/payment-flow) — End-to-end flow in more detail.
- [Installation & Setup](/docs/setup/installation) — Prerequisites and platform setup.
