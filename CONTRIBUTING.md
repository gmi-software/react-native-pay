# Contributing to React Native Pay

Thank you for your interest in contributing to React Native Pay! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Nitro Modules](#nitro-modules)
- [Pull Request Process](#pull-request-process)
- [What to Contribute](#what-to-contribute)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/react-native-pay.git
   cd react-native-pay
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/gmi-software/react-native-pay.git
   ```

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- bun
- React Native development environment
- For iOS: Xcode and CocoaPods
- For Android: Android Studio and Android SDK
- Expo CLI (for running the example app)

### Installation

```bash
# Install root dependencies
bun install

# Install package dependencies
cd package && bun install

# Install example app dependencies
cd ../example && bun install

# Generate Nitro bindings (required after cloning)
cd ../package
bun run specs
```

### Running the Example App

The example app in `/example` is used for testing and verification:

```bash
cd example

# iOS
npx expo prebuild
npx expo run:ios

# Android
npx expo prebuild
npx expo run:android
```

**Note**: Payment functionality requires real devices. Simulator/Emulator support is limited.

## Project Structure

```
react-native-pay/
├── package/              # Main library package
│   ├── src/              # TypeScript source
│   │   ├── hooks/        # React hooks
│   │   ├── specs/        # Nitro Module specifications (*.nitro.ts)
│   │   ├── types/        # TypeScript type definitions
│   │   ├── utils/        # Utility functions
│   │   └── plugin/       # Expo config plugins
│   ├── ios/              # iOS native code (Swift)
│   ├── android/          # Android native code (Kotlin, C++)
│   ├── nitrogen/         # Generated Nitro bindings (do not edit)
│   └── package.json
├── example/              # Example Expo app for testing
└── README.md
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

Use descriptive branch names:
- `feature/add-shipping-address`
- `fix/google-pay-error-handling`
- `docs/update-api-documentation`

### 2. Make Your Changes

- Write clean, maintainable code
- Follow existing patterns and conventions
- Add JSDoc comments for public APIs
- Update types when adding new features

### 3. Test Your Changes

Before submitting a PR, ensure:

- [ ] TypeScript compiles without errors: `cd package && bun run typecheck`
- [ ] Linting passes: `cd package && bun run lint`
- [ ] Example app runs on iOS (if applicable)
- [ ] Example app runs on Android (if applicable)
- [ ] Tested in both TEST and PRODUCTION modes (for payment features)

### 4. Update Documentation

- Update `README.md` for API changes
- Add code examples for new features
- Update type definitions if needed

## Code Style

### TypeScript

- Follow existing TypeScript patterns in the codebase
- Use TypeScript strict mode
- Prefer explicit types over `any`
- Export types from `src/types/index.ts`

### Formatting

- Prettier is configured and runs automatically
- Use single quotes for strings
- Use 2 spaces for indentation
- No semicolons (as per project config)

### Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components/types
- **Functions**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE

### JSDoc Comments

Add JSDoc comments for all public APIs:

```typescript
/**
 * Initiates a payment checkout flow.
 * @param request - Payment request configuration
 * @returns Promise resolving to payment result
 * @throws {PaymentError} If payment fails or is cancelled
 */
export async function checkout(request: PaymentRequest): Promise<PaymentResult> {
  // ...
}
```

## Testing

### Manual Testing

Since automated tests are not yet implemented, manual testing is required:

1. **Test on Real Devices**: Payment features require real iOS/Android devices
2. **Test Both Platforms**: Verify changes work on both iOS and Android
3. **Test Both Environments**: Use both TEST and PRODUCTION payment environments
4. **Test Error Cases**: Verify error handling works correctly

### Testing Checklist

- [ ] Payment flow completes successfully
- [ ] Error handling works for invalid inputs
- [ ] UI components render correctly
- [ ] TypeScript types are correct
- [ ] No console errors or warnings

## Nitro Modules

This project uses [Nitro Modules](https://nitro.margelo.com/) for native bindings.

### Important Notes

- **Spec Files**: Located in `package/src/specs/*.nitro.ts`
- **Generated Code**: The `package/nitrogen/` directory contains generated bindings - **do not edit manually**
- **Regeneration**: After changing any `*.nitro.ts` file, run:
  ```bash
  cd package
  bun run specs
  ```
- **Type Generation**: The `specs` command generates both native bindings and TypeScript types

### Working with Nitro Specs

1. Edit the `.nitro.ts` specification file
2. Run `bun run specs` to regenerate bindings
3. Implement native code in Swift (iOS) or Kotlin (Android)
4. Test thoroughly on both platforms

## Pull Request Process

### Before Submitting

1. **Sync with upstream**:
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```

2. **Ensure all checks pass**:
   - TypeScript compilation
   - Linting
   - Manual testing

3. **Write a clear description**:
   - What changes were made
   - Why the changes were needed
   - How to test the changes
   - Any breaking changes

### PR Description Template

```markdown
## Summary
- Brief description of changes
- Key improvements or fixes

## Changes
- List of specific changes made

## Testing
- [ ] TypeScript compiles: `cd package && bun run typecheck`
- [ ] Linting passes: `cd package && bun run lint`
- [ ] Tested on iOS (device)
- [ ] Tested on Android (device)
- [ ] Tested in TEST mode
- [ ] Tested in PRODUCTION mode

## Screenshots/Videos
(If applicable)

## Related Issues
Closes #(issue number)

## Breaking Changes
(If any, describe migration path)
```

### Review Process

- PRs will be reviewed by maintainers
- Address feedback promptly
- Keep PRs focused and reasonably sized
- Be patient and respectful during reviews

## What to Contribute

### Good First Issues

- Documentation improvements
- Bug fixes
- Type improvements
- Example app enhancements

### Feature Requests

Check the [Roadmap](README.md#roadmap) for planned features, or open an issue to discuss new features before implementing.

### Areas Needing Help

- Automated testing suite
- Additional payment gateway support
- Performance optimizations
- Documentation examples

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Device/platform information
   - Code snippets if relevant

## Questions?

- 📧 Email: [support@gmi.software](mailto:support@gmi.software)
- 🐛 Issues: [GitHub Issues](https://github.com/gmi-software/react-native-pay/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/gmi-software/react-native-pay/discussions)

Thank you for contributing to React Native Pay! 🎉
