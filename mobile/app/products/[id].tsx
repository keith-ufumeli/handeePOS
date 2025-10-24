import React, { useState, useEffect } from 'react';
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
import { useProductStore } from '@/stores/productStore';
import Product from '@/database/models/Product';

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getProductById, updateProduct, deleteProduct, isLoading } = useProductStore();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      const productData = await getProductById(id);
      setProduct(productData);
    } catch (error) {
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
            } catch (error) {
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
          onPress: async (stockQuantity) => {
            if (stockQuantity && !isNaN(Number(stockQuantity))) {
              try {
                await updateProduct(id, {
                  stockQuantity: Number(stockQuantity),
                });
                await loadProduct();
                Alert.alert('Success', 'Stock updated successfully');
              } catch (error) {
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading product...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Product not found</Text>
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
        <Text style={styles.title}>Product Details</Text>
        <TouchableOpacity onPress={handleEdit}>
          <Text style={styles.editButton}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.productCard}>
          <View style={styles.productHeader}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productSku}>{product.sku}</Text>
          </View>

          {product.barcode && (
            <View style={styles.productRow}>
              <Text style={styles.label}>Barcode:</Text>
              <Text style={styles.value}>{product.barcode}</Text>
            </View>
          )}

          <View style={styles.productRow}>
            <Text style={styles.label}>Category:</Text>
            <Text style={styles.value}>{product.categoryId}</Text>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceItem}>
              <Text style={styles.label}>Price:</Text>
              <Text style={styles.priceValue}>${product.price.toFixed(2)}</Text>
            </View>
            <View style={styles.priceItem}>
              <Text style={styles.label}>Cost:</Text>
              <Text style={styles.costValue}>${product.cost.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.productRow}>
            <Text style={styles.label}>Profit Margin:</Text>
            <Text style={styles.value}>{product.profitMargin.toFixed(1)}%</Text>
          </View>

          <View style={styles.productRow}>
            <Text style={styles.label}>Tax Rate:</Text>
            <Text style={styles.value}>{product.taxRate}%</Text>
          </View>

          <View style={styles.stockRow}>
            <View style={styles.stockItem}>
              <Text style={styles.label}>Stock:</Text>
              <Text style={[
                styles.stockValue,
                product.isLowStock && styles.lowStockValue
              ]}>
                {product.stockQuantity} {product.unit}
              </Text>
            </View>
            <View style={styles.stockItem}>
              <Text style={styles.label}>Low Stock Threshold:</Text>
              <Text style={styles.value}>{product.lowStockThreshold}</Text>
            </View>
          </View>

          {product.isLowStock && (
            <View style={styles.lowStockWarning}>
              <Text style={styles.lowStockText}>⚠️ Low Stock Alert</Text>
            </View>
          )}

          <View style={styles.productRow}>
            <Text style={styles.label}>Status:</Text>
            <Text style={[
              styles.statusValue,
              product.isActive ? styles.activeStatus : styles.inactiveStatus
            ]}>
              {product.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>

          <View style={styles.productRow}>
            <Text style={styles.label}>Sync Status:</Text>
            <Text style={styles.syncStatus}>
              {product.syncStatus === 'synced' ? '✅ Synced' : 
               product.syncStatus === 'pending' ? '⏳ Pending' : '❌ Failed'}
            </Text>
          </View>

          {product.lastSyncedAt && (
            <View style={styles.productRow}>
              <Text style={styles.label}>Last Synced:</Text>
              <Text style={styles.value}>
                {new Date(product.lastSyncedAt).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleStockUpdate}>
            <Text style={styles.actionButtonText}>Update Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleEdit}>
            <Text style={styles.actionButtonText}>Edit Product</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]} 
            onPress={handleDelete}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
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
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  productName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  productSku: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#333',
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
    fontSize: 18,
    color: '#34C759',
    fontWeight: 'bold',
  },
  costValue: {
    fontSize: 16,
    color: '#FF3B30',
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
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  lowStockValue: {
    color: '#FF3B30',
  },
  lowStockWarning: {
    backgroundColor: '#FFE6E6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  lowStockText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 14,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeStatus: {
    color: '#34C759',
  },
  inactiveStatus: {
    color: '#FF3B30',
  },
  syncStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#fff',
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
});
