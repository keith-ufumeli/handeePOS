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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../src/stores/productStore';
import { Product } from '../../src/database/types';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useAppColorScheme } from '../../hooks/use-app-color-scheme';

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories, getProductById, updateProduct, deleteProduct } = useProductStore();
  const colorScheme = useAppColorScheme();
  const theme = Colors[colorScheme];
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reload whenever the screen comes back into focus (e.g. after editing)
  useFocusEffect(
    useCallback(() => {
      loadProduct();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  const loadProduct = async () => {
    try {
      const productData = await getProductById(id);
      setProduct(productData);
    } catch {
      Alert.alert('Error', 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push(`/products/${id}/edit`);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(id);
              Alert.alert('Success', 'Product deleted successfully', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch {
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  const handleStockUpdate = () => {
    Alert.prompt(
      'Update Stock',
      'Enter new stock quantity:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async (stockQuantity: string | undefined) => {
            if (stockQuantity && !isNaN(Number(stockQuantity))) {
              try {
                await updateProduct(id, {
                  stockQuantity: Number(stockQuantity),
                });
                await loadProduct();
                Alert.alert('Success', 'Stock updated successfully');
              } catch  {
                Alert.alert('Error', 'Failed to update stock');
              }
            } else {
              Alert.alert('Error', 'Please enter a valid number');
            }
          },
        },
      ],
      'plain-text',
      product?.stockQuantity.toString() || '0',
      'numeric'
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.gray500 }]}>Loading product...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.error }]}>Product not found</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.primaryButtonText, { color: theme.white }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: theme.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {product.name}
        </Text>
        <TouchableOpacity onPress={handleEdit}>
          <Text style={[styles.editButton, { color: theme.accent }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.productCard, { backgroundColor: theme.cardBg, shadowColor: '#000' }]}>
          <View style={styles.productHeader}>
            <Text style={[styles.productName, { color: theme.text }]}>{product.name}</Text>
            <Text
              style={[
                styles.productSku,
                { color: theme.gray600, backgroundColor: theme.inputBg, borderColor: theme.border },
              ]}
            >
              {product.sku}
            </Text>
          </View>

          {product.barcode && (
            <View style={styles.productRow}>
              <Text style={[styles.label, { color: theme.gray600 }]}>Barcode:</Text>
              <Text style={[styles.value, { color: theme.text }]}>{product.barcode}</Text>
            </View>
          )}

          <View style={styles.productRow}>
            <Text style={[styles.label, { color: theme.gray600 }]}>Category:</Text>
            <Text style={[styles.value, { color: theme.text }]}>
              {categories.find(c => (c.serverId || c.id) === product.categoryId)?.name || product.categoryId}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceItem}>
              <Text style={[styles.label, { color: theme.gray600 }]}>Price:</Text>
              <Text style={[styles.priceValue, { color: theme.primary }]}>${product.price.toFixed(2)}</Text>
            </View>
            <View style={styles.priceItem}>
              <Text style={[styles.label, { color: theme.gray600 }]}>Cost:</Text>
              <Text style={[styles.costValue, { color: theme.error }]}>${product.cost.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.productRow}>
            <Text style={[styles.label, { color: theme.gray600 }]}>Profit Margin:</Text>
            <Text style={[styles.value, { color: theme.text }]}>{(product.profitMargin ?? 0).toFixed(1)}%</Text>
          </View>

          <View style={styles.productRow}>
            <Text style={[styles.label, { color: theme.gray600 }]}>Tax Rate:</Text>
            <Text style={[styles.value, { color: theme.text }]}>{product.taxRate}%</Text>
          </View>

          <View style={styles.stockRow}>
            <View style={styles.stockItem}>
              <Text style={[styles.label, { color: theme.gray600 }]}>Stock:</Text>
              <Text
                style={[
                  styles.stockValue,
                  { color: theme.text },
                  product.isLowStock && { color: theme.error },
                ]}
              >
                {product.stockQuantity} {product.unit}
              </Text>
            </View>
            <View style={styles.stockItem}>
              <Text style={[styles.label, { color: theme.gray600 }]}>Low Stock Threshold:</Text>
              <Text style={[styles.value, { color: theme.text }]}>{product.lowStockThreshold}</Text>
            </View>
          </View>

          {product.isLowStock && (
            <View
              style={[
                styles.lowStockWarning,
                { backgroundColor: theme.warningBg, borderLeftColor: theme.warning },
              ]}
            >
              <View style={styles.lowStockContainer}>
                <Ionicons name="warning" size={16} color={theme.warning} />
                <Text style={[styles.lowStockText, { color: theme.warning }]}>Low Stock Alert</Text>
              </View>
            </View>
          )}

          <View style={styles.productRow}>
            <Text style={[styles.label, { color: theme.gray600 }]}>Status:</Text>
            <Text
              style={[
                styles.statusValue,
                product.isActive ? { color: theme.success } : { color: theme.error },
              ]}
            >
              {product.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>

          <View style={styles.productRow}>
            <Text style={[styles.label, { color: theme.gray600 }]}>Sync Status:</Text>
            <View style={styles.syncStatusContainer}>
              {product.syncStatus === 'synced' ? (
                <View style={styles.syncStatusRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <Text style={[styles.syncStatusText, { color: theme.gray600 }]}>Synced</Text>
                </View>
              ) : product.syncStatus === 'pending' ? (
                <View style={styles.syncStatusRow}>
                  <Ionicons name="time" size={16} color={theme.warning} />
                  <Text style={[styles.syncStatusText, { color: theme.gray600 }]}>Pending</Text>
                </View>
              ) : (
                <View style={styles.syncStatusRow}>
                  <Ionicons name="close-circle" size={16} color={theme.error} />
                  <Text style={[styles.syncStatusText, { color: theme.gray600 }]}>Failed</Text>
                </View>
              )}
            </View>
          </View>

          {product.lastSyncedAt && (
            <View style={styles.productRow}>
              <Text style={[styles.label, { color: theme.gray600 }]}>Last Synced:</Text>
              <Text style={[styles.value, { color: theme.text }]}>
                {new Date(product.lastSyncedAt).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleStockUpdate}
          >
            <Text style={[styles.primaryButtonText, { color: theme.white }]}>Update Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
            onPress={handleEdit}
          >
            <Text style={[styles.primaryButtonText, { color: theme.white }]}>Edit Product</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.error }]}
            onPress={handleDelete}
          >
            <Text style={[styles.primaryButtonText, { color: theme.white }]}>
              Delete Product
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  backButtonText: {
    fontSize: Typography.sizes.md,
  },
  title: {
    flex: 1,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  editButton: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  productCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  productName: {
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    flex: 1,
  },
  productSku: {
    fontSize: Typography.sizes.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  value: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceItem: {
    flex: 1,
  },
  priceValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: 'bold',
  },
  costValue: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stockItem: {
    flex: 1,
  },
  stockValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  lowStockWarning: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
  },
  lowStockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lowStockText: {
    fontWeight: '600',
    fontSize: Typography.sizes.sm,
    marginLeft: Spacing.xs,
  },
  statusValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  syncStatusContainer: {
    alignItems: 'flex-end',
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncStatusText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  actionsContainer: {
    gap: Spacing.md,
  },
  primaryButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.md,
  },
  errorText: {
    fontSize: Typography.sizes.lg,
    marginBottom: Spacing.md,
  },
});
