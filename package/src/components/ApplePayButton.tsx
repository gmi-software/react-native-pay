import React from 'react'
import { Platform, type ViewProps } from 'react-native'
import type { ReactNativeView } from 'react-native-nitro-modules'
import type {
  ApplePayButtonMethods,
  ApplePayButtonProps as NativeApplePayButtonProps,
} from '../specs/ApplePayButton.nitro'
import ApplePayButtonConfig from '../../nitrogen/generated/shared/json/ApplePayButtonConfig.json'
import { requireNitro } from '../nitro'
import {
  type PayButtonPressProps,
  useDevWarning,
  usePayButtonPress,
} from './usePayButtonPress'

let NativeApplePayButton:
  | ReactNativeView<NativeApplePayButtonProps, ApplePayButtonMethods>
  | undefined

// Created on first render, so importing the package does not need Nitro.
function getNativeApplePayButton() {
  if (NativeApplePayButton === undefined) {
    NativeApplePayButton = requireNitro().getHostComponent<
      NativeApplePayButtonProps,
      ApplePayButtonMethods
    >('ApplePayButton', () => ApplePayButtonConfig)
  }
  return NativeApplePayButton
}

export interface ApplePayButtonProps
  extends Omit<NativeApplePayButtonProps, 'onPress'>,
    PayButtonPressProps,
    ViewProps {}

/**
 * The native Apple Pay button (`PKPaymentButton`). iOS only: it renders
 * nothing on Android.
 */
export function ApplePayButton(props: ApplePayButtonProps) {
  const isWrongPlatform = Platform.OS !== 'ios'
  useDevWarning(
    isWrongPlatform,
    `ApplePayButton is iOS-only, so it renders nothing on ${Platform.OS}. Render GooglePayButton there.`
  )
  if (isWrongPlatform) return null
  return <NativeButton {...props} />
}

function NativeButton({ onPress, disabled, ...props }: ApplePayButtonProps) {
  const press = usePayButtonPress('ApplePayButton', onPress, disabled)
  const Button = getNativeApplePayButton()
  return <Button {...props} onPress={press} />
}
