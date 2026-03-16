# SPEC-001: Core Module Architecture

## Overview

This specification defines the baseline architecture of `@gmisoftware/react-native-pay`, a React Native library that provides a unified API for Apple Pay (iOS) and Google Pay (Android).

The library is built on Nitro Modules and exposes:

- A low-level hybrid object (`HybridPaymentHandler`)
- Native host components (`ApplePayButton`, `GooglePayButton`)
- TypeScript-first utilities and hook abstractions
- Expo config plugin support for app-level platform setup

## Problem Statement

Contributors and AI agents need a stable architecture reference that explains:

- Where the public API is defined
- How TypeScript, Nitro specs, and native code connect
- Which layers own business logic vs platform integration
- What must be kept in sync when changing interfaces

Without this, changes risk API drift, generated code mismatch, or behavior inconsistencies between platforms.

## Proposed Solution

Use a layered architecture with explicit responsibilities:

1. **Public API layer (`src/index.ts`)** for exports only.
2. **Application logic layer (`src/hooks`, `src/utils`, `src/types`)** for TS behavior and ergonomics.
3. **Nitro contract layer (`src/specs/*.nitro.ts`)** as the cross-platform interface definition.
4. **Native implementation layer (`ios/`, `android/`)** for platform payment behavior.
5. **Generated bindings layer (`nitrogen/generated/`)** that maps Nitro contracts to native glue code.
6. **Build-time configuration layer (`src/plugin`)** for Expo prebuild changes.

## Architecture

High-level request path:

1. Consumer imports `HybridPaymentHandler` or `usePaymentCheckout` from `src/index.ts`.
2. Hook or direct call uses Nitro object methods defined by `PaymentHandler.nitro.ts`.
3. Nitro runtime resolves to native Kotlin/Swift implementations.
4. Native implementation performs Apple Pay or Google Pay flow and returns mapped result.
5. TypeScript consumer receives `PaymentResult` and handles backend processing.

Primary source areas:

- `package/src/index.ts` - public surface and host component registration
- `package/src/specs/` - Nitro interfaces and host component contracts
- `package/src/types/` - shared TypeScript request/response models
- `package/src/hooks/usePaymentCheckout.ts` - high-level checkout abstraction
- `package/src/plugin/` - Expo config plugin behavior
- `package/ios/` and `package/android/` - native logic

## Data Models

Core shared models are defined in `package/src/types/Payment.ts`:

- `PaymentRequest`: input contract for native payment start
- `PaymentItem`: line items used for totals and display
- `PaymentResult`: success/error envelope and token details
- `PayServiceStatus`: platform availability flags

Cross-layer contract rule:

- Changes in `PaymentHandler.nitro.ts` or type models that affect signatures require Nitro regeneration (`bun run specs`) and validation of generated artifacts.

## API Contracts

Primary low-level contract:

- `payServiceStatus(): PayServiceStatus`
- `startPayment(request: PaymentRequest): Promise<PaymentResult>`
- `canMakePayments(usingNetworks: string[]): boolean`

Primary high-level API:

- `usePaymentCheckout(config)` for stateful checkout flow
- `ApplePayButton` and `GooglePayButton` host components
- Utility functions from `src/utils/paymentHelpers.ts`

## UI/UX

UI primitives are native button host components:

- `ApplePayButton` on iOS
- `GooglePayButton` on Android

The library does not enforce checkout screen layout. Consumers own surrounding UI and call library APIs for payment state/actions.

## Configuration

Configuration surfaces:

- Runtime payment config via `PaymentRequest` or hook config
- Build-time config via Expo plugin props:
  - `merchantIdentifier`
  - `enableGooglePay`

## Alternatives Considered

1. **Pure JS bridge module without Nitro**
   - Rejected due to weaker type contract and performance overhead.
2. **Platform-specific APIs only (no unified layer)**
   - Rejected due to poor developer experience and duplicate integration code.
3. **Single abstraction without low-level API**
   - Rejected because advanced consumers need direct native method control.

## Implementation Approach

When modifying architecture-relevant behavior:

1. Update TS or Nitro contracts first.
2. Update matching native implementations for both platforms if contract changed.
3. Regenerate Nitro bindings (`cd package && bun run specs`).
4. Run quality checks (`typecheck`, `lint`, tests).
5. Update specs (`.ai/specs/`) and README docs for API-level changes.

## Migration Path

No migration required for initial baseline documentation.

Future migration policy:

- Any breaking API change must include explicit migration notes and examples in this spec and root `README.md`.

## Success Metrics

- Contributors can identify owner layer for changes in under 5 minutes.
- Fewer regressions from contract mismatch (TS/Nitro/native).
- PRs affecting API include corresponding spec updates.

## Open Questions

- Should generated Nitro artifacts be versioned as strict API snapshots for release auditing?
- Should this architecture spec be split into runtime architecture and build architecture as complexity grows?

## Changelog

### 2026-02-10

- Initial architecture baseline for React Native Pay module layers and responsibilities.
