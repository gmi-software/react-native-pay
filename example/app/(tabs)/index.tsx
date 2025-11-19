import {
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";

import { Text, View } from "@/components/Themed";
import {
  ApplePayButton,
  GooglePayButton,
  usePaymentCheckout,
} from "@gmisoftware/react-native-pay";
import { callback } from "react-native-nitro-modules";

export default function TabOneScreen() {
  const paymentServiceName = Platform.OS === "ios" ? "Apple Pay" : "Google Pay";

  // Initialize checkout hook
  const {
    canMakePayments,
    canSetupCards,
    isCheckingStatus,
    items,
    total,
    addItem,
    addItems,
    clearItems,
    startPayment,
    isProcessing,
    result,
    error,
    reset,
  } = usePaymentCheckout({
    merchantIdentifier: "merchant.com.margelo",
    countryCode: "US",
    currencyCode: "USD",
  });

  // Show status info
  const handleCheckStatus = () => {
    if (canMakePayments) {
      Alert.alert(
        `${paymentServiceName} Available`,
        `${paymentServiceName} is ready to use!`
      );
    } else if (canSetupCards) {
      Alert.alert(
        "Setup Required",
        `Please set up ${paymentServiceName} in Settings`
      );
    } else {
      Alert.alert(
        "Not Available",
        `${paymentServiceName} is not available on this device`
      );
    }
  };

  // Add coffee order
  const handleAddCoffee = () => {
    clearItems(); // Clear previous items
    addItems([
      { label: "Coffee", amount: 4.99 },
      { label: "Tax", amount: 0.5 },
    ]);
  };

  // Add subscription order
  const handleAddSubscription = () => {
    clearItems(); // Clear previous items
    addItems([
      { label: "Premium Subscription", amount: 9.99 },
      { label: "Tax", amount: 0.8 },
    ]);
  };

  // Add custom items
  const handleAddCustom = () => {
    addItem("Custom Item", 19.99);
  };

  // Process payment
  const handlePayment = async () => {
    const paymentResult = await startPayment();

    if (paymentResult?.success) {
      console.log("Payment successful:", paymentResult.token);
      Alert.alert(
        "Payment Successful!",
        `Transaction ID: ${paymentResult.transactionId}`,
        [
          {
            text: "OK",
            onPress: () => {
              reset();
              clearItems();
            },
          },
        ]
      );
    } else if (paymentResult?.error) {
      Alert.alert("Payment Failed", paymentResult.error, [{ text: "OK" }]);
    }
  };

  if (isCheckingStatus) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          Checking {paymentServiceName} availability...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{paymentServiceName} Demo</Text>

      {/* Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{paymentServiceName} Status</Text>
        <TouchableOpacity style={styles.button} onPress={handleCheckStatus}>
          <Text style={styles.buttonText}>Check Status</Text>
        </TouchableOpacity>

        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Can Make Payments:</Text>
            <Text
              style={[
                styles.statusValue,
                canMakePayments ? styles.statusYes : styles.statusNo,
              ]}
            >
              {canMakePayments ? "✓ Yes" : "✗ No"}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Can Setup Cards:</Text>
            <Text
              style={[
                styles.statusValue,
                canSetupCards ? styles.statusYes : styles.statusNo,
              ]}
            >
              {canSetupCards ? "✓ Yes" : "✗ No"}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Add Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Add</Text>
        <TouchableOpacity
          style={[styles.quickButton, styles.coffeeButton]}
          onPress={handleAddCoffee}
        >
          <Text style={styles.quickButtonText}>☕️ Add Coffee Order</Text>
          <Text style={styles.quickButtonPrice}>$5.49</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickButton, styles.subscriptionButton]}
          onPress={handleAddSubscription}
        >
          <Text style={styles.quickButtonText}>📱 Add Subscription</Text>
          <Text style={styles.quickButtonPrice}>$10.79</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickButton, styles.customButton]}
          onPress={handleAddCustom}
        >
          <Text style={styles.quickButtonText}>➕ Add Custom Item</Text>
          <Text style={styles.quickButtonPrice}>$19.99</Text>
        </TouchableOpacity>
      </View>

      {/* Cart Section */}
      <View style={styles.section}>
        <View style={styles.cartHeader}>
          <Text style={styles.sectionTitle}>Cart ({items.length})</Text>
          {items.length > 0 && (
            <TouchableOpacity onPress={clearItems}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>
            Use Quick Add buttons to add items
          </Text>
        ) : (
          <>
            {items.map((item, index) => (
              <View key={index} style={styles.cartItem}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemAmount}>${item.amount.toFixed(2)}</Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Payment Result */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>❌ Payment Failed</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={reset}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {result?.success && (
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>✅ Payment Successful!</Text>
          <Text style={styles.successMessage}>
            Transaction: {result.transactionId}
          </Text>
        </View>
      )}

      {/* Payment Button */}
      {items.length > 0 && !result?.success && canMakePayments && (
        <View style={styles.section}>
          <Text style={styles.paymentTitle}>Complete Payment</Text>
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.processingText}>Processing payment...</Text>
            </View>
          ) : (
            <>
              {Platform.OS === "ios" ? (
                <ApplePayButton
                  buttonType="buy"
                  buttonStyle="black"
                  onPress={callback(handlePayment)}
                  style={styles.payButton}
                />
              ) : (
                <GooglePayButton
                  buttonType="buy"
                  theme="dark"
                  radius={8}
                  onPress={callback(handlePayment)}
                  style={styles.payButton}
                />
              )}
            </>
          )}
        </View>
      )}

      {!canMakePayments && (
        <View style={styles.unavailableBox}>
          <Text style={styles.unavailableText}>
            {paymentServiceName} is not available on this device
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    marginTop: 16,
    color: "#333",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  statusContainer: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: "#666",
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusYes: {
    color: "#34C759",
  },
  statusNo: {
    color: "#FF3B30",
  },
  quickButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  coffeeButton: {
    backgroundColor: "#8B4513",
  },
  subscriptionButton: {
    backgroundColor: "#007AFF",
  },
  customButton: {
    backgroundColor: "#34C759",
  },
  quickButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  quickButtonPrice: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  cartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  clearText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    paddingVertical: 20,
    fontSize: 14,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemLabel: {
    fontSize: 16,
    color: "#333",
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#333",
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
  },
  errorBox: {
    backgroundColor: "#FFEBEE",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#D32F2F",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#B71C1C",
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  retryText: {
    color: "white",
    fontWeight: "600",
  },
  successBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#34C759",
  },
  successTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: "#1B5E20",
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
    textAlign: "center",
  },
  processingContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  processingText: {
    marginTop: 12,
    color: "#007AFF",
    fontSize: 14,
  },
  payButton: {
    width: "100%",
    height: 56,
  },
  unavailableBox: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFC107",
  },
  unavailableText: {
    fontSize: 16,
    color: "#856404",
    textAlign: "center",
  },
});
