import React from 'react'
import { Platform, type ViewProps } from 'react-native'
import { getHostComponent } from 'react-native-nitro-modules'
import type {
  ApplePayButtonMethods,
  ApplePayButtonProps as NativeApplePayButtonProps,
} from '../specs/ApplePayButton.nitro'
import ApplePayButtonConfig from '../../nitrogen/generated/shared/json/ApplePayButtonConfig.json'
import {
  type PayButtonPressProps,
  useDevWarning,
  usePayButtonPress,
} from './usePayButtonPress'

const NativeApplePayButton = getHostComponent<
  NativeApplePayButtonProps,
  ApplePayButtonMethods
>('ApplePayButton', () => ApplePayButtonConfig)

export interface ApplePayButtonProps
  extends Omit<NativeApplePayButtonProps, 'onPress'>,
    PayButtonPressProps,
    ViewProps {}

/**
 * The native Apple Pay button (`PKPaymentButton`). iOS only: it renders
 * nothing on Android.
 */
export function ApplePayButton({
  onPress,
  disabled,
  ...props
}: ApplePayButtonProps) {
  const press = usePayButtonPress('ApplePayButton', onPress, disabled)
  const isWrongPlatform = Platform.OS !== 'ios'
  useDevWarning(
    isWrongPlatform,
    `ApplePayButton is iOS-only, so it renders nothing on ${Platform.OS}. Render GooglePayButton there.`
  )
  if (isWrongPlatform) return null
  return <NativeApplePayButton {...props} onPress={press} />
}
