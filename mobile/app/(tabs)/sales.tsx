import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../src/stores/productStore';
import { useCartStore, CartItem } from '../../src/stores/cartStore';
import { useOrderStore } from '../../src/stores/orderStore';
import { useAuthStore } from '../../src/stores/authStore';
import { Product } from '../../src/database/types';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

export default function SalesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
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
  const [showCartModal, setShowCartModal] = useState(false);
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
    setShowCartModal(false);
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
      <Card 
        style={[styles.productCard, isInCart && { borderColor: theme.primary, borderWidth: 2 }]} 
        padding="md"
      >
        <TouchableOpacity onPress={() => handleAddToCart(item)} style={styles.productTouchable}>
          <View style={styles.productContent}>
            {/* Product Info */}
            <View style={styles.productInfo}>
              <Text style={[styles.productName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.productMeta}>
                <Badge label={item.sku} variant="default" style={{ backgroundColor: theme.gray200 }} />
                {item.isLowStock && (
                  <View style={[styles.lowStockBadge, { backgroundColor: theme.warningBg }]}>
                    <Ionicons name="warning" size={12} color={theme.warning} />
                    <Text style={[styles.lowStockText, { color: theme.warning }]}>Low</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Price and Stock */}
            <View style={styles.productPriceSection}>
              <Text style={[styles.productPrice, { color: theme.primary }]}>
                ${item.price.toFixed(2)}
              </Text>
              <Text style={[styles.productStock, { color: theme.gray500 }]}>
                {item.stockQuantity} {item.unit}
              </Text>
            </View>

            {/* Add to Cart Icon */}
            {!isInCart && (
              <View style={[styles.addToCartIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="add" size={20} color={theme.white} />
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        {/* Quantity Controls (shown when in cart) */}
        {isInCart && (
          <View style={[styles.quantityControls, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: theme.gray200 }]}
              onPress={() => handleUpdateQuantity(item.id, cartItem.quantity - 1)}
            >
              <Ionicons name="remove" size={18} color={theme.text} />
            </TouchableOpacity>
            
            <View style={styles.quantityDisplay}>
              <Text style={[styles.quantityLabel, { color: theme.gray500 }]}>Quantity</Text>
              <Text style={[styles.quantityValue, { color: theme.text }]}>{cartItem.quantity}</Text>
            </View>
            
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: theme.primary }]}
              onPress={() => handleUpdateQuantity(item.id, cartItem.quantity + 1)}
            >
              <Ionicons name="add" size={18} color={theme.white} />
            </TouchableOpacity>
            
            <View style={styles.itemTotal}>
              <Text style={[styles.itemTotalLabel, { color: theme.gray500 }]}>Total</Text>
              <Text style={[styles.itemTotalValue, { color: theme.primary }]}>
                ${(item.price * cartItem.quantity).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      </Card>
    );
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={[styles.cartItem, { borderBottomColor: theme.border }]}>
      <View style={styles.cartItemHeader}>
        <Text style={[styles.cartItemName, { color: theme.text }]} numberOfLines={1}>
          {item.productName}
        </Text>
        <TouchableOpacity onPress={() => handleRemoveFromCart(item.productId)}>
          <Ionicons name="close-circle" size={24} color={theme.error} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.cartItemDetails}>
        <View style={styles.cartItemPriceInfo}>
          <Text style={[styles.cartItemPrice, { color: theme.gray500 }]}>
            ${item.unitPrice.toFixed(2)}
          </Text>
        </View>

        <View style={[styles.cartItemQuantityControls, { backgroundColor: theme.gray100 }]}>
          <TouchableOpacity
            style={[styles.miniQuantityButton, { backgroundColor: theme.gray200 }]}
            onPress={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
          >
            <Ionicons name="remove" size={16} color={theme.text} />
          </TouchableOpacity>
          
          <Text style={[styles.cartItemQuantity, { color: theme.text }]}>{item.quantity}</Text>
          
          <TouchableOpacity
            style={[styles.miniQuantityButton, { backgroundColor: theme.primary }]}
            onPress={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
          >
            <Ionicons name="add" size={16} color={theme.white} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.cartItemTotal, { color: theme.text }]}>
          ${item.subtotal.toFixed(2)}
        </Text>
      </View>
    </View>
  );

  const renderCartModal = () => (
    <Modal
      visible={showCartModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCartModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowCartModal(false)}>
            <Text style={[styles.modalCloseButton, { color: theme.primary }]}>Close</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Cart</Text>
            <Text style={[styles.modalSubtitle, { color: theme.gray500 }]}>
              {getItemCount()} {getItemCount() === 1 ? 'item' : 'items'}
            </Text>
          </View>
          {cartItems.length > 0 ? (
            <TouchableOpacity onPress={clearCart}>
              <Text style={{ color: theme.error, fontWeight: '600' }}>Clear</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {cartItems.length === 0 ? (
          <View style={styles.emptyCart}>
            <Ionicons name="cart-outline" size={80} color={theme.gray300} />
            <Text style={[styles.emptyCartText, { color: theme.gray500 }]}>Cart is empty</Text>
            <Text style={[styles.emptyCartSubtext, { color: theme.gray400 }]}>
              Add products to start a sale
            </Text>
            <Button 
              title="Start Shopping" 
              onPress={() => setShowCartModal(false)}
              style={{ marginTop: Spacing.xl, minWidth: 200 }}
            />
          </View>
        ) : (
          <>
            <FlatList
              data={cartItems}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.productId}
              style={styles.cartList}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
            
            <View style={[styles.cartFooter, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
              <View style={styles.cartTotalsSection}>
                <View style={styles.cartTotalRow}>
                  <Text style={[styles.cartTotalLabel, { color: theme.gray500 }]}>Subtotal</Text>
                  <Text style={[styles.cartTotalValue, { color: theme.text }]}>${subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.cartTotalRow}>
                  <Text style={[styles.cartTotalLabel, { color: theme.gray500 }]}>Tax</Text>
                  <Text style={[styles.cartTotalValue, { color: theme.text }]}>${taxAmount.toFixed(2)}</Text>
                </View>
                <View style={[styles.cartTotalRow, styles.grandTotalRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.grandTotalLabel, { color: theme.text }]}>Total</Text>
                  <Text style={[styles.grandTotalValue, { color: theme.primary }]}>${total.toFixed(2)}</Text>
                </View>
              </View>
              <Button 
                title="Proceed to Checkout" 
                onPress={handleCheckout} 
                loading={orderLoading}
                style={{ width: '100%' }}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );

  const renderCheckoutModal = () => (
    <Modal
      visible={showCheckout}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCheckout(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setShowCheckout(false)}>
            <Text style={[styles.modalCloseButton, { color: theme.primary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Checkout</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={styles.checkoutContent}>
          <Card style={styles.cartSummary} padding="lg">
            <Text style={[styles.cartSummaryTitle, { color: theme.text }]}>Order Summary</Text>
            {cartItems.map((item) => (
              <View key={item.productId} style={styles.cartSummaryItem}>
                <Text style={[styles.cartSummaryItemName, { color: theme.text }]}>{item.productName}</Text>
                <Text style={[styles.cartSummaryItemDetails, { color: theme.gray500 }]}>
                  {item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.subtotal.toFixed(2)}
                </Text>
              </View>
            ))}
            
            <View style={[styles.cartSummaryTotals, { borderTopColor: theme.border }]}>
              <View style={styles.cartSummaryRow}>
                <Text style={[styles.cartSummaryLabel, { color: theme.gray500 }]}>Subtotal:</Text>
                <Text style={[styles.cartSummaryValue, { color: theme.text }]}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.cartSummaryRow}>
                <Text style={[styles.cartSummaryLabel, { color: theme.gray500 }]}>Discount:</Text>
                <Text style={[styles.cartSummaryValue, { color: theme.text }]}>-${discountAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.cartSummaryRow}>
                <Text style={[styles.cartSummaryLabel, { color: theme.gray500 }]}>Tax:</Text>
                <Text style={[styles.cartSummaryValue, { color: theme.text }]}>${taxAmount.toFixed(2)}</Text>
              </View>
              <View style={[styles.cartSummaryRow, styles.cartSummaryTotal, { borderTopColor: theme.border }]}>
                <Text style={[styles.cartSummaryTotalLabel, { color: theme.text }]}>Total:</Text>
                <Text style={[styles.cartSummaryTotalValue, { color: theme.primary }]}>${total.toFixed(2)}</Text>
              </View>
            </View>
          </Card>

          <View style={styles.paymentSection}>
            <Text style={[styles.paymentTitle, { color: theme.text }]}>Payment Method</Text>
            <TouchableOpacity
              style={[styles.paymentButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => handleProcessPayment('cash', total)}
            >
              <Ionicons name="cash" size={24} color={theme.success} />
              <Text style={[styles.paymentButtonText, { color: theme.text }]}>Cash Payment</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.paymentButton, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
              onPress={() => handleProcessPayment('card', total)}
            >
              <Ionicons name="card" size={24} color={theme.primary} />
              <Text style={[styles.paymentButtonText, { color: theme.text }]}>Card Payment</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // If not authenticated, AuthGuard will handle the redirect
  // Just show loading indicator during the brief redirect
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Sales</Text>
        <TouchableOpacity
          style={[styles.barcodeButton, { backgroundColor: theme.infoBg, borderColor: theme.info }]}
          onPress={handleBarcodeSearch}
        >
          <Ionicons name="barcode-outline" size={24} color={theme.info} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.cardBg }]}>
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={handleSearch}
          leftIcon="search"
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {/* Product List */}
      <View style={styles.content}>
        {productsLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.gray500 }]}>Loading products...</Text>
          </View>
        ) : (
          <FlatList
            data={products}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
            }
            contentContainerStyle={styles.productsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Floating Cart Bar */}
      {cartItems.length > 0 && (
        <View style={[styles.floatingCartBar, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
          <View style={styles.cartBarInfo}>
            <View style={[styles.cartIconBadge, { backgroundColor: theme.primary }]}>
              <Text style={[styles.cartIconText, { color: theme.white }]}>{getItemCount()}</Text>
            </View>
            <View>
              <Text style={[styles.cartBarLabel, { color: theme.gray500 }]}>Total</Text>
              <Text style={[styles.cartBarTotal, { color: theme.text }]}>${total.toFixed(2)}</Text>
            </View>
          </View>
          <Button 
            title="View Cart" 
            onPress={() => setShowCartModal(true)} 
            style={{ minWidth: 120 }}
          />
        </View>
      )}

      {renderCartModal()}
      {renderCheckoutModal()}
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
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: '700',
  },
  barcodeButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  searchContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  content: {
    flex: 1,
  },
  
  // Products List
  productsList: {
    padding: Spacing.lg,
    paddingBottom: 100, // Space for floating cart bar
  },
  productCard: {
    marginBottom: Spacing.md,
  },
  productTouchable: {
    width: '100%',
  },
  productContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  lowStockText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  productPriceSection: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    marginBottom: 2,
  },
  productStock: {
    fontSize: Typography.sizes.xs,
  },
  addToCartIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: Typography.sizes.xs,
    marginBottom: 2,
  },
  quantityValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  itemTotal: {
    alignItems: 'flex-end',
  },
  itemTotalLabel: {
    fontSize: Typography.sizes.xs,
    marginBottom: 2,
  },
  itemTotalValue: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },
  
  // Floating Cart Bar
  floatingCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderTopWidth: 1,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cartBarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cartIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIconText: {
    fontWeight: '700',
    fontSize: Typography.sizes.sm,
  },
  cartBarLabel: {
    fontSize: Typography.sizes.xs,
  },
  cartBarTotal: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
  },
  
  // Cart List Styles
  cartList: {
    flex: 1,
    padding: Spacing.lg,
  },
  cartItem: {
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cartItemName: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  cartItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartItemPriceInfo: {
    flex: 1,
  },
  cartItemPrice: {
    fontSize: Typography.sizes.sm,
  },
  cartItemQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: 4,
    borderRadius: BorderRadius.full,
  },
  miniQuantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemQuantity: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  cartItemTotal: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'right',
  },
  
  // Cart Footer
  cartFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    paddingBottom: Spacing.xl + 20, // Extra padding for bottom safe area
  },
  cartTotalsSection: {
    marginBottom: Spacing.lg,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  cartTotalLabel: {
    fontSize: Typography.sizes.sm,
  },
  cartTotalValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  grandTotalRow: {
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    marginBottom: 0,
  },
  grandTotalLabel: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  grandTotalValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
  },
  
  // Empty Cart
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyCartText: {
    fontSize: Typography.sizes.xl,
    fontWeight: '600',
    marginTop: Spacing.lg,
  },
  emptyCartSubtext: {
    fontSize: Typography.sizes.md,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  // Checkout Modal
  checkoutContainer: {
    flex: 1,
  },
  checkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  checkoutCloseButton: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  checkoutTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  checkoutContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  cartSummary: {
    marginBottom: Spacing.lg,
  },
  cartSummaryTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  cartSummaryItem: {
    paddingVertical: Spacing.sm,
  },
  cartSummaryItemName: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  cartSummaryItemDetails: {
    fontSize: Typography.sizes.sm,
  },
  cartSummaryTotals: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  cartSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  cartSummaryLabel: {
    fontSize: Typography.sizes.sm,
  },
  cartSummaryValue: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  cartSummaryTotal: {
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    marginBottom: 0,
  },
  cartSummaryTotalLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },
  cartSummaryTotalValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  paymentSection: {
    marginBottom: Spacing.xl,
  },
  paymentTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  paymentButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginLeft: Spacing.md,
  },
  
  // Utility
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.md,
  },
});
