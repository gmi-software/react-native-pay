import {
  AndroidConfig,
  withAndroidManifest,
  type ConfigPlugin,
} from 'expo/config-plugins'
import type { ReactNativePayPluginProps } from './type'

const {
  addMetaDataItemToMainApplication,
  getMainApplicationOrThrow,
  removeMetaDataItemFromMainApplication,
} = AndroidConfig.Manifest

export const withGooglePay: ConfigPlugin<ReactNativePayPluginProps> = (
  expoConfig,
  { enableGooglePay = false }
) => {
  return withAndroidManifest(expoConfig, (config) => {
    config.modResults = setGooglePayMetaData(enableGooglePay, config.modResults)
    return config
  })
}

export function setGooglePayMetaData(
  enabled: boolean,
  modResults: AndroidConfig.Manifest.AndroidManifest
): AndroidConfig.Manifest.AndroidManifest {
  const GOOGLE_PAY_META_NAME = 'com.google.android.gms.wallet.api.enabled'
  const mainApplication = getMainApplicationOrThrow(modResults)
  if (enabled) {
    addMetaDataItemToMainApplication(
      mainApplication,
      GOOGLE_PAY_META_NAME,
      'true'
    )
  } else {
    removeMetaDataItemFromMainApplication(mainApplication, GOOGLE_PAY_META_NAME)
  }

  return modResults
}
