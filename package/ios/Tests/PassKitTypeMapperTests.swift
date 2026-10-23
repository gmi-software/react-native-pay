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

    func testConvertsContactTypes() {
        XCTAssertEqual(PassKitTypeMapper.convertContactType(.person), .person)
        XCTAssertEqual(PassKitTypeMapper.convertContactType(.organization), .organization)
    }
}
