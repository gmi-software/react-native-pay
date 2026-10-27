import {
  WarningAggregator,
  withEntitlementsPlist,
  withInfoPlist,
  type ConfigPlugin,
} from 'expo/config-plugins'
import type { ReactNativePayPluginProps } from './type'

const APPLE_PAY_ENTITLEMENT_KEY = 'com.apple.developer.in-app-payments'
const APPLE_PAY_INFO_PLIST_KEY = 'ReactNativePayApplePayMerchantIdentifiers'
const MERCHANT_ID_PREFIX = 'merchant.'

export function setApplePayEntitlement(
  merchantIdentifiers: string | string[],
  entitlements: Record<string, any>
): Record<string, any> {
  const merchants: string[] = entitlements[APPLE_PAY_ENTITLEMENT_KEY] ?? []

  if (!Array.isArray(merchantIdentifiers)) {
    merchantIdentifiers = [merchantIdentifiers]
  }

  for (const id of merchantIdentifiers) {
    if (id && !merchants.includes(id)) {
      merchants.push(id)
    }
  }

  if (merchants.length) {
    entitlements[APPLE_PAY_ENTITLEMENT_KEY] = merchants
  }
  return entitlements
}

export function setApplePayMerchantIdentifiersInInfoPlist(
  merchantIdentifiers: string | string[],
  infoPlist: Record<string, any>
): Record<string, any> {
  const merchants: string[] = Array.isArray(merchantIdentifiers)
    ? merchantIdentifiers.filter(Boolean)
    : [merchantIdentifiers].filter(Boolean)

  if (merchants.length) {
    infoPlist[APPLE_PAY_INFO_PLIST_KEY] = [...new Set(merchants)]
  }

  return infoPlist
}

export const withApplePay: ConfigPlugin<ReactNativePayPluginProps> = (
  expoConfig,
  { merchantIdentifier }
) => {
  const merchantIds = [merchantIdentifier ?? []].flat().filter(Boolean)

  // If merchantIdentifier is not passed Apple Pay won't be initialize
  if (!merchantIds.length) {
    return expoConfig
  }

  for (const id of merchantIds) {
    if (!id.startsWith(MERCHANT_ID_PREFIX)) {
      WarningAggregator.addWarningIOS(
        '@gmisoftware/react-native-pay',
        `merchantIdentifier "${id}" does not start with "${MERCHANT_ID_PREFIX}". Apple Pay merchant IDs look like "merchant.com.example.app".`,
        'https://gmi-software.github.io/react-native-pay/docs/setup/ios-apple-pay'
      )
    }
  }

  const withEntitlements = withEntitlementsPlist(expoConfig, (config) => {
    config.modResults = setApplePayEntitlement(merchantIds, config.modResults)
    return config
  })

  return withInfoPlist(withEntitlements, (config) => {
    config.modResults = setApplePayMerchantIdentifiersInInfoPlist(
      merchantIds,
      config.modResults
    )
    return config
  })
}
