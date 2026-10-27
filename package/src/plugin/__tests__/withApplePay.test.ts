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

const mockAddWarningIOS = jest.fn()

jest.mock('expo/config-plugins', () => ({
  WarningAggregator: {
    addWarningIOS: (...args: any[]) => mockAddWarningIOS(...args),
  },
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

  it.each([
    ['is missing', {}],
    ['is an empty list', { merchantIdentifier: [] }],
    ['has only empty IDs', { merchantIdentifier: [''] }],
  ])('does not modify config when merchantIdentifier %s', (_label, props) => {
    const config = { name: 'app' }
    const result = withApplePay(config as any, props)
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
        'ReactNativePayApplePayMerchantIdentifiers': ['merchant.com.test'],
      },
    })
  })

  it('warns about merchant identifiers without the merchant. prefix and still adds them', () => {
    const result = withApplePay({} as any, {
      merchantIdentifier: ['merchant.com.ok', 'com.example.app', ''],
    })

    expect(mockAddWarningIOS).toHaveBeenCalledTimes(1)
    expect(mockAddWarningIOS).toHaveBeenCalledWith(
      '@gmisoftware/react-native-pay',
      expect.stringContaining('"com.example.app"'),
      expect.any(String)
    )
    expect(result).toEqual({
      modResults: {
        'com.apple.developer.in-app-payments': [
          'merchant.com.ok',
          'com.example.app',
        ],
        'ReactNativePayApplePayMerchantIdentifiers': [
          'merchant.com.ok',
          'com.example.app',
        ],
      },
    })
  })

  it('does not warn about valid merchant identifiers', () => {
    withApplePay({} as any, { merchantIdentifier: 'merchant.com.test' })
    expect(mockAddWarningIOS).not.toHaveBeenCalled()
  })
})
