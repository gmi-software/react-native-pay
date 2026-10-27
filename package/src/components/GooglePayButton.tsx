import React from 'react'
import { Platform, type ViewProps } from 'react-native'
import { getHostComponent } from 'react-native-nitro-modules'
import type {
  GooglePayButtonMethods,
  GooglePayButtonProps as NativeGooglePayButtonProps,
} from '../specs/GooglePayButton.nitro'
import GooglePayButtonConfig from '../../nitrogen/generated/shared/json/GooglePayButtonConfig.json'
import {
  type PayButtonPressProps,
  useDevWarning,
  usePayButtonPress,
} from './usePayButtonPress'

const NativeGooglePayButton = getHostComponent<
  NativeGooglePayButtonProps,
  GooglePayButtonMethods
>('GooglePayButton', () => GooglePayButtonConfig)

export interface GooglePayButtonProps
  extends Omit<NativeGooglePayButtonProps, 'onPress'>,
    PayButtonPressProps,
    ViewProps {}

/**
 * The native Google Pay button (`PayButton`). Android only: it renders
 * nothing on iOS.
 */
export function GooglePayButton({
  onPress,
  disabled,
  ...props
}: GooglePayButtonProps) {
  const press = usePayButtonPress('GooglePayButton', onPress, disabled)
  const isWrongPlatform = Platform.OS !== 'android'
  useDevWarning(
    isWrongPlatform,
    `GooglePayButton is Android-only, so it renders nothing on ${Platform.OS}. Render ApplePayButton there.`
  )
  if (isWrongPlatform) return null
  return <NativeGooglePayButton {...props} onPress={press} />
}
