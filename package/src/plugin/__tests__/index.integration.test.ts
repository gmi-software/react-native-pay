import {
  AndroidConfig,
  withPlugins,
  type ExportedConfig,
  type ExportedConfigWithProps,
} from 'expo/config-plugins'
import withReactNativePay from '../index'
import type { ReactNativePayPluginProps } from '../type'

const GOOGLE_PAY_META_NAME = 'com.google.android.gms.wallet.api.enabled'

function createManifest(
  existingValue?: string
): AndroidConfig.Manifest.AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      queries: [],
      application: [
        {
          '$': { 'android:name': '.MainApplication' },
          'meta-data': existingValue
            ? [
                {
                  $: {
                    'android:name': GOOGLE_PAY_META_NAME,
                    'android:value': existingValue,
                  },
                },
              ]
            : [],
        },
      ],
    },
  }
}

// Same entry shapes Expo resolves from app.json: a bare name or [name, props]
function applyPlugin(props?: ReactNativePayPluginProps): ExportedConfig {
  const config = {
    name: 'app',
    slug: 'app',
    _internal: { projectRoot: __dirname },
  }
  return withPlugins(config, [
    props === undefined ? withReactNativePay : [withReactNativePay, props],
  ])
}

async function runManifestMods(
  config: ExportedConfig,
  manifest: AndroidConfig.Manifest.AndroidManifest
): Promise<AndroidConfig.Manifest.AndroidManifest> {
  const mod = config.mods?.android?.manifest
  if (!mod) {
    return manifest
  }
  const result = await mod({
    ...config,
    modResults: manifest,
  } as ExportedConfigWithProps<AndroidConfig.Manifest.AndroidManifest>)
  return result.modResults
}

function googlePayValue(manifest: AndroidConfig.Manifest.AndroidManifest) {
  return AndroidConfig.Manifest.getMainApplicationMetaDataValue(
    manifest,
    GOOGLE_PAY_META_NAME
  )
}

describe('withReactNativePay with Expo mods', () => {
  it('runs when listed without options and changes nothing', async () => {
    const config = applyPlugin()

    expect(config.mods?.android?.manifest).toBeUndefined()
    expect(config.mods?.ios?.entitlements).toBeUndefined()
    expect(config.mods?.ios?.infoPlist).toBeUndefined()
  })

  it('keeps an existing Google Pay entry when enableGooglePay is omitted', async () => {
    const config = applyPlugin({ merchantIdentifier: 'merchant.com.test' })

    const manifest = await runManifestMods(config, createManifest('true'))

    expect(googlePayValue(manifest)).toBe('true')
  })

  it('adds the Google Pay entry once when enableGooglePay is true', async () => {
    const config = applyPlugin({ enableGooglePay: true })

    expect(
      googlePayValue(await runManifestMods(config, createManifest()))
    ).toBe('true')

    const manifest = await runManifestMods(config, createManifest('true'))
    const metaData =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)['meta-data']
    expect(
      metaData?.filter(
        (item) => item.$['android:name'] === GOOGLE_PAY_META_NAME
      )
    ).toHaveLength(1)
  })

  it('removes the Google Pay entry when enableGooglePay is false', async () => {
    const config = applyPlugin({ enableGooglePay: false })

    const manifest = await runManifestMods(config, createManifest('true'))

    expect(googlePayValue(manifest)).toBeNull()
  })
})
