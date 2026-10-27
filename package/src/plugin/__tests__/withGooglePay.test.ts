const mockAddMetaDataItemToMainApplication = jest.fn()
const mockGetMainApplicationOrThrow = jest.fn()
const mockRemoveMetaDataItemFromMainApplication = jest.fn()
const mockWithAndroidManifest = jest.fn(
  (config: Record<string, unknown>, action: (input: any) => any) =>
    action({ modResults: config })
)

jest.mock('expo/config-plugins', () => ({
  AndroidConfig: {
    Manifest: {
      addMetaDataItemToMainApplication: (...args: any[]) =>
        mockAddMetaDataItemToMainApplication(...args),
      getMainApplicationOrThrow: (...args: any[]) =>
        mockGetMainApplicationOrThrow(...args),
      removeMetaDataItemFromMainApplication: (...args: any[]) =>
        mockRemoveMetaDataItemFromMainApplication(...args),
    },
  },
  withAndroidManifest: (config: any, action: (input: any) => any) =>
    mockWithAndroidManifest(config, action),
}))

import { setGooglePayMetaData, withGooglePay } from '../withGooglePay'

describe('withGooglePay', () => {
  beforeEach(() => {
    mockGetMainApplicationOrThrow.mockReturnValue({ name: 'main-app' })
  })

  it('enables Google Pay metadata when enabled=true', () => {
    const manifest = { application: [] }
    const result = setGooglePayMetaData(true, manifest as any)

    expect(result).toBe(manifest)
    expect(mockGetMainApplicationOrThrow).toHaveBeenCalledWith(manifest)
    expect(mockAddMetaDataItemToMainApplication).toHaveBeenCalledWith(
      { name: 'main-app' },
      'com.google.android.gms.wallet.api.enabled',
      'true'
    )
    expect(mockRemoveMetaDataItemFromMainApplication).not.toHaveBeenCalled()
  })

  it('removes Google Pay metadata when enabled=false', () => {
    const manifest = { application: [] }
    const result = setGooglePayMetaData(false, manifest as any)

    expect(result).toBe(manifest)
    expect(mockGetMainApplicationOrThrow).toHaveBeenCalledWith(manifest)
    expect(mockRemoveMetaDataItemFromMainApplication).toHaveBeenCalledWith(
      { name: 'main-app' },
      'com.google.android.gms.wallet.api.enabled'
    )
    expect(mockAddMetaDataItemToMainApplication).not.toHaveBeenCalled()
  })

  it('wires withAndroidManifest and applies metadata by plugin prop', () => {
    const config = { name: 'app' }
    const result = withGooglePay(config as any, { enableGooglePay: true })

    expect(mockWithAndroidManifest).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ modResults: { name: 'app' } })
    expect(mockAddMetaDataItemToMainApplication).toHaveBeenCalled()
  })

  it.each([
    ['enableGooglePay is omitted', {}],
    ['enableGooglePay is null', { enableGooglePay: null } as any],
  ])('leaves the manifest alone when %s', (_label, props) => {
    const config = { name: 'app' }
    const result = withGooglePay(config as any, props)

    expect(result).toBe(config)
    expect(mockWithAndroidManifest).not.toHaveBeenCalled()
    expect(mockAddMetaDataItemToMainApplication).not.toHaveBeenCalled()
    expect(mockRemoveMetaDataItemFromMainApplication).not.toHaveBeenCalled()
  })
})
