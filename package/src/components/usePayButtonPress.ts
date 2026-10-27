import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { callback } from 'react-native-nitro-modules'

/** The props both pay buttons add to those of their native view. */
export interface PayButtonPressProps {
  /** Called when the user taps the button. */
  onPress?: () => void
  /**
   * Ignores taps while `true`, for example while a payment is in progress.
   * The button looks the same: Apple's guidelines ask not to make the Apple
   * Pay button appear unavailable, and Google's do not allow changing the
   * Google Pay button's color.
   */
  disabled?: boolean
}

type PressHandler = () => void

/**
 * What `callback(fn)` from react-native-nitro-modules returns. Earlier
 * versions of the buttons required it, so it still works.
 */
type WrappedPressHandler = { f: PressHandler }

function isWrappedPressHandler(value: unknown): value is WrappedPressHandler {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<WrappedPressHandler>).f === 'function'
  )
}

/** Logs `message` in development builds when `condition` becomes true. */
export function useDevWarning(condition: boolean, message: string) {
  useEffect(() => {
    if (__DEV__ && condition) console.warn(message)
  }, [condition, message])
}

/**
 * Returns the `onPress` a pay button host component receives, wrapped with
 * `callback()` once for the button's lifetime. It reads the latest `onPress`
 * and `disabled` at tap time, so a new handler on each render does not update
 * the native view.
 */
export function usePayButtonPress(
  component: string,
  onPress: PressHandler | undefined,
  disabled: boolean | undefined
) {
  const latest = useRef({ onPress, disabled })
  useLayoutEffect(() => {
    latest.current = { onPress, disabled }
  })

  const [press] = useState(() =>
    callback(() => {
      const { onPress: handler, disabled: isDisabled } = latest.current
      if (isDisabled) return
      if (isWrappedPressHandler(handler)) handler.f()
      else handler?.()
    })
  )

  useDevWarning(
    isWrappedPressHandler(onPress),
    `${component}: onPress no longer needs callback() from react-native-nitro-modules. Pass the function itself.`
  )

  return press
}
