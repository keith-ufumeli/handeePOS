import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../src/stores/productStore';
import { useCartStore, CartItem } from '../../src/stores/cartStore';
import { useOrderStore } from '../../src/stores/orderStore';
import { useAuthStore } from '../../src/stores/authStore';
import Product from '../../src/database/models/Product';

export default function SalesScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const {
    products,
    isLoading: productsLoading,
    loadProducts,
    searchProducts,
  } = useProductStore();
  
  const {
    items: cartItems,
    subtotal,
    taxAmount,
    discountAmount,
    total,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItemCount,
  } = useCartStore();
  
  const { createOrder, isLoading: orderLoading } = useOrderStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
    }
  }, [isAuthenticated, loadProducts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadProducts();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      await searchProducts(query);
    } else {
      await loadProducts();
    }
  };

  const handleBarcodeSearch = async () => {
    router.push('/barcode-scanner');
  };

  const handleAddToCart = (product: Product) => {
    if (product.stockQuantity <= 0) {
      Alert.alert('Out of Stock', 'This product is currently out of stock.');
      return;
    }
    addItem(product);
  };

  const handleRemoveFromCart = (productId: string) => {
    removeItem(productId);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId);
    } else {
      updateQuantity(productId, quantity);
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart before checkout.');
      return;
    }
    setShowCheckout(true);
  };

  const handleProcessPayment = async (paymentMethod: string, amount: number) => {
    try {
      const paymentMethods = [{
        method: paymentMethod,
        amount: total,
        reference: `PAY-${Date.now()}`,
      }];

      const newOrder = await createOrder(cartItems, paymentMethods);
      
      Alert.alert(
        'Order Complete',
        'Order has been processed successfully!',
        [
          {
            text: 'View Receipt',
            onPress: () => {
              clearCart();
              setShowCheckout(false);
              router.push(`/receipt/${newOrder.id}`);
            },
          },
          {
            text: 'New Sale',
            onPress: () => {
              clearCart();
              setShowCheckout(false);
            },
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to process order. Please try again.');
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const cartItem = cartItems.find(cartItem => cartItem.productId === item.id);
    const isInCart = !!cartItem;

    return (
      <TouchableOpacity
        style={[styles.productCard, isInCart && styles.productCardInCart]}
        onPress={() => handleAddToCart(item)}
      >
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productSku}>{item.sku}</Text>
        </View>
        
        <View style={styles.productDetails}>
          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
          <Text style={styles.productStock}>
            Stock: {item.stockQuantity} {item.unit}
          </Text>
          {item.isLowStock && (
            <View style={styles.lowStockContainer}>
              <Ionicons name="warning" size={16} color="#f59e0b" />
              <Text style={styles.lowStockWarning}>Low Stock</Text>
            </View>
          )}
        </View>
        
        {isInCart && (
          <View style={styles.cartControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, cartItem.quantity - 1)}
            >
              <Ionicons name="remove" size={16} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{cartItem.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, cartItem.quantity + 1)}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.productName}</Text>
        <Text style={styles.cartItemSku}>{item.sku}</Text>
        <Text style={styles.cartItemPrice}>${item.unitPrice.toFixed(2)} each</Text>
      </View>
      
      <View style={styles.cartItemControls}>
        <TouchableOpacity
          style={styles.cartQuantityButton}
          onPress={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
        >
          <Ionicons name="remove" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.cartQuantityText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.cartQuantityButton}
          onPress={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
        >
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cartRemoveButton}
          onPress={() => handleRemoveFromCart(item.productId)}
        >
          <Ionicons name="trash" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.cartItemTotal}>${item.subtotal.toFixed(2)}</Text>
    </View>
  );

  const renderCheckoutModal = () => (
    <Modal
      visible={showCheckout}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.checkoutContainer}>
        <View style={styles.checkoutHeader}>
          <TouchableOpacity onPress={() => setShowCheckout(false)}>
            <Text style={styles.checkoutCloseButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.checkoutTitle}>Checkout</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.checkoutContent}>
          <View style={styles.cartSummary}>
            <Text style={styles.cartSummaryTitle}>Order Summary</Text>
            {cartItems.map((item) => (
              <View key={item.productId} style={styles.cartSummaryItem}>
                <Text style={styles.cartSummaryItemName}>{item.productName}</Text>
                <Text style={styles.cartSummaryItemDetails}>
                  {item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.subtotal.toFixed(2)}
                </Text>
              </View>
            ))}
            
            <View style={styles.cartSummaryTotals}>
              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartSummaryLabel}>Subtotal:</Text>
                <Text style={styles.cartSummaryValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartSummaryLabel}>Discount:</Text>
                <Text style={styles.cartSummaryValue}>-${discountAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartSummaryLabel}>Tax:</Text>
                <Text style={styles.cartSummaryValue}>${taxAmount.toFixed(2)}</Text>
              </View>
              <View style={[styles.cartSummaryRow, styles.cartSummaryTotal]}>
                <Text style={styles.cartSummaryTotalLabel}>Total:</Text>
                <Text style={styles.cartSummaryTotalValue}>${total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Payment Method</Text>
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() => handleProcessPayment('cash', total)}
            >
              <Ionicons name="cash" size={24} color="#34C759" />
              <Text style={styles.paymentButtonText}>Cash Payment</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() => handleProcessPayment('card', total)}
            >
              <Ionicons name="card" size={24} color="#007AFF" />
              <Text style={styles.paymentButtonText}>Card Payment</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Please log in to access sales</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.barcodeButton}
            onPress={handleBarcodeSearch}
          >
            <Ionicons name="barcode-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>Products</Text>
          {productsLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading products...</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              renderItem={renderProduct}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              numColumns={2}
              contentContainerStyle={styles.productsList}
            />
          )}
        </View>

        <View style={styles.cartSection}>
          <View style={styles.cartHeader}>
            <Text style={styles.sectionTitle}>
              Cart ({getItemCount()} items)
            </Text>
            {cartItems.length > 0 && (
              <TouchableOpacity
                style={styles.clearCartButton}
                onPress={clearCart}
              >
                <Text style={styles.clearCartButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {cartItems.length === 0 ? (
            <View style={styles.emptyCart}>
              <Ionicons name="cart-outline" size={48} color="#ccc" />
              <Text style={styles.emptyCartText}>Cart is empty</Text>
              <Text style={styles.emptyCartSubtext}>Add products to start a sale</Text>
            </View>
          ) : (
            <FlatList
              data={cartItems}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.productId}
              style={styles.cartList}
            />
          )}
        </View>
      </View>

      {cartItems.length > 0 && (
        <View style={styles.cartFooter}>
          <View style={styles.cartTotals}>
            <Text style={styles.cartTotalLabel}>Total: ${total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={handleCheckout}
            disabled={orderLoading}
          >
            {orderLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.checkoutButtonText}>Checkout</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {renderCheckoutModal()}
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  barcodeButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  productsSection: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  productsList: {
    paddingBottom: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
  },
  productCardInCart: {
    borderColor: '#34C759',
    borderWidth: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  productSku: {
    fontSize: 10,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productDetails: {
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 4,
  },
  productStock: {
    fontSize: 12,
    color: '#666',
  },
  lowStockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  lowStockWarning: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
    marginLeft: 4,
  },
  cartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quantityButton: {
    backgroundColor: '#34C759',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 20,
    textAlign: 'center',
  },
  cartSection: {
    width: 300,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  clearCartButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 4,
  },
  clearCartButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyCartText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emptyCartSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  cartList: {
    flex: 1,
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cartItemSku: {
    fontSize: 12,
    color: '#666',
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#666',
  },
  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
  },
  cartQuantityButton: {
    backgroundColor: '#007AFF',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartQuantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 20,
    textAlign: 'center',
  },
  cartRemoveButton: {
    backgroundColor: '#FF3B30',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 60,
    textAlign: 'right',
  },
  cartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cartTotals: {
    flex: 1,
  },
  cartTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  checkoutButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  checkoutContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  checkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  checkoutCloseButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  checkoutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  checkoutContent: {
    flex: 1,
    padding: 16,
  },
  cartSummary: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cartSummaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  cartSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cartSummaryItemName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  cartSummaryItemDetails: {
    fontSize: 12,
    color: '#666',
  },
  cartSummaryTotals: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cartSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cartSummaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  cartSummaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  cartSummaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 8,
  },
  cartSummaryTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cartSummaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34C759',
  },
  paymentSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
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
  },
});
