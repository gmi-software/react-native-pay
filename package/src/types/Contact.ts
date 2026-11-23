/**
 * Contact types based on CNContact from Contacts framework
 * @see https://developer.apple.com/documentation/contacts/cncontact
 */

export type CNContactType = 'person' | 'organization'

export interface CNPhoneNumber {
  stringValue: string
}

export interface CNPostalAddress {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  isoCountryCode?: string
  /**
   * Android only: the region as an ISO 3166-2 code, such as `'US-CA'`, with
   * the country prefix. Google Pay can return it for full billing and shipping
   * addresses, and omits it when it has no code. On iOS it is always omitted.
   */
  isoAdministrativeArea?: string
}

export interface CNLabeledPhoneNumber {
  label?: string
  value: CNPhoneNumber
}

export interface CNLabeledEmailAddress {
  label?: string
  value: string
}

export interface CNLabeledPostalAddress {
  label?: string
  value: CNPostalAddress
}

export interface CNContact {
  identifier: string
  contactType: CNContactType
  namePrefix: string
  givenName: string
  middleName: string
  familyName: string
  previousFamilyName: string
  nameSuffix: string
  nickname: string
  organizationName: string
  departmentName: string
  jobTitle: string
  phoneticGivenName: string
  phoneticMiddleName: string
  phoneticFamilyName: string
  phoneticOrganizationName?: string // Available from iOS 10.0+
  note: string
  imageDataAvailable?: boolean // Available from iOS 9.0+
  phoneNumbers: CNLabeledPhoneNumber[]
  emailAddresses: CNLabeledEmailAddress[]
  postalAddresses: CNLabeledPostalAddress[]
}

/**
 * A name and postal address the payer chose in the payment sheet.
 * Returned as `PaymentResult.billingContact` and `PaymentResult.shippingContact`.
 */
export interface PaymentContact {
  /** Full name, for example `'Jane Appleseed'`. */
  name?: string
  /** iOS only: Google Pay returns the name as one string. */
  givenName?: string
  /** iOS only: Google Pay returns the name as one string. */
  familyName?: string
  /**
   * Parts the payer left empty are omitted. `street` joins the address lines
   * with `'\n'`, and `isoCountryCode` is uppercase ISO 3166-1 alpha-2.
   */
  postalAddress?: CNPostalAddress
}
