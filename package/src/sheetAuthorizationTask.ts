import { AppRegistry, Platform } from 'react-native'

/**
 * The headless JS task Android starts while `onAuthorize` runs under the
 * Google Pay sheet. React Native stops JS timers while the app's activity is
 * paused, as it is under the sheet, unless a headless task is running; native
 * code finishes the task once the attempt settles. Keep the key in sync with
 * `PaymentConstants.SHEET_AUTHORIZATION_TASK` in the Android sources.
 */
export const SHEET_AUTHORIZATION_TASK = 'ReactNativePaySheetAuthorization'

let registered = false

/** Registers the task once, on Android. */
export function registerSheetAuthorizationTask(): void {
  if (registered || Platform.OS !== 'android') return
  registered = true
  // Never settles by itself: native code finishes the task, and a promise
  // that settled would finish it at once.
  AppRegistry.registerHeadlessTask(
    SHEET_AUTHORIZATION_TASK,
    () => () => new Promise<void>(() => {})
  )
}
