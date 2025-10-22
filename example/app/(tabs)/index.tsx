import {
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";

import EditScreenInfo from "@/components/EditScreenInfo";
import { Text, View } from "@/components/Themed";
import { ApplePayButton, HybridPaymentHandler } from "react-native-pay";
import { useState } from "react";
import type { PaymentRequest } from "react-native-pay";
import { callback } from "react-native-nitro-modules";

export default function TabOneScreen() {
  const [result, setResult] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [applePayStatus, setApplePayStatus] = useState<any>(null);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);

  // Check Apple Pay availability
  const checkApplePayStatus = async () => {
    try {
      const status = await HybridPaymentHandler.applePayStatus();
      setApplePayStatus(status);

      if (status.canMakePayments) {
        Alert.alert("Apple Pay Available", "Apple Pay is ready to use!");
      } else if (status.canSetupCards) {
        Alert.alert("Setup Required", "Please set up Apple Pay in Settings");
      } else {
        Alert.alert(
          "Not Available",
          "Apple Pay is not available on this device"
        );
      }
    } catch (error) {
      console.error("Error checking Apple Pay status:", error);
      Alert.alert("Error", "Failed to check Apple Pay status");
    }
  };

  // Check network support
  const checkNetworkSupport = async () => {
    try {
      const networks = ["visa", "mastercard", "amex", "discover"];
      const results = await Promise.all(
        networks.map(async (network) => {
          const supported = await HybridPaymentHandler.canMakePayments([
            network,
          ]);
          return { network, supported };
        })
      );

      const supportedNetworks = results
        .filter((r) => r.supported)
        .map((r) => r.network);
      const unsupportedNetworks = results
        .filter((r) => !r.supported)
        .map((r) => r.network);

      Alert.alert(
        "Network Support",
        `Supported: ${supportedNetworks.join(", ")}\nUnsupported: ${unsupportedNetworks.join(", ")}`
      );
    } catch (error) {
      console.error("Error checking network support:", error);
      Alert.alert("Error", "Failed to check network support");
    }
  };

  // Process a coffee purchase
  const processCoffeePurchase = async () => {
    try {
      setIsProcessing(true);

      const paymentRequest: PaymentRequest = {
        merchantIdentifier: "merchant.com.yourcompany.yourapp", // Replace with your merchant ID
        countryCode: "US",
        currencyCode: "USD",
        paymentItems: [
          {
            label: "Coffee",
            amount: 4.99,
            type: "final",
          },
          {
            label: "Tax",
            amount: 0.5,
            type: "final",
          },
        ],
        merchantCapabilities: ["3DS", "EMV", "Credit", "Debit"],
        supportedNetworks: ["visa", "mastercard", "amex"],
        billingContactRequired: true,
        shippingContactRequired: false,
      };

      const result = await HybridPaymentHandler.startPayment(paymentRequest);

      if (result.success) {
        setLastTransaction(result.transactionId || "Unknown");
        Alert.alert(
          "Payment Successful!",
          `Transaction ID: ${result.transactionId}`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Payment Failed", result.error || "Unknown error occurred");
      }
    } catch (error) {
      console.error("Payment error:", error);
      Alert.alert("Error", "An error occurred during payment");
    } finally {
      setIsProcessing(false);
    }
  };

  // Process a subscription purchase
  const processSubscriptionPurchase = async () => {
    try {
      setIsProcessing(true);

      const paymentRequest: PaymentRequest = {
        merchantIdentifier: "merchant.com.yourcompany.yourapp", // Replace with your merchant ID
        countryCode: "US",
        currencyCode: "USD",
        paymentItems: [
          {
            label: "Premium Subscription",
            amount: 9.99,
            type: "final",
          },
          {
            label: "Tax",
            amount: 0.8,
            type: "final",
          },
        ],
        merchantCapabilities: ["3DS", "EMV", "Credit", "Debit"],
        supportedNetworks: ["visa", "mastercard", "amex", "discover"],
        billingContactRequired: true,
        shippingContactRequired: false,
      };

      const result = await HybridPaymentHandler.startPayment(paymentRequest);

      if (result.success) {
        setLastTransaction(result.transactionId || "Unknown");
        Alert.alert(
          "Subscription Successful!",
          `Transaction ID: ${result.transactionId}`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Subscription Failed",
          result.error || "Unknown error occurred"
        );
      }
    } catch (error) {
      console.error("Subscription error:", error);
      Alert.alert("Error", "An error occurred during subscription");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Apple Pay Payment Examples</Text>

      {/* Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Apple Pay Status</Text>
        <TouchableOpacity style={styles.button} onPress={checkApplePayStatus}>
          <Text style={styles.buttonText}>Check Apple Pay Status</Text>
        </TouchableOpacity>

        {applePayStatus && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Can Make Payments: {applePayStatus.canMakePayments ? "Yes" : "No"}
            </Text>
            <Text style={styles.statusText}>
              Can Setup Cards: {applePayStatus.canSetupCards ? "Yes" : "No"}
            </Text>
          </View>
        )}
      </View>

      {/* Network Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network Support</Text>
        <TouchableOpacity style={styles.button} onPress={checkNetworkSupport}>
          <Text style={styles.buttonText}>Check Network Support</Text>
        </TouchableOpacity>
      </View>

      {/* Payment Examples Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Examples</Text>

        {/* Coffee Purchase */}
        <View style={styles.paymentExample}>
          <Text style={styles.exampleTitle}>☕ Coffee Purchase ($5.49)</Text>
          <ApplePayButton
            buttonType="buy"
            buttonStyle="black"
            onPress={callback(processCoffeePurchase)}
            style={styles.applePayButton}
          />
        </View>

        {/* Subscription Purchase */}
        <View style={styles.paymentExample}>
          <Text style={styles.exampleTitle}>
            📱 Premium Subscription ($10.79)
          </Text>
          <ApplePayButton
            buttonType="buy"
            buttonStyle="whiteOutline"
            onPress={callback(processSubscriptionPurchase)}
            style={styles.applePayButton}
          />
        </View>

        {/* Setup Button */}
        <View style={styles.paymentExample}>
          <Text style={styles.exampleTitle}>⚙️ Setup Apple Pay</Text>
          <ApplePayButton
            buttonType="setUp"
            buttonStyle="whiteOutline"
            onPress={callback(checkApplePayStatus)}
            style={styles.applePayButton}
          />
        </View>
      </View>

      {/* Status Display */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Status</Text>
        <Text style={styles.statusText}>
          {isProcessing ? "Processing payment..." : "Ready to pay"}
        </Text>
        {lastTransaction && (
          <Text style={styles.transactionText}>
            Last Transaction: {lastTransaction}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
    color: "#333",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  statusContainer: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 5,
    color: "#666",
  },
  paymentExample: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  exampleTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  applePayButton: {
    width: "100%",
    height: 50,
  },
  transactionText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "bold",
    marginTop: 5,
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});
