export interface ReactNativePayPluginProps {
  /**
   * Apple Pay merchant ID(s), each starting with `merchant.`. If omitted, the
   * Apple Pay entitlement is not added.
   */
  merchantIdentifier?: string | string[]
  /**
   * `true` adds the Google Pay meta-data to the Android manifest and `false`
   * removes it. If omitted, the manifest is left as it is, so an entry added
   * by another plugin stays.
   */
  enableGooglePay?: boolean
}
