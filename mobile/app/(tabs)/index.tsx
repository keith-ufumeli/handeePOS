import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/stores/authStore';
import { useReportStore } from '../../src/stores/reportStore';
import { useOrderStore } from '../../src/stores/orderStore';
import { useProductStore } from '../../src/stores/productStore';
import { Colors, Spacing, Typography, Shadows, BorderRadius } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user, isAuthenticated } = useAuthStore();
  const { dailySummary, fetchDailySummary, loading: reportsLoading, error: reportsError } = useReportStore();
  const { orders, loadOrders, isLoading: ordersLoading } = useOrderStore();
  const { products, loadProducts } = useProductStore();
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadDashboardData = React.useCallback(async (isInitialLoad = false) => {
    if (!isAuthenticated) {
      setInitialLoading(false);
      return;
    }

    if (isInitialLoad) {
      setInitialLoading(true);
    }

    try {
      if (isInitialLoad) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await Promise.allSettled([
        fetchDailySummary().catch(() => null),
        loadOrders({ dateFrom: new Date(new Date().setHours(0, 0, 0, 0)) }).catch(() => null),
        loadProducts({ lowStock: true }).catch(() => null),
      ]);
    } catch (error) {
      console.error('[HOME_SCREEN] Unexpected error loading dashboard data:', error);
    } finally {
      if (isInitialLoad) {
        setTimeout(() => {
          setInitialLoading(false);
        }, 500);
      }
    }
  }, [isAuthenticated, fetchDailySummary, loadOrders, loadProducts]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData(true);
    } else {
      setInitialLoading(false);
    }
  }, [isAuthenticated, loadDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboardData(false);
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

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={theme.gray400} />
          <Text style={[styles.errorText, { color: theme.gray600 }]}>
            Please log in to view dashboard
          </Text>
        </View>
      </View>
    );
  }

  if (initialLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingScreen}>
          <View style={styles.loadingIconContainer}>
            <Ionicons name="storefront" size={64} color={theme.primary} />
          </View>
          <ActivityIndicator size="large" color={theme.primary} style={styles.loadingSpinner} />
          <Text style={[styles.loadingTitle, { color: theme.text }]}>
            Welcome back!
          </Text>
          <Text style={[styles.loadingSubtitle, { color: theme.gray500 }]}>
            Loading your dashboard...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* Header Banner */}
        <LinearGradient
          colors={[theme.primary, theme.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBanner}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greetingText}>{getGreeting()},</Text>
              <Text style={styles.userNameText}>{user?.fullName || 'User'}</Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={24} color="#FFF" />
            </View>
          </View>
          
          {/* Today's Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Card style={styles.summaryCard} padding="md">
                <View style={styles.summaryIconBg}>
                  <Ionicons name="cash-outline" size={20} color={theme.success} />
                </View>
                <Text style={[styles.summaryLabel, { color: theme.gray500 }]}>Total Sales</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {dailySummary ? formatCurrency(dailySummary.summary.totalSales) : '$0.00'}
                </Text>
              </Card>
              <Card style={styles.summaryCard} padding="md">
                <View style={[styles.summaryIconBg, { backgroundColor: theme.infoBg }]}>
                  <Ionicons name="receipt-outline" size={20} color={theme.info} />
                </View>
                <Text style={[styles.summaryLabel, { color: theme.gray500 }]}>Orders</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {dailySummary ? dailySummary.summary.totalOrders : '0'}
                </Text>
              </Card>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {/* Quick Actions */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/(tabs)/sales')}
              activeOpacity={0.8}
            >
              <Ionicons name="cart" size={24} color="#FFF" />
              <Text style={styles.actionButtonText}>New Sale</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => router.push('/(tabs)/products')}
              activeOpacity={0.8}
            >
              <Ionicons name="cube-outline" size={24} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Products</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => router.push('/(tabs)/customers')}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={24} color={theme.secondary} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Customers</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => router.push('/(tabs)/reports')}
              activeOpacity={0.8}
            >
              <Ionicons name="bar-chart-outline" size={24} color={theme.warning} />
              <Text style={[styles.actionButtonText, { color: theme.text }]}>Reports</Text>
            </TouchableOpacity>
          </View>

          {/* Low Stock Alert */}
          {lowStockProducts.length > 0 && (
            <View style={styles.section}>
              <Card style={[styles.alertCard, { backgroundColor: theme.warningBg, borderColor: theme.warning }]} variant="outlined">
                <View style={styles.alertHeader}>
                  <Ionicons name="warning" size={20} color={theme.warning} />
                  <Text style={[styles.alertTitle, { color: theme.warning }]}>Low Stock Alert</Text>
                </View>
                <Text style={[styles.alertText, { color: theme.gray800 }]}>
                  {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} running low on stock.
                </Text>
                <Button 
                  title="View Products" 
                  variant="outline" 
                  size="sm" 
                  onPress={() => router.push('/(tabs)/products')}
                  style={{ alignSelf: 'flex-start', marginTop: Spacing.sm, borderColor: theme.warning }}
                  textStyle={{ color: theme.warning }}
                />
              </Card>
            </View>
          )}

          {/* Recent Orders */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/reports')}>
              <Text style={[styles.viewAllText, { color: theme.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>

          {ordersLoading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.xl }} />
          ) : orders.length > 0 ? (
            <View style={styles.ordersList}>
              {orders.slice(0, 5).map((order) => (
                <Card key={order.id} style={styles.orderCard} padding="md">
                  <View style={styles.orderHeader}>
                    <View style={styles.orderInfo}>
                      <Text style={[styles.orderNumber, { color: theme.text }]}>{order.orderNumber}</Text>
                      <Text style={[styles.orderDate, { color: theme.gray500 }]}>
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.orderAmount}>
                      <Text style={[styles.orderTotal, { color: theme.primary }]}>{formatCurrency(order.total)}</Text>
                      <Badge 
                        label={order.status} 
                        variant={order.status === 'completed' ? 'success' : 'default'} 
                        style={{ marginTop: 4 }}
                      />
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={theme.gray300} />
              <Text style={[styles.emptyStateText, { color: theme.gray500 }]}>No orders today</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  headerBanner: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  greetingText: {
    fontSize: Typography.sizes.md,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  userNameText: {
    fontSize: Typography.sizes.xxl,
    color: '#FFF',
    fontWeight: '700',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryContainer: {
    marginBottom: -Spacing.xxxl,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'flex-start',
  },
  summaryIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5', // Light green
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
  },
  mainContent: {
    paddingTop: Spacing.xxxl + Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    width: '47%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  actionButtonText: {
    marginTop: Spacing.sm,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: '#FFF',
  },
  section: {
    marginBottom: Spacing.xl,
  },
  alertCard: {
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  alertTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
  },
  alertText: {
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  viewAllText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  ordersList: {
    gap: Spacing.sm,
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  orderInfo: {
    justifyContent: 'center',
  },
  orderNumber: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: Typography.sizes.xs,
  },
  orderAmount: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyStateText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.sm,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  loadingSpinner: {
    marginBottom: Spacing.xl,
  },
  loadingTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  loadingSubtitle: {
    fontSize: Typography.sizes.md,
  },
});
