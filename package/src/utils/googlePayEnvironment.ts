import { Platform } from 'react-native'
import type { GooglePayEnvironment } from '../types'

let hasWarned = false

/**
 * Warns once per app run when an Android release build leaves
 * `googlePayEnvironment` out. Google Pay then runs in `TEST`: the sheet says
 * the merchant is unverified and no token can be charged.
 */
export function warnIfGooglePayEnvironmentOmitted(
  environment: GooglePayEnvironment | undefined
): void {
  const isOmittedInRelease =
    environment === undefined && !__DEV__ && Platform.OS === 'android'
  if (hasWarned || !isOmittedInRelease) return
  hasWarned = true
  console.warn(
    "[react-native-pay] googlePayEnvironment is not set, so Google Pay runs in 'TEST' and its tokens can't be charged. Set googlePayEnvironment: 'PRODUCTION' for live payments, or 'TEST' to keep the test environment and silence this warning."
  )
}
