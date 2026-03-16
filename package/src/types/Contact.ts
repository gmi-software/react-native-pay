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
