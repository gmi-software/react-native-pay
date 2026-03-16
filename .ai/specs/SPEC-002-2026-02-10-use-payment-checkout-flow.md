# SPEC-002: usePaymentCheckout Flow

## Overview

This specification documents the behavior contract for `usePaymentCheckout`, the high-level hook that manages payment availability, cart state, and payment execution.

The hook is intended to be the default integration path for product teams that do not need direct low-level native calls. It also defines the runtime request contract that bridges JavaScript configuration to Apple Pay and Google Pay native behavior.

## Problem Statement

The hook combines multiple concerns (status check, cart operations, payment execution, error handling). Without an explicit spec, behavior may drift and breaking changes can be introduced unintentionally.

## Proposed Solution

Define `usePaymentCheckout` as a stable state machine-like API with clear rules:

- On mount, perform one payment status check.
- Maintain mutable cart items with helper methods.
- Build `paymentRequest` from config + current items with sensible defaults.
- Block payment start when cart is empty.
- Surface processing/result/error state in predictable order.

## Architecture

Hook internals (`package/src/hooks/usePaymentCheckout.ts`) include:

- **Inputs**: `UsePaymentCheckoutConfig`
- **Derived values**: `total`, `paymentRequest`
- **State**:
  - `status`
  - `isCheckingStatus`
  - `items`
  - `isProcessing`
  - `result`
  - `error`
- **Actions**:
  - Cart mutators (`addItem`, `addItems`, `removeItem`, `updateItem`, `clearItems`)
  - Payment action (`startPayment`)
  - Reset action (`reset`)

## Data Models

Primary hook models:

- `UsePaymentCheckoutConfig`
- `UsePaymentCheckoutReturn`
- `PaymentItem`, `PaymentRequest`, `PaymentResult`, `PayServiceStatus`

Platform-specific request fields:

- `applePayMerchantIdentifier?`: optional iOS-only override used when the app has multiple Apple Pay merchant IDs configured or needs to avoid the default entitlement-derived identifier.
- `googlePayMerchantId?`: optional Android-only field in test mode and required by native validation in production mode.
- `googlePayEnvironment?`, `googlePayGateway?`, `googlePayGatewayMerchantId?`: Android-only Google Pay configuration forwarded directly to native request builders.

Default values in request composition:

- `countryCode`: `US`
- `currencyCode`: `USD`
- `supportedNetworks`: `['visa', 'mastercard', 'amex', 'discover']`
- `merchantCapabilities`: `['3DS']`

If cart is empty, `paymentRequest.paymentItems` contains a fallback `Total` item with amount `0` for request shape consistency.

## API Contracts

Functional contract highlights:

1. `startPayment()` returns `null` and sets error `"Cart is empty"` when no items exist.
2. During payment:
   - `isProcessing` is set `true`
   - previous `result`/`error` are cleared
3. On successful native return:
   - `result` is set
   - `error` remains `null`
4. On unsuccessful native return (`success=false`):
   - `result` is set
   - `error` is set from native error or fallback message
5. On thrown exception:
   - `error` is set to normalized `Error`
   - function returns `null`
6. On iOS merchant identifier resolution:
   - JavaScript config does not require a merchant identifier field for the default Apple Pay path.
   - If `applePayMerchantIdentifier` is provided and not blank, native uses it as an explicit override.
   - If the override is omitted, native resolves the first non-empty value from the app entitlement `com.apple.developer.in-app-payments`.
   - If neither source yields a merchant identifier, native returns `success=false` with error `"No Apple Pay merchant identifier configured"`.
7. On Android Google Pay production validation:
   - `googlePayMerchantId` is written into `merchantInfo.merchantId` only for `googlePayEnvironment='PRODUCTION'`.
   - In production, native validation requires non-blank `googlePayMerchantId`, `googlePayGateway`, and `googlePayGatewayMerchantId`.
   - In non-production environments, the merchant ID may be omitted and gateway values fall back to native defaults.
8. `reset()` clears transient payment state but does not clear cart items.

## UI/UX

The hook provides state for UI rendering but does not own UI components.

Recommended consumer pattern:

- Use `isCheckingStatus` for initial availability loading.
- Use `canMakePayments` for gating payment controls.
- Use `isProcessing` for disabled/loading button state.
- Use `error` for actionable feedback.

## Configuration

Required config:

- No hook config field is universally required. Platform-specific runtime requirements are enforced when payment starts.

Optional config:

- `merchantName`
- `countryCode`
- `currencyCode`
- `supportedNetworks`
- `merchantCapabilities`
- `applePayMerchantIdentifier`
- `googlePayMerchantId`
- `googlePayEnvironment`
- `googlePayGateway`
- `googlePayGatewayMerchantId`

## Alternatives Considered

1. **Split into multiple hooks (`usePaymentStatus`, `usePaymentCart`, `usePaymentFlow`)**
   - Rejected for now to preserve simple integration.
2. **Throw exceptions instead of returning null on empty cart/errors**
   - Rejected to keep consumer control and reduce unhandled promise rejections.
3. **Auto-add mandatory total item instead of requiring explicit cart management**
   - Rejected because amount ownership should remain in app business logic.

## Implementation Approach

When changing hook behavior:

1. Update hook implementation and public TS types together.
2. Update integration tests in `package/src/hooks/__tests__/usePaymentCheckout.integration.test.ts`.
3. Ensure root `README.md` examples still match behavior.
4. Update this spec changelog for observable behavior changes.

## Migration Path

Previous public behavior required a JS-side `merchantIdentifier` for Apple Pay-oriented integrations.

Current migration contract:

- Replace any hook config usage of `merchantIdentifier` with `applePayMerchantIdentifier` only when an explicit Apple Pay override is needed.
- For standard iOS setups, rely on the merchant IDs already configured in native entitlements via Expo plugin or manual native setup.
- For Android production Google Pay, provide `googlePayMerchantId` explicitly together with `googlePayGateway` and `googlePayGatewayMerchantId`.

Future behavior changes must include:

- "Previous behavior" vs "new behavior" notes
- Required app-side updates (if any)

## Success Metrics

- Hook behavior remains deterministic across releases.
- Integration tests cover primary success, failure, and edge paths.
- Consumer issues related to cart/payment state transitions decrease.

## Open Questions

- Should `startPayment` expose structured error codes instead of free-form messages?
- Should `reset()` optionally clear cart items via flag (`reset({ clearCart: true })`)?

## Changelog

### 2026-03-16

- Updated the runtime contract so iOS no longer requires a JS merchant identifier by default and instead resolves Apple Pay merchant IDs from native entitlements unless `applePayMerchantIdentifier` overrides it.
- Recorded that Android production Google Pay now uses `googlePayMerchantId` explicitly for `merchantInfo.merchantId` and validates it alongside gateway fields.

### 2026-02-10

- Initial behavior contract for `usePaymentCheckout` lifecycle, state model, and API guarantees.
