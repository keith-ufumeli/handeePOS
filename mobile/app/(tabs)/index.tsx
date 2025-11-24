import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useAuthStore } from '../../src/stores/authStore';
import { useReportStore } from '../../src/stores/reportStore';
import { useOrderStore } from '../../src/stores/orderStore';
import { useProductStore } from '../../src/stores/productStore';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { dailySummary, fetchDailySummary, loading: reportsLoading } = useReportStore();
  const { orders, loadOrders, isLoading: ordersLoading } = useOrderStore();
  const { products, loadProducts } = useProductStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = React.useCallback(async () => {
    try {
      await Promise.all([
        fetchDailySummary(),
        loadOrders({ dateFrom: new Date(new Date().setHours(0, 0, 0, 0)) }),
        loadProducts({ lowStock: true }),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }, [fetchDailySummary, loadOrders, loadProducts]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);


  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const lowStockProducts = products.filter(p => p.isLowStock);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText type="title" style={styles.greeting}>
              {getGreeting()},
            </ThemedText>
            <ThemedText type="subtitle" style={styles.userName}>
              {user?.fullName || 'User'}
            </ThemedText>
          </View>
        </View>

        {/* Today's Stats */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Today&apos;s Summary
          </ThemedText>
          {reportsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : dailySummary ? (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="cash-outline" size={24} color="#34C759" />
                <ThemedText style={styles.statValue}>
                  {formatCurrency(dailySummary.summary.totalSales)}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Total Sales</ThemedText>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="receipt-outline" size={24} color="#007AFF" />
                <ThemedText style={styles.statValue}>
                  {dailySummary.summary.totalOrders}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Orders</ThemedText>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="cube-outline" size={24} color="#FF9500" />
                <ThemedText style={styles.statValue}>
                  {dailySummary.summary.totalItems}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Items Sold</ThemedText>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="trending-up-outline" size={24} color="#AF52DE" />
                <ThemedText style={styles.statValue}>
                  {formatCurrency(dailySummary.summary.averageOrderValue)}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Avg Order</ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyStateText}>
                No data available for today
              </ThemedText>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Quick Actions
          </ThemedText>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, styles.primaryAction]}
              onPress={() => router.push('/(tabs)/sales')}
            >
              <Ionicons name="cart" size={32} color="#fff" />
              <ThemedText style={styles.actionText}>New Sale</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/products')}
            >
              <Ionicons name="bag" size={28} color="#007AFF" />
              <ThemedText style={styles.actionText}>Products</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/customers')}
            >
              <Ionicons name="people" size={28} color="#34C759" />
              <ThemedText style={styles.actionText}>Customers</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/reports')}
            >
              <Ionicons name="bar-chart" size={28} color="#FF9500" />
              <ThemedText style={styles.actionText}>Reports</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning" size={20} color="#FF9500" />
              <ThemedText type="subtitle" style={styles.alertTitle}>
                Low Stock Alert
              </ThemedText>
            </View>
            <View style={styles.alertCard}>
              <ThemedText style={styles.alertText}>
                {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} running low on stock
              </ThemedText>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => router.push('/(tabs)/products')}
              >
                <ThemedText style={styles.alertButtonText}>View Products</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Recent Orders
            </ThemedText>
            {orders.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/reports')}>
                <ThemedText style={styles.viewAllText}>View All</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          {ordersLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : orders.length > 0 ? (
            <View style={styles.ordersList}>
              {orders.slice(0, 5).map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <ThemedText style={styles.orderNumber}>
                      {order.orderNumber}
                    </ThemedText>
                    <ThemedText style={styles.orderTotal}>
                      {formatCurrency(order.total)}
                    </ThemedText>
                  </View>
                  <View style={styles.orderDetails}>
                    <ThemedText style={styles.orderDate}>
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </ThemedText>
                    <View style={styles.orderStatus}>
                      <View
                        style={[
                          styles.statusDot,
                          order.status === 'completed' && styles.statusDotCompleted,
                        ]}
                      />
                      <ThemedText style={styles.orderStatusText}>
                        {order.status}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <ThemedText style={styles.emptyStateText}>
                No orders today
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  greeting: {
    marginBottom: 4,
  },
  userName: {
    opacity: 0.8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '47%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
  },
  primaryAction: {
    backgroundColor: '#34C759',
    width: '100%',
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  alertTitle: {
    marginBottom: 0,
  },
  alertCard: {
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  alertText: {
    marginBottom: 12,
    fontSize: 14,
  },
  alertButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ordersList: {
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  orderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  statusDotCompleted: {
    backgroundColor: '#34C759',
  },
  orderStatusText: {
    fontSize: 12,
    textTransform: 'capitalize',
    opacity: 0.8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});
