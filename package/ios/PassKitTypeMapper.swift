import PassKit
import Contacts
import NitroModules

// MARK: - Constants

private enum PaymentNetworkString {
    static let visa = "visa"
    static let mastercard = "mastercard"
    static let amex = "amex"
    static let discover = "discover"
    static let jcb = "jcb"
    static let maestro = "maestro"
    static let electron = "electron"
    static let elo = "elo"
    static let idcredit = "idcredit"
    static let interac = "interac"
    static let privateLabel = "privateLabel"
}

// MARK: - Type Converter

/// Converts Apple PassKit and Contacts types to Nitro-generated types
enum PassKitTypeMapper {
    
    // MARK: - Enum Conversions
    
    static func convert(_ network: PKPaymentNetwork) -> PaymentNetwork {
        switch network {
        case .visa: return .visa
        case .masterCard: return .mastercard
        case .amex: return .amex
        case .discover: return .discover
        case .JCB: return .jcb
        case .maestro: return .maestro
        case .electron: return .electron
        case .elo: return .elo
        case .idCredit: return .idcredit
        case .interac: return .interac
        case .privateLabel: return .privatelabel
        default: return .visa
        }
    }
    
    static func convert(_ type: PKPaymentMethodType) -> PaymentMethodType {
        switch type {
        case .unknown: return .unknown
        case .debit: return .debit
        case .credit: return .credit
        case .prepaid: return .prepaid
        case .store: return .store
        default: return .unknown
        }
    }
    
    
    static func convertContactType(_ type: Contacts.CNContactType) -> CNContactType {
        switch type {
        case .person: return .person
        case .organization: return .organization
        @unknown default: return .person
        }
    }
    
    // MARK: - String to Enum Conversions
    
    static func convertToPKPaymentNetwork(_ string: String) -> PKPaymentNetwork? {
        switch string {
        case PaymentNetworkString.visa: return .visa
        case PaymentNetworkString.mastercard: return .masterCard
        case PaymentNetworkString.amex: return .amex
        case PaymentNetworkString.discover: return .discover
        case PaymentNetworkString.jcb: return .JCB
        case PaymentNetworkString.maestro: return .maestro
        case PaymentNetworkString.electron: return .electron
        case PaymentNetworkString.elo: return .elo
        case PaymentNetworkString.idcredit: return .idCredit
        case PaymentNetworkString.interac: return .interac
        case PaymentNetworkString.privateLabel: return .privateLabel
        default: return nil
        }
    }
    
    // MARK: - Struct Conversions
    
    @available(iOS 13.4, *)
    static func convert(_ pkPass: PassKit.PKSecureElementPass) -> PKSecureElementPass {
        // Convert passActivationState using type inference from the property
        let activationState: PassActivationState
        switch pkPass.passActivationState {
        case .activated: activationState = .activated
        case .requiresActivation: activationState = .requiresactivation
        case .activating: activationState = .activating
        case .suspended: activationState = .suspended
        case .deactivated: activationState = .deactivated
        @unknown default: activationState = .deactivated
        }
        
        return PKSecureElementPass.init(
            primaryAccountIdentifier: pkPass.primaryAccountIdentifier,
            primaryAccountNumberSuffix: pkPass.primaryAccountNumberSuffix,
            deviceAccountIdentifier: pkPass.deviceAccountIdentifier,
            deviceAccountNumberSuffix: pkPass.deviceAccountNumberSuffix,
            passActivationState: activationState,
            devicePassIdentifier: pkPass.devicePassIdentifier,
            pairedTerminalIdentifier: pkPass.pairedTerminalIdentifier,
            passTypeIdentifier: pkPass.passTypeIdentifier,
            serialNumber: pkPass.serialNumber,
            organizationName: pkPass.organizationName
        )
    }
    
    @available(iOS 13.0, *)
    static func convert(_ contact: Contacts.CNContact) -> CNContact {
        let contactType = convertContactType(contact.contactType)
        
        return CNContact.init(
            identifier: contact.identifier,
            contactType: contactType,
            namePrefix: contact.namePrefix,
            givenName: contact.givenName,
            middleName: contact.middleName,
            familyName: contact.familyName,
            previousFamilyName: contact.previousFamilyName,
            nameSuffix: contact.nameSuffix,
            nickname: contact.nickname,
            organizationName: contact.organizationName,
            departmentName: contact.departmentName,
            jobTitle: contact.jobTitle,
            phoneticGivenName: contact.phoneticGivenName,
            phoneticMiddleName: contact.phoneticMiddleName,
            phoneticFamilyName: contact.phoneticFamilyName,
            phoneticOrganizationName: contact.phoneticOrganizationName,
            note: contact.note,
            imageDataAvailable: contact.imageDataAvailable,
            phoneNumbers: convertPhoneNumbers(contact.phoneNumbers),
            emailAddresses: convertEmailAddresses(contact.emailAddresses),
            postalAddresses: convertPostalAddresses(contact.postalAddresses)
        )
    }
    
    // MARK: - Payment Contacts

    /// Reports only what the request asked for. Apple Pay returns email and
    /// phone with the shipping contact, also when no address was requested.
    static func convertPaymentDetails(
        billingContact: PKContact?,
        shippingContact: PKContact?,
        requiredBillingFields: Set<PKContactField>,
        requiredShippingFields: Set<PKContactField>
    ) -> PaymentDetails {
        return PaymentDetails.init(
            billingContact: requiredBillingFields.contains(.postalAddress)
                ? billingContact.map { convertPaymentContact($0) } : nil,
            shippingContact: requiredShippingFields.contains(.postalAddress)
                ? shippingContact.map { convertPaymentContact($0) } : nil,
            emailAddress: requiredShippingFields.contains(.emailAddress)
                ? nonEmpty(shippingContact?.emailAddress) : nil,
            phoneNumber: requiredShippingFields.contains(.phoneNumber)
                ? nonEmpty(shippingContact?.phoneNumber?.stringValue) : nil
        )
    }

    static func convertPaymentContact(_ contact: PKContact) -> PaymentContact {
        let name = contact.name
        return PaymentContact.init(
            name: name.flatMap {
                nonEmpty(PersonNameComponentsFormatter.localizedString(from: $0, style: .default))
            },
            givenName: nonEmpty(name?.givenName),
            familyName: nonEmpty(name?.familyName),
            postalAddress: contact.postalAddress.map { convertPostalAddress($0) }
        )
    }

    static func convertPostalAddress(_ address: Contacts.CNPostalAddress) -> CNPostalAddress {
        // Apple Pay reports the country code in lowercase ("us").
        return CNPostalAddress.init(
            street: nonEmpty(address.street),
            city: nonEmpty(address.city),
            state: nonEmpty(address.state),
            postalCode: nonEmpty(address.postalCode),
            country: nonEmpty(address.country),
            isoCountryCode: nonEmpty(address.isoCountryCode)?.uppercased()
        )
    }

    // MARK: - Private Helpers

    private static func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }
    
    @available(iOS 13.0, *)
    private static func convertPhoneNumbers(_ phoneNumbers: [Contacts.CNLabeledValue<Contacts.CNPhoneNumber>]) -> [CNLabeledPhoneNumber] {
        return phoneNumbers.map { labeledValue in
            let contactsPhoneNumber = labeledValue.value
            let nitroPhoneNumber = CNPhoneNumber.init(stringValue: contactsPhoneNumber.stringValue)
            
            return CNLabeledPhoneNumber.init(
                label: labeledValue.label,
                value: nitroPhoneNumber
            )
        }
    }
    
    @available(iOS 13.0, *)
    private static func convertEmailAddresses(_ emailAddresses: [Contacts.CNLabeledValue<NSString>]) -> [CNLabeledEmailAddress] {
        return emailAddresses.map { labeledValue in
            // Extract the NSString value and convert to Swift String
            let emailString = String(labeledValue.value)
            let labelString = labeledValue.label
            
            // Create Nitro CNLabeledEmailAddress with Swift String values
            return CNLabeledEmailAddress.init(
                label: labelString,
                value: emailString
            )
        }
    }
    
    @available(iOS 13.0, *)
    private static func convertPostalAddresses(_ postalAddresses: [Contacts.CNLabeledValue<Contacts.CNPostalAddress>]) -> [CNLabeledPostalAddress] {
        return postalAddresses.map { labeledValue in
            let contactsAddress = labeledValue.value
            let nitroAddress = CNPostalAddress.init(
                street: contactsAddress.street,
                city: contactsAddress.city,
                state: contactsAddress.state,
                postalCode: contactsAddress.postalCode,
                country: contactsAddress.country,
                isoCountryCode: contactsAddress.isoCountryCode
            )
            
            return CNLabeledPostalAddress.init(
                label: labeledValue.label,
                value: nitroAddress
            )
        }
    }
}

