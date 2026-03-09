import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useReportStore } from '../../src/stores/reportStore';
import { useAuthStore } from '../../src/stores/authStore';

const { width } = Dimensions.get('window');

interface DailySummary {
  date: string;
  summary: {
    totalSales: number;
    totalOrders: number;
    totalItems: number;
    averageOrderValue: number;
    cashSales: number;
    cardSales: number;
    mobileMoneySales: number;
  };
  hourlyBreakdown: {
    _id: number;
    sales: number;
    orders: number;
  }[];
  topProducts: {
    _id: {
      productId: string;
      productName: string;
      sku: string;
    };
    totalQuantity: number;
    totalRevenue: number;
  }[];
}

export default function ReportsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user } = useAuthStore();
  const {
    dailySummary,
    loading,
    refreshing,
    fetchDailySummary,
    refreshReports
  } = useReportStore();

  const [selectedTab, setSelectedTab] = useState<'overview' | 'products' | 'customers'>('overview');

  useEffect(() => {
    fetchDailySummary();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'cash': return theme.primary;
      case 'card': return theme.accent;
      case 'mobile_money': return theme.primaryVariant;
      default: return theme.gray500;
    }
  };

  const renderOverviewTab = () => {
    if (!dailySummary) return null;

    const { summary, hourlyBreakdown, topProducts } = dailySummary;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Sales Summary Cards */}
        <View style={styles.cardsContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="cash-outline" size={24} color={theme.primary} />
              <Text style={styles.cardTitle}>Total Sales</Text>
            </View>
            <Text style={styles.cardValue}>{formatCurrency(summary.totalSales)}</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="receipt-outline" size={24} color={theme.accent} />
              <Text style={styles.cardTitle}>Total Orders</Text>
            </View>
            <Text style={styles.cardValue}>{formatNumber(summary.totalOrders)}</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="cube-outline" size={24} color={theme.primaryVariant} />
              <Text style={styles.cardTitle}>Items Sold</Text>
            </View>
            <Text style={styles.cardValue}>{formatNumber(summary.totalItems)}</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="trending-up-outline" size={24} color={theme.warning} />
              <Text style={styles.cardTitle}>Avg Order Value</Text>
            </View>
            <Text style={styles.cardValue}>{formatCurrency(summary.averageOrderValue)}</Text>
          </View>
        </View>

        {/* Payment Methods Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <View style={styles.paymentMethods}>
            <View style={styles.paymentMethod}>
              <View style={[styles.paymentIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="cash" size={20} color={theme.white} />
              </View>
              <Text style={styles.paymentLabel}>Cash</Text>
              <Text style={styles.paymentAmount}>{formatCurrency(summary.cashSales)}</Text>
            </View>
            <View style={styles.paymentMethod}>
              <View style={[styles.paymentIcon, { backgroundColor: theme.accent }]}>
                <Ionicons name="card" size={20} color={theme.white} />
              </View>
              <Text style={styles.paymentLabel}>Card</Text>
              <Text style={styles.paymentAmount}>{formatCurrency(summary.cardSales)}</Text>
            </View>
            <View style={styles.paymentMethod}>
              <View style={[styles.paymentIcon, { backgroundColor: theme.primaryVariant }]}>
                <Ionicons name="phone-portrait" size={20} color={theme.white} />
              </View>
              <Text style={styles.paymentLabel}>Mobile Money</Text>
              <Text style={styles.paymentAmount}>{formatCurrency(summary.mobileMoneySales)}</Text>
            </View>
          </View>
        </View>

        {/* Top Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Products</Text>
            <TouchableOpacity onPress={() => setSelectedTab('products')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {topProducts.slice(0, 5).map((product, index) => (
            <View key={product._id.productId} style={styles.productItem}>
              <View style={styles.productRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product._id.productName}</Text>
                <Text style={styles.productSku}>{product._id.sku}</Text>
              </View>
              <View style={styles.productStats}>
                <Text style={styles.productQuantity}>{formatNumber(product.totalQuantity)} sold</Text>
                <Text style={styles.productRevenue}>{formatCurrency(product.totalRevenue)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/reports/sales' as any)}
            >
              <Ionicons name="bar-chart-outline" size={24} color={theme.accent} />
              <Text style={styles.actionText}>Sales Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/reports/inventory' as any)}
            >
              <Ionicons name="cube-outline" size={24} color={theme.primaryVariant} />
              <Text style={styles.actionText}>Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/reports/customers' as any)}
            >
              <Ionicons name="people-outline" size={24} color={theme.primary} />
              <Text style={styles.actionText}>Customers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/reports/export' as any)}
            >
              <Ionicons name="download-outline" size={24} color={theme.warning} />
              <Text style={styles.actionText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderProductsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.comingSoon}>Products report coming soon...</Text>
    </View>
  );

  const renderCustomersTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.comingSoon}>Customer analytics coming soon...</Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={refreshReports}
          disabled={refreshing}
        >
          <Ionicons name="refresh" size={24} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'products' && styles.activeTab]}
          onPress={() => setSelectedTab('products')}
        >
          <Text style={[styles.tabText, selectedTab === 'products' && styles.activeTabText]}>
            Products
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'customers' && styles.activeTab]}
          onPress={() => setSelectedTab('customers')}
        >
          <Text style={[styles.tabText, selectedTab === 'customers' && styles.activeTabText]}>
            Customers
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshReports}
            colors={[theme.accent]}
            tintColor={theme.accent}
          />
        }
      >
        {selectedTab === 'overview' && renderOverviewTab()}
        {selectedTab === 'products' && renderProductsTab()}
        {selectedTab === 'customers' && renderCustomersTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 8,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  viewAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  paymentMethod: {
    alignItems: 'center',
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  productRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  productSku: {
    fontSize: 12,
    color: '#6B7280',
  },
  productStats: {
    alignItems: 'flex-end',
  },
  productQuantity: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginTop: 8,
  },
  comingSoon: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 40,
  },
});
