import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useCustomerStore } from '../../src/stores/customerStore';
import { useAuthStore } from '../../src/stores/authStore';

interface Customer {
  _id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  totalSpent: number;
  totalOrders: number;
  loyaltyPoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  lastVisit?: string;
}

export default function CustomersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user } = useAuthStore();
  const {
    customers,
    loading,
    refreshing,
    searchQuery,
    setSearchQuery,
    fetchCustomers,
    searchCustomers,
    refreshCustomers,
    deleteCustomer
  } = useCustomerStore();

  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchCustomers(query);
    } else {
      fetchCustomers();
    }
  };

  const handleDeleteCustomer = (customerId: string, customerName: string) => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${customerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCustomer(customerId)
        }
      ]
    );
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return '#CD7F32';
      case 'silver': return '#C0C0C0';
      case 'gold': return '#FFD700';
      case 'platinum': return '#E5E4E2';
      default: return theme.gray500;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={[styles.customerCard, { backgroundColor: theme.cardBg }]}
      onPress={() => router.push(`/customers/${item._id}` as any)}
    >
      <View style={styles.customerHeader}>
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: theme.text }]}>{item.name}</Text>
          <View style={styles.tierContainer}>
            <View style={[styles.tierBadge, { backgroundColor: getTierColor(item.tier) }]}>
              <Text style={[styles.tierText, { color: theme.white }]}>{item.tier.toUpperCase()}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteCustomer(item._id, item.name)}
        >
          <Ionicons name="trash-outline" size={20} color={theme.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.customerDetails}>
        {item.email && (
          <View style={styles.detailRow}>
            <Ionicons name="mail-outline" size={16} color={theme.gray500} />
            <Text style={[styles.detailText, { color: theme.gray500 }]}>{item.email}</Text>
          </View>
        )}
        {item.phoneNumber && (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={16} color={theme.gray500} />
            <Text style={[styles.detailText, { color: theme.gray500 }]}>{item.phoneNumber}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={16} color={theme.gray500} />
          <Text style={[styles.detailText, { color: theme.gray500 }]}>{formatCurrency(item.totalSpent)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="receipt-outline" size={16} color={theme.gray500} />
          <Text style={[styles.detailText, { color: theme.gray500 }]}>{item.totalOrders} orders</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="star-outline" size={16} color={theme.gray500} />
          <Text style={[styles.detailText, { color: theme.gray500 }]}>{item.loyaltyPoints} points</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={theme.gray500} />
          <Text style={[styles.detailText, { color: theme.gray500 }]}>Last visit: {formatDate(item.lastVisit)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={theme.gray400} />
      <Text style={[styles.emptyTitle, { color: theme.gray700 }]}>No customers found</Text>
      <Text style={[styles.emptySubtitle, { color: theme.gray500 }]}>
        {searchQuery ? 'Try adjusting your search terms' : 'Add your first customer to get started'}
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.gray500 }]}>Loading customers...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Customers</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Ionicons name="search-outline" size={24} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/customers/new' as any)}
          >
            <Ionicons name="add" size={24} color={theme.white} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <View style={[styles.searchContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSearchQuery('');
              fetchCustomers();
            }}
          >
            <Ionicons name="close" size={20} color={theme.gray500} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={customers}
        keyExtractor={(item) => item._id}
        renderItem={renderCustomer}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshCustomers}
            colors={[theme.accent]}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    fontSize: 16,
    color: '#111827',
  },
  clearButton: {
    marginLeft: 8,
    padding: 8,
  },
  listContainer: {
    padding: 20,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  tierContainer: {
    flexDirection: 'row',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: 4,
  },
  customerDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});
