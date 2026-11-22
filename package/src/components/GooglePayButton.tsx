import React from 'react'
import { Platform, type ViewProps } from 'react-native'
import type { ReactNativeView } from 'react-native-nitro-modules'
import type {
  GooglePayButtonMethods,
  GooglePayButtonProps as NativeGooglePayButtonProps,
} from '../specs/GooglePayButton.nitro'
import GooglePayButtonConfig from '../../nitrogen/generated/shared/json/GooglePayButtonConfig.json'
import { requireNitro } from '../nitro'
import {
  type PayButtonPressProps,
  useDevWarning,
  usePayButtonPress,
} from './usePayButtonPress'
import { googlePayButtonConfigError } from './googlePayButtonConfig'

let NativeGooglePayButton:
  | ReactNativeView<NativeGooglePayButtonProps, GooglePayButtonMethods>
  | undefined

// Created on first render, so importing the package does not need Nitro.
function getNativeGooglePayButton() {
  if (NativeGooglePayButton === undefined) {
    NativeGooglePayButton = requireNitro().getHostComponent<
      NativeGooglePayButtonProps,
      GooglePayButtonMethods
    >('GooglePayButton', () => GooglePayButtonConfig)
  }
  return NativeGooglePayButton
}

export interface GooglePayButtonProps
  extends Omit<NativeGooglePayButtonProps, 'onPress'>,
    PayButtonPressProps,
    ViewProps {}

/**
 * The native Google Pay button (`PayButton`). Android only: it renders
 * nothing on iOS.
 */
export function GooglePayButton(props: GooglePayButtonProps) {
  const isWrongPlatform = Platform.OS !== 'android'
  useDevWarning(
    isWrongPlatform,
    `GooglePayButton is Android-only, so it renders nothing on ${Platform.OS}. Render ApplePayButton there.`
  )
  const configError = __DEV__ ? googlePayButtonConfigError(props) : null
  useDevWarning(
    !isWrongPlatform && configError !== null,
    `GooglePayButton: ${configError}. Android keeps the button it showed before, with the default cards if it never had valid ones.`
  )
  if (isWrongPlatform) return null
  return <NativeButton {...props} />
}

function NativeButton({ onPress, disabled, ...props }: GooglePayButtonProps) {
  const press = usePayButtonPress('GooglePayButton', onPress, disabled)
  const Button = getNativeGooglePayButton()
  return <Button {...props} onPress={press} />
}
