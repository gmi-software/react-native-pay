# SPEC-004: Testing and Quality Gates

## Overview

This specification defines the quality baseline for React Native Pay changes, including local validation, CI gates, and change expectations for API, plugin, and hook behavior.

## Problem Statement

This library spans TypeScript, generated Nitro bindings, and native iOS/Android implementation. Regressions can occur if changes are merged without consistent validation across linting, typing, tests, and generated output checks.

## Proposed Solution

Adopt explicit quality gates for all pull requests:

- Linting for style and code quality
- Typecheck for API and contract correctness
- Jest tests for utility, plugin, and hook behavior
- Nitro spec regeneration when relevant contracts change

## Architecture

Validation layers:

1. **Static analysis**
   - `cd package && bun run lint`
   - `cd package && bun run typecheck`
2. **Automated tests**
   - `cd package && bun run test:ci`
3. **Generated contract sync (conditional)**
   - `cd package && bun run specs` when `*.nitro.ts` or hybrid interface contracts change
4. **CI enforcement**
   - GitHub workflow `.github/workflows/ci.yml` runs lint, typecheck, tests on PR/push.

## Data Models

Not applicable for runtime domain entities.

Quality artifacts include:

- TypeScript diagnostics
- ESLint diagnostics
- Jest test reports
- Generated Nitro outputs under `package/nitrogen/`

## API Contracts

Change expectations by area:

- **Public TS exports (`package/src/index.ts`, types, hooks, utils)**:
  - Must keep type contracts accurate and documented.
- **Plugin behavior (`package/src/plugin`)**:
  - Must include/maintain unit tests for entitlement/manifest mutation.
- **Hook behavior (`package/src/hooks/usePaymentCheckout.ts`)**:
  - Must update integration tests when observable behavior changes.
- **Nitro contracts (`package/src/specs/*.nitro.ts`)**:
  - Must regenerate bindings and ensure generated artifacts are consistent.

## UI/UX

Not applicable directly. UI behavior is validated indirectly through hook and component contract tests.

## Configuration

Required local validation commands:

- `cd package && bun run lint`
- `cd package && bun run typecheck`
- `cd package && bun run test:ci`

Conditional command:

- `cd package && bun run specs` (required when Nitro contract-relevant files change)

## Alternatives Considered

1. **Rely on manual verification only**
   - Rejected due to high regression risk and inconsistent coverage.
2. **Run only tests in CI**
   - Rejected; lint/type failures can still break package consumers.
3. **Skip generated output verification**
   - Rejected; contract drift between spec and generated/native layers is costly.

## Implementation Approach

Recommended PR workflow:

1. Implement code changes.
2. Regenerate Nitro bindings if contract layer changed.
3. Run lint, typecheck, and test commands locally.
4. Update affected specs and docs.
5. Ensure CI passes before merge.

## Migration Path

No migration required for initial baseline documentation.

Future updates may add:

- Platform build smoke tests in CI
- Example app verification jobs for iOS/Android runners

## Success Metrics

- CI catches regressions before merge.
- Fewer post-merge hotfixes for type/plugin/hook regressions.
- Contributors follow consistent validation checklist.

## Open Questions

- Should CI include a Nitro regeneration diff check to prevent stale generated code?
- Should we add separate test suites for iOS/Android native behavior mocks?

## Changelog

### 2026-02-10

- Initial quality gate specification for lint, typecheck, tests, and Nitro sync.
