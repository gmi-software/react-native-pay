import {
  withApplePay,
  setApplePayEntitlement,
  setApplePayMerchantIdentifiersInInfoPlist,
} from '../withApplePay'

const mockWithEntitlementsPlist = jest.fn(
  (config: Record<string, unknown>, action: (input: any) => any) =>
    action('modResults' in config ? config : { modResults: config })
)
const mockWithInfoPlist = jest.fn(
  (config: Record<string, unknown>, action: (input: any) => any) =>
    action('modResults' in config ? config : { modResults: config })
)

jest.mock('expo/config-plugins', () => ({
  withEntitlementsPlist: (config: any, action: (input: any) => any) =>
    mockWithEntitlementsPlist(config, action),
  withInfoPlist: (config: any, action: (input: any) => any) =>
    mockWithInfoPlist(config, action),
}))

describe('withApplePay', () => {
  it('adds a single merchant entitlement', () => {
    const result = setApplePayEntitlement('merchant.com.one', {})
    expect(result).toEqual({
      'com.apple.developer.in-app-payments': ['merchant.com.one'],
    })
  })

  it('adds multiple merchants and de-duplicates existing values', () => {
    const result = setApplePayEntitlement(
      ['merchant.com.a', 'merchant.com.b', 'merchant.com.a', ''],
      {
        'com.apple.developer.in-app-payments': ['merchant.com.a'],
      }
    )
    expect(result).toEqual({
      'com.apple.developer.in-app-payments': [
        'merchant.com.a',
        'merchant.com.b',
      ],
    })
  })

  it('writes merchant identifiers into Info.plist', () => {
    const result = setApplePayMerchantIdentifiersInInfoPlist(
      ['merchant.com.a', 'merchant.com.b', 'merchant.com.a', ''],
      {}
    )

    expect(result).toEqual({
      ReactNativePayApplePayMerchantIdentifiers: [
        'merchant.com.a',
        'merchant.com.b',
      ],
    })
  })

  it('does not modify config when merchantIdentifier is missing', () => {
    const config = { name: 'app' }
    const result = withApplePay(config as any, {})
    expect(result).toBe(config)
    expect(mockWithEntitlementsPlist).not.toHaveBeenCalled()
    expect(mockWithInfoPlist).not.toHaveBeenCalled()
  })

  it('applies entitlements when merchantIdentifier is provided', () => {
    const config = {}
    const result = withApplePay(config as any, {
      merchantIdentifier: 'merchant.com.test',
    })

    expect(mockWithEntitlementsPlist).toHaveBeenCalledTimes(1)
    expect(mockWithInfoPlist).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      modResults: {
        'com.apple.developer.in-app-payments': ['merchant.com.test'],
        ReactNativePayApplePayMerchantIdentifiers: ['merchant.com.test'],
      },
    })
  })
})
