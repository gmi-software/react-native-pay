import { Alert, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

import { Text, View } from "@/components/Themed";
import {
  HybridPaymentHandler,
  type PaymentRequest,
} from "@gmisoftware/react-native-pay";

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

// What every demo request shares. Today's charge goes in `paymentItems`.
const baseRequest: Omit<PaymentRequest, "paymentItems"> = {
  merchantName: "React Native Pay Demo",
  countryCode: "US",
  currencyCode: "USD",
  merchantCapabilities: ["3DS"],
  supportedNetworks: ["visa", "mastercard", "amex", "discover"],
  googlePayEnvironment: "TEST",
};

const MANAGEMENT_URL = "https://example.com/account/billing";

// Built on tap, so the dates stay in the future.
const DEMOS: { title: string; detail: string; request: () => PaymentRequest }[] =
  [
    {
      title: "Subscription with a free trial",
      detail: "Free for 7 days, then $9.99 a month. Nothing is charged today.",
      request: () => ({
        ...baseRequest,
        paymentItems: [],
        recurring: {
          description: "Premium membership",
          managementUrl: MANAGEMENT_URL,
          billingAgreement:
            "Renews monthly until you cancel. Cancel any time in your account.",
          trialBilling: {
            label: "Free trial",
            amount: "0.00",
            intervalUnit: "day",
            intervalCount: 7,
            endDate: daysFromNow(7),
          },
          regularBilling: {
            label: "Premium Monthly",
            amount: "9.99",
            intervalUnit: "month",
          },
        },
      }),
    },
    {
      title: "Hotel booking",
      detail:
        "$240.00 charged in 30 days, free cancellation for 28 days. No deposit.",
      request: () => ({
        ...baseRequest,
        paymentItems: [],
        deferred: {
          description: "Hotel booking, 2 nights",
          managementUrl: MANAGEMENT_URL,
          deferredBilling: {
            label: "Hotel Booking",
            amount: "240.00",
            date: daysFromNow(30),
          },
          freeCancellation: {
            date: daysFromNow(28),
            timeZone: "Europe/Warsaw",
          },
        },
      }),
    },
    {
      title: "Card top-up",
      detail: "$25.00 now, then $25.00 whenever the balance drops below $5.00.",
      request: () => ({
        ...baseRequest,
        paymentItems: [{ label: "Initial load", amount: "25.00", type: "final" }],
        automaticReload: {
          description: "Coffee card auto top-up",
          managementUrl: MANAGEMENT_URL,
          automaticReloadBilling: {
            label: "Coffee Card Top-Up",
            amount: "25.00",
            thresholdAmount: "5.00",
          },
        },
      }),
    },
  ];

export default function MerchantTokensScreen() {
  const handlePay = async (request: PaymentRequest) => {
    const result = await HybridPaymentHandler.startPayment(request);
    if (result.status === "success") {
      Alert.alert(
        "Authorized (no server)",
        "Send the merchant token to your payment provider to charge it later.",
      );
    } else if (result.status === "failed") {
      Alert.alert(`Failed: ${result.code}`, result.error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.intro}>
        Payments charged again later. The payer gets a merchant token instead
        of a one-off card token. Android support is coming in #86.
      </Text>
      {DEMOS.map((demo) => (
        <View key={demo.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{demo.title}</Text>
          <Text style={styles.detail}>{demo.detail}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handlePay(demo.request())}
          >
            <Text style={styles.buttonText}>Pay</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  intro: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  detail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
});
