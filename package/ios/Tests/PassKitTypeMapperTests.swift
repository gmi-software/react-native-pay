import Contacts
import PassKit
import XCTest
@testable import NitroPay

final class PassKitTypeMapperTests: XCTestCase {

    private let networkNames = [
        "visa", "mastercard", "amex", "discover", "jcb", "maestro",
        "electron", "elo", "idcredit", "interac", "privateLabel",
    ]

    // Swift drops this `convert` overload when it is looked up before the
    // C++ `PaymentNetwork` enum is imported. Naming the type in a signature
    // imports it first.
    private func convert(_ network: PKPaymentNetwork) -> PaymentNetwork {
        return PassKitTypeMapper.convert(network)
    }

    func testConvertsEveryNetworkNameToPassKitAndBack() throws {
        for name in networkNames {
            let pkNetwork = try XCTUnwrap(PassKitTypeMapper.convertToPKPaymentNetwork(name), name)
            XCTAssertEqual(convert(pkNetwork), PaymentNetwork(fromString: name), name)
        }
        XCTAssertEqual(PassKitTypeMapper.convertToPKPaymentNetwork("mastercard"), .masterCard)
        XCTAssertEqual(PassKitTypeMapper.convertToPKPaymentNetwork("idcredit"), .idCredit)
    }

    func testIgnoresUnknownNetworkNames() {
        XCTAssertNil(PassKitTypeMapper.convertToPKPaymentNetwork("unknown"))
        XCTAssertNil(PassKitTypeMapper.convertToPKPaymentNetwork("Visa"))
    }

    func testReportsUnsupportedPassKitNetworksAsVisa() {
        // Current behavior: PaymentNetwork has no "other" case.
        XCTAssertEqual(convert(.girocard), .visa)
    }

    func testConvertsPaymentMethodTypes() {
        XCTAssertEqual(PassKitTypeMapper.convert(PKPaymentMethodType.unknown), .unknown)
        XCTAssertEqual(PassKitTypeMapper.convert(PKPaymentMethodType.debit), .debit)
        XCTAssertEqual(PassKitTypeMapper.convert(PKPaymentMethodType.credit), .credit)
        XCTAssertEqual(PassKitTypeMapper.convert(PKPaymentMethodType.prepaid), .prepaid)
        XCTAssertEqual(PassKitTypeMapper.convert(PKPaymentMethodType.store), .store)
    }

    func testConvertsContacts() {
        let address = CNMutablePostalAddress()
        address.street = "1 Infinite Loop"
        address.city = "Cupertino"
        address.state = "CA"
        address.postalCode = "95014"
        address.country = "United States"
        address.isoCountryCode = "us"

        let contact = CNMutableContact()
        contact.contactType = .organization
        contact.givenName = "Jane"
        contact.familyName = "Appleseed"
        contact.organizationName = "Example Inc."
        contact.phoneNumbers = [
            CNLabeledValue(label: CNLabelPhoneNumberMobile, value: CNPhoneNumber(stringValue: "+1 555 0100")),
        ]
        contact.emailAddresses = [CNLabeledValue(label: CNLabelWork, value: "jane@example.com" as NSString)]
        contact.postalAddresses = [CNLabeledValue(label: CNLabelHome, value: address)]

        let converted = PassKitTypeMapper.convert(contact)

        XCTAssertEqual(converted.identifier, contact.identifier)
        XCTAssertEqual(converted.contactType, .organization)
        XCTAssertEqual(converted.givenName, "Jane")
        XCTAssertEqual(converted.familyName, "Appleseed")
        XCTAssertEqual(converted.organizationName, "Example Inc.")

        XCTAssertEqual(converted.phoneNumbers.count, 1)
        XCTAssertEqual(converted.phoneNumbers.first?.label, CNLabelPhoneNumberMobile)
        XCTAssertEqual(converted.phoneNumbers.first?.value.stringValue, "+1 555 0100")

        XCTAssertEqual(converted.emailAddresses.count, 1)
        XCTAssertEqual(converted.emailAddresses.first?.label, CNLabelWork)
        XCTAssertEqual(converted.emailAddresses.first?.value, "jane@example.com")

        XCTAssertEqual(converted.postalAddresses.count, 1)
        let postal = converted.postalAddresses.first
        XCTAssertEqual(postal?.label, CNLabelHome)
        XCTAssertEqual(postal?.value.street, "1 Infinite Loop")
        XCTAssertEqual(postal?.value.city, "Cupertino")
        XCTAssertEqual(postal?.value.state, "CA")
        XCTAssertEqual(postal?.value.postalCode, "95014")
        XCTAssertEqual(postal?.value.country, "United States")
        XCTAssertEqual(postal?.value.isoCountryCode, "us")
    }

    private func paymentContact(
        givenName: String? = nil,
        familyName: String? = nil,
        street: String = "",
        isoCountryCode: String = "",
        emailAddress: String? = nil,
        phoneNumber: String? = nil
    ) -> PKContact {
        let contact = PKContact()
        if givenName != nil || familyName != nil {
            var name = PersonNameComponents()
            name.givenName = givenName
            name.familyName = familyName
            contact.name = name
        }
        if !street.isEmpty || !isoCountryCode.isEmpty {
            let address = CNMutablePostalAddress()
            address.street = street
            address.isoCountryCode = isoCountryCode
            contact.postalAddress = address
        }
        contact.emailAddress = emailAddress
        contact.phoneNumber = phoneNumber.map { CNPhoneNumber(stringValue: $0) }
        return contact
    }

    func testConvertsPaymentContacts() {
        let address = CNMutablePostalAddress()
        address.street = "1 Infinite Loop\nBuilding 2"
        address.city = "Cupertino"
        address.state = "CA"
        address.postalCode = "95014"
        address.country = "United States"
        address.isoCountryCode = "us"
        let contact = paymentContact(givenName: "Jane", familyName: "Appleseed")
        contact.postalAddress = address

        let converted = PassKitTypeMapper.convertPaymentContact(contact)

        XCTAssertEqual(converted.name, "Jane Appleseed")
        XCTAssertEqual(converted.givenName, "Jane")
        XCTAssertEqual(converted.familyName, "Appleseed")
        XCTAssertEqual(converted.postalAddress?.street, "1 Infinite Loop\nBuilding 2")
        XCTAssertEqual(converted.postalAddress?.city, "Cupertino")
        XCTAssertEqual(converted.postalAddress?.state, "CA")
        XCTAssertEqual(converted.postalAddress?.postalCode, "95014")
        XCTAssertEqual(converted.postalAddress?.country, "United States")
        XCTAssertEqual(converted.postalAddress?.isoCountryCode, "US")
    }

    func testOmitsEmptyContactParts() {
        let converted = PassKitTypeMapper.convertPaymentContact(
            paymentContact(givenName: "Jane", street: "1 Main St", isoCountryCode: "gb")
        )

        XCTAssertEqual(converted.name, "Jane")
        XCTAssertNil(converted.familyName)
        XCTAssertEqual(converted.postalAddress?.street, "1 Main St")
        XCTAssertNil(converted.postalAddress?.city)
        XCTAssertNil(converted.postalAddress?.state)
        XCTAssertNil(converted.postalAddress?.postalCode)
        XCTAssertNil(converted.postalAddress?.country)
        XCTAssertEqual(converted.postalAddress?.isoCountryCode, "GB")
        XCTAssertNil(PassKitTypeMapper.convertPaymentContact(PKContact()).name)
    }

    func testReportsOnlyTheRequestedContactDetails() {
        let billing = paymentContact(givenName: "Bill", street: "1 Billing St")
        let shipping = paymentContact(
            givenName: "Sam",
            street: "2 Shipping St",
            emailAddress: "sam@example.com",
            phoneNumber: "+1 555 0100"
        )

        let everything = PassKitTypeMapper.convertPaymentDetails(
            billingContact: billing,
            shippingContact: shipping,
            requiredBillingFields: [.postalAddress, .name],
            requiredShippingFields: [.postalAddress, .name, .emailAddress, .phoneNumber]
        )
        XCTAssertEqual(everything.billingContact?.postalAddress?.street, "1 Billing St")
        XCTAssertEqual(everything.shippingContact?.postalAddress?.street, "2 Shipping St")
        XCTAssertEqual(everything.emailAddress, "sam@example.com")
        XCTAssertEqual(everything.phoneNumber, "+1 555 0100")

        // Email requested on its own: Apple Pay still returns it with the shipping contact.
        let emailOnly = PassKitTypeMapper.convertPaymentDetails(
            billingContact: billing,
            shippingContact: shipping,
            requiredBillingFields: [],
            requiredShippingFields: [.emailAddress]
        )
        XCTAssertNil(emailOnly.billingContact)
        XCTAssertNil(emailOnly.shippingContact)
        XCTAssertEqual(emailOnly.emailAddress, "sam@example.com")
        XCTAssertNil(emailOnly.phoneNumber)
    }

    func testOmitsMissingContactDetails() {
        let details = PassKitTypeMapper.convertPaymentDetails(
            billingContact: nil,
            shippingContact: paymentContact(emailAddress: " ", phoneNumber: ""),
            requiredBillingFields: [.postalAddress, .name],
            requiredShippingFields: [.emailAddress, .phoneNumber]
        )

        XCTAssertNil(details.billingContact)
        XCTAssertNil(details.emailAddress)
        XCTAssertNil(details.phoneNumber)
    }

    func testConvertsContactTypes() {
        XCTAssertEqual(PassKitTypeMapper.convertContactType(.person), .person)
        XCTAssertEqual(PassKitTypeMapper.convertContactType(.organization), .organization)
    }
}
