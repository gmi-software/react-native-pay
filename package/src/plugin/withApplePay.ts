import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins'
import type { ReactNativePayPluginProps } from './type'

export function setApplePayEntitlement(
  merchantIdentifiers: string | string[],
  entitlements: Record<string, any>
): Record<string, any> {
  const key = 'com.apple.developer.in-app-payments'

  const merchants: string[] = entitlements[key] ?? []

  if (!Array.isArray(merchantIdentifiers)) {
    merchantIdentifiers = [merchantIdentifiers]
  }

  for (const id of merchantIdentifiers) {
    if (id && !merchants.includes(id)) {
      merchants.push(id)
    }
  }

  if (merchants.length) {
    entitlements[key] = merchants
  }
  return entitlements
}

export const withApplePay: ConfigPlugin<ReactNativePayPluginProps> = (
  expoConfig,
  { merchantIdentifier }
) => {
  // If merchantIdentifier is not passed Apple Pay won't be initialize
  if (!merchantIdentifier) {
    return expoConfig
  }

  return withEntitlementsPlist(expoConfig, (config) => {
    config.modResults = setApplePayEntitlement(
      merchantIdentifier,
      config.modResults
    )
    return config
  })
}
