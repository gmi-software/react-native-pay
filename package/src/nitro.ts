/**
 * Requires react-native-nitro-modules on first use. Importing it throws
 * without the native module, so the package must not import it up front:
 * its helpers have to import on web and in Jest.
 */
export function requireNitro() {
  return require('react-native-nitro-modules') as typeof import('react-native-nitro-modules')
}
