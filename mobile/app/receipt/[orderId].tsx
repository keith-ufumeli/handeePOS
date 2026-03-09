import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Order } from '../../src/database/types';
import { ReceiptService, ReceiptData } from '../../src/services/receiptService';
import { useOrderStore } from '../../src/stores/orderStore';

export default function ReceiptScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { getOrderById } = useOrderStore();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    try {
      const orderData = await getOrderById(orderId);
      if (orderData) {
        setOrder(orderData);
        const receipt = ReceiptService.generateReceiptData(orderData);
        setReceiptData(receipt);
      }
    } catch {
      Alert.alert('Error', 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId, getOrderById]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleShare = async () => {
    if (!receiptData) return;
    
    try {
      await ReceiptService.shareReceipt(receiptData);
      Alert.alert('Success', 'Receipt shared successfully');
    } catch {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const handlePrint = async () => {
    if (!receiptData) return;
    
    try {
      await ReceiptService.printReceipt(receiptData);
      Alert.alert('Success', 'Receipt sent to printer');
    } catch {
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  const handleNewSale = () => {
    router.push('/(tabs)/sales');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading receipt...</Text>
      </View>
    );
  }

  if (!order || !receiptData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Receipt not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Receipt</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.receiptContainer}>
          {/* Store Header */}
          <View style={styles.storeHeader}>
            <Text style={styles.storeName}>{receiptData.storeInfo?.name}</Text>
            <Text style={styles.storeAddress}>{receiptData.storeInfo?.address}</Text>
            <Text style={styles.storeContact}>Phone: {receiptData.storeInfo?.phone}</Text>
            <Text style={styles.storeContact}>Email: {receiptData.storeInfo?.email}</Text>
          </View>

          <View style={styles.divider} />

          {/* Order Info */}
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>Order #: {receiptData.orderNumber}</Text>
            <Text style={styles.orderDate}>Date: {receiptData.date}</Text>
            <Text style={styles.orderTime}>Time: {receiptData.time}</Text>
            <Text style={styles.cashier}>Cashier: {receiptData.cashier}</Text>
          </View>

          <View style={styles.divider} />

          {/* Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>ITEMS:</Text>
            {receiptData.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemDetails}>
                  {item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.subtotal.toFixed(2)}
                </Text>
                {item.discount > 0 && (
                  <Text style={styles.itemDiscount}>
                    Discount: -${item.discount.toFixed(2)}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>${receiptData.subtotal.toFixed(2)}</Text>
            </View>
            {receiptData.discountAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount:</Text>
                <Text style={styles.totalValue}>-${receiptData.discountAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalValue}>${receiptData.taxAmount.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.grandTotalLabel}>TOTAL:</Text>
              <Text style={styles.grandTotalValue}>${receiptData.total.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Payment */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>PAYMENT:</Text>
            {receiptData.paymentMethods.map((payment, index) => (
              <View key={index} style={styles.paymentRow}>
                <Text style={styles.paymentMethod}>
                  {payment.method.toUpperCase()}: ${payment.amount.toFixed(2)}
                </Text>
                {payment.reference && (
                  <Text style={styles.paymentRef}>Ref: {payment.reference}</Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your business!</Text>
            <Text style={styles.footerText}>Please come again.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handlePrint}>
          <Ionicons name="print" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Print</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleNewSale}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>New Sale</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  receiptContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storeHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  storeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
  },
  storeContact: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  orderInfo: {
    marginBottom: 16,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  orderTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  cashier: {
    fontSize: 12,
    color: '#666',
  },
  itemsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  itemRow: {
    marginBottom: 8,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  itemDiscount: {
    fontSize: 11,
    color: '#f59e0b',
  },
  totalsSection: {
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 12,
    color: '#666',
  },
  totalValue: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
  },
  paymentSection: {
    marginBottom: 16,
  },
  paymentRow: {
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  paymentRef: {
    fontSize: 11,
    color: '#666',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
