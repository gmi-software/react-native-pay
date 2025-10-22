import PassKit
import UIKit
import NitroModules

// Separate delegate class to handle PKPaymentAuthorizationViewControllerDelegate
class PaymentDelegate: NSObject, PKPaymentAuthorizationViewControllerDelegate {
  private weak var paymentHandler: HybridPaymentHandler?
  
  init(paymentHandler: HybridPaymentHandler) {
    self.paymentHandler = paymentHandler
  }
  
  func paymentAuthorizationViewController(_ controller: PKPaymentAuthorizationViewController, didAuthorizePayment payment: PKPayment, handler completion: @escaping (PKPaymentAuthorizationResult) -> Void) {
    // Here you would typically process the payment with your payment processor
    // For this example, we'll simulate a successful payment
    
    // Extract payment token and other details
    let paymentData = payment.token.paymentData
    let transactionId = UUID().uuidString
    
    // Simulate payment processing
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
      let result = PKPaymentAuthorizationResult(status: .success, errors: nil)
      completion(result)
      
      // Call our completion handler
      self.paymentHandler?.handlePaymentResult(PaymentResult.init(success: true, transactionId: transactionId, error: nil).self)
    }
  }
  
  func paymentAuthorizationViewControllerDidFinish(_ controller: PKPaymentAuthorizationViewController) {
    controller.dismiss(animated: true) {
      // Payment flow completed
    }
  }
}

class HybridPaymentHandler: HybridPaymentHandlerSpec {
  private var currentPaymentRequest: PKPaymentRequest?
  private var paymentCompletion: ((PaymentResult) -> Void)?
  private var delegate: PaymentDelegate?
  
  func applePayStatus() throws -> ApplePayStatus {
    let canMakePayments = PKPaymentAuthorizationViewController.canMakePayments()
    let canSetupCards = PKPaymentAuthorizationViewController.canMakePayments(usingNetworks: [])
    
    return ApplePayStatus.init(canMakePayments, canSetupCards).self
  }
  
  func canMakePayments(usingNetworks: [String]) throws -> Bool {
    let networks = usingNetworks.compactMap { networkString in
      switch networkString {
      case "visa": return PKPaymentNetwork.visa
      case "mastercard": return PKPaymentNetwork.masterCard
      case "amex": return PKPaymentNetwork.amex
      case "discover": return PKPaymentNetwork.discover
      case "jcb": return PKPaymentNetwork.JCB
      case "maestro": return PKPaymentNetwork.maestro
      case "electron": return PKPaymentNetwork.electron
      case "elo": return PKPaymentNetwork.elo
      case "idcredit": return PKPaymentNetwork.idCredit
      case "interac": return PKPaymentNetwork.interac
      case "privateLabel": return PKPaymentNetwork.privateLabel
      default: return nil
      }
    }
    
    return PKPaymentAuthorizationViewController.canMakePayments(usingNetworks: networks)
  }
  
  func startPayment(request: PaymentRequest) throws -> Promise<PaymentResult> {
    let promise = Promise<PaymentResult>()
    
    DispatchQueue.main.async {
      self.performPayment(request: request, completion: { result in
          promise.resolve(withResult: result)
      })
    }
    
    return promise
  }
  
  private func performPayment(request: PaymentRequest, completion: @escaping (PaymentResult) -> Void) {
    let paymentRequest = PKPaymentRequest()
    paymentRequest.merchantIdentifier = request.merchantIdentifier
    paymentRequest.countryCode = request.countryCode
    paymentRequest.currencyCode = request.currencyCode
    
    // Set payment items
    var pkPaymentItems: [PKPaymentSummaryItem] = []
    for item in request.paymentItems {
      let itemType: PKPaymentSummaryItemType = item.type == .final ? .final : .pending
      let pkItem = PKPaymentSummaryItem(label: item.label, amount: NSDecimalNumber(decimal: Decimal(item.amount)))
      pkItem.type = itemType
      pkPaymentItems.append(pkItem)
    }
    paymentRequest.paymentSummaryItems = pkPaymentItems
    
    // Set merchant capabilities
    var merchantCapabilities: PKMerchantCapability = []
    for capability in request.merchantCapabilities {
      switch capability {
      case "3DS": merchantCapabilities.insert(.capability3DS)
      case "EMV": merchantCapabilities.insert(.capabilityEMV)
      case "Credit": merchantCapabilities.insert(.capabilityCredit)
      case "Debit": merchantCapabilities.insert(.capabilityDebit)
      default: break
      }
    }
    paymentRequest.merchantCapabilities = merchantCapabilities
    
    // Set supported networks
    var supportedNetworks: [PKPaymentNetwork] = []
    for network in request.supportedNetworks {
      switch network {
      case "visa": supportedNetworks.append(.visa)
      case "mastercard": supportedNetworks.append(.masterCard)
      case "amex": supportedNetworks.append(.amex)
      case "discover": supportedNetworks.append(.discover)
      case "jcb": supportedNetworks.append(.JCB)
      case "maestro": supportedNetworks.append(.maestro)
      case "electron": supportedNetworks.append(.electron)
      case "elo": supportedNetworks.append(.elo)
      case "idcredit": supportedNetworks.append(.idCredit)
      case "interac": supportedNetworks.append(.interac)
      case "privateLabel": supportedNetworks.append(.privateLabel)
      default: break
      }
    }
    paymentRequest.supportedNetworks = supportedNetworks
    
    // Set shipping type
    if let shippingType = request.shippingType {
      switch shippingType {
      case "shipping": paymentRequest.shippingType = .shipping
      case "delivery": paymentRequest.shippingType = .delivery
      case "storePickup": paymentRequest.shippingType = .storePickup
      case "servicePickup": paymentRequest.shippingType = .servicePickup
      default: break
      }
    }
    
    // Set contact requirements
    if let billingRequired = request.billingContactRequired, billingRequired {
      paymentRequest.requiredBillingContactFields = [.postalAddress, .name]
    }
    
    if let shippingRequired = request.shippingContactRequired, shippingRequired {
      paymentRequest.requiredShippingContactFields = [.postalAddress, .name]
    }
    
    // Store completion handler
    self.paymentCompletion = completion
    self.currentPaymentRequest = paymentRequest
    
    // Create delegate
    self.delegate = PaymentDelegate(paymentHandler: self)
    
    // Present payment authorization
    if let paymentAuthVC = PKPaymentAuthorizationViewController(paymentRequest: paymentRequest) {
      paymentAuthVC.delegate = self.delegate
      
      if let rootViewController = UIApplication.shared.windows.first?.rootViewController {
        rootViewController.present(paymentAuthVC, animated: true)
      } else {
          completion(PaymentResult.init(success: false, transactionId: nil, error: "Unable to present payment authorization").self)
      }
    } else {
        completion(PaymentResult.init(success: false, transactionId: nil, error: "Unable to create payment authorization").self)
    }
  }
  
  // Handle payment result from delegate
  func handlePaymentResult(_ result: PaymentResult) {
    self.paymentCompletion?(result)
  }
}
