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
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../src/stores/productStore';
import { useAuthStore } from '../../src/stores/authStore';
import { Product } from '../../src/database/types';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

export default function ProductsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { isAuthenticated } = useAuthStore();
  const {
    products,
    categories,
    isLoading,
    error,
    filters,
    loadProducts,
    loadCategories,
    searchProducts,
    syncProducts,
    setFilters,
    clearError,
  } = useProductStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
      loadCategories();
    }
  }, [isAuthenticated, loadProducts, loadCategories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadProducts(filters);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSync = async () => {
    try {
      await syncProducts();
      Alert.alert('Success', 'Products synced successfully');
    } catch {
      Alert.alert('Error', 'Failed to sync products');
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      await searchProducts(query);
    } else {
      await loadProducts(filters);
    }
  };

  const handleFilterChange = (newFilters: any) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    loadProducts(updatedFilters);
  };

  const handleLowStockToggle = () => {
    const newLowStockValue = !filters.lowStock;
    handleFilterChange({ lowStock: newLowStockValue });
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <Card 
      style={styles.productCard} 
      padding="md"
    >
      <TouchableOpacity onPress={() => router.push(`/products/${item.id}`)}>
        <View style={styles.productHeader}>
          <Text style={[styles.productName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
          <Badge label={item.sku} variant="default" style={{ backgroundColor: theme.gray200 }} />
        </View>
        
        <View style={styles.productDetails}>
          <Text style={[styles.productPrice, { color: theme.primary }]}>${item.price.toFixed(2)}</Text>
          <Text style={[styles.productStock, { color: theme.gray500 }]}>
            Stock: {item.stockQuantity} {item.unit}
          </Text>
        </View>

        {item.isLowStock && (
          <View style={styles.lowStockContainer}>
            <Ionicons name="warning" size={14} color={theme.warning} />
            <Text style={[styles.lowStockWarning, { color: theme.warning }]}>Low Stock</Text>
          </View>
        )}
        
        <View style={styles.productFooter}>
          <View style={styles.syncStatusContainer}>
            {item.syncStatus === 'synced' ? (
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            ) : item.syncStatus === 'pending' ? (
              <Ionicons name="time" size={16} color={theme.warning} />
            ) : (
              <Ionicons name="close-circle" size={16} color={theme.error} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );

  const renderCategoryFilter = () => (
    <View style={[styles.filterContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
      <Text style={[styles.filterLabel, { color: theme.text }]}>Category:</Text>
      <View style={styles.categoryChips}>
        <TouchableOpacity
          style={[
            styles.categoryChip,
            { backgroundColor: !filters.category ? theme.primary : theme.gray200, borderColor: !filters.category ? theme.primary : theme.border },
          ]}
          onPress={() => handleFilterChange({ category: undefined })}
        >
          <Text style={[
            styles.categoryChipText,
            { color: !filters.category ? '#FFF' : theme.text },
          ]}>
            All
          </Text>
        </TouchableOpacity>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              { backgroundColor: filters.category === category.id ? theme.primary : theme.gray200, borderColor: filters.category === category.id ? theme.primary : theme.border },
            ]}
            onPress={() => handleFilterChange({ category: category.id })}
          >
            <Text style={[
              styles.categoryChipText,
              { color: filters.category === category.id ? '#FFF' : theme.text },
            ]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Products</Text>
        <View style={styles.headerActions}>
          <Button 
            title="Sync" 
            onPress={handleSync} 
            size="sm" 
            variant="secondary"
            style={{ marginRight: Spacing.sm }}
          />
          <Button 
            title="+ Add" 
            onPress={() => router.push('/products/new')} 
            size="sm" 
          />
        </View>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.cardBg }]}>
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={handleSearch}
          leftIcon="search"
          containerStyle={{ flex: 1, marginBottom: 0, marginRight: Spacing.md }}
        />
        <TouchableOpacity
          style={[styles.barcodeButton, { backgroundColor: theme.infoBg, borderColor: theme.info }]}
          onPress={() => router.push('/barcode-scanner')}
        >
          <Ionicons name="barcode-outline" size={24} color={theme.info} />
        </TouchableOpacity>
      </View>

      {renderCategoryFilter()}

      <View style={[styles.filterRow, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { 
              backgroundColor: filters.lowStock ? theme.error : theme.gray200, 
              borderColor: filters.lowStock ? theme.error : theme.border 
            },
          ]}
          onPress={handleLowStockToggle}
        >
          <Ionicons 
            name={filters.lowStock ? "warning" : "warning-outline"} 
            size={16} 
            color={filters.lowStock ? "#fff" : theme.gray500} 
            style={{ marginRight: 6 }}
          />
          <Text style={[
            styles.filterButtonText,
            { color: filters.lowStock ? "#fff" : theme.text },
          ]}>
            Low Stock
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.errorBg, borderBottomColor: theme.error }]}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Text style={[styles.dismissText, { color: theme.error }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.gray500 }]}>No products found</Text>
              <Button 
                title="Add your first product" 
                onPress={() => router.push('/products/new')} 
              />
            </View>
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  barcodeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    borderBottomWidth: 1,
  },
  filterLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  errorText: {
    fontSize: Typography.sizes.sm,
    flex: 1,
  },
  dismissText: {
    fontSize: Typography.sizes.sm,
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
  listContainer: {
    padding: Spacing.lg,
  },
  productCard: {
    marginBottom: Spacing.md,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  productName: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  productPrice: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  productStock: {
    fontSize: Typography.sizes.sm,
  },
  lowStockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 4,
  },
  lowStockWarning: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.xs,
  },
  syncStatusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    marginTop: Spacing.xl,
  },
  emptyText: {
    fontSize: Typography.sizes.lg,
    marginBottom: Spacing.lg,
  },
});
