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
import { Ionicons } from '@expo/vector-icons';
import { useCustomerStore, Customer } from '../../src/stores/customerStore';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCustomer, updateLoyaltyPoints, deleteCustomer, loading: storeLoading } = useCustomerStore();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCustomer = React.useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCustomer(id);
      setCustomer(data ?? null);
    } catch {
      Alert.alert('Error', 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [id, getCustomer]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const handleEdit = () => {
    router.push({ pathname: '/customers/[id]/edit', params: { id: id! } } as any);
  };

  const handleAddLoyalty = () => {
    Alert.prompt(
      'Add loyalty points',
      'Enter points to add:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async (value: string | undefined) => {
            const points = value ? parseInt(value, 10) : NaN;
            if (!id || isNaN(points) || points <= 0) {
              Alert.alert('Error', 'Please enter a positive number');
              return;
            }
            try {
              await updateLoyaltyPoints(id, points, 'add');
              await loadCustomer();
              Alert.alert('Success', 'Loyalty points updated');
            } catch {
              Alert.alert('Error', 'Failed to update loyalty points');
            }
          },
        },
      ],
      'plain-text',
      '0',
      'numeric'
    );
  };

  const handleSubtractLoyalty = () => {
    Alert.prompt(
      'Subtract loyalty points',
      'Enter points to subtract:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subtract',
          onPress: async (value: string | undefined) => {
            const points = value ? parseInt(value, 10) : NaN;
            if (!id || isNaN(points) || points <= 0) {
              Alert.alert('Error', 'Please enter a positive number');
              return;
            }
            try {
              await updateLoyaltyPoints(id, points, 'subtract');
              await loadCustomer();
              Alert.alert('Success', 'Loyalty points updated');
            } catch {
              Alert.alert('Error', 'Failed to update loyalty points');
            }
          },
        },
      ],
      'plain-text',
      '0',
      'numeric'
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${customer?.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            try {
              await deleteCustomer(id);
              Alert.alert('Success', 'Customer deleted', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch {
              Alert.alert('Error', 'Failed to delete customer');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString).toLocaleDateString() : 'Never';

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return '#CD7F32';
      case 'silver': return '#C0C0C0';
      case 'gold': return '#FFD700';
      case 'platinum': return '#E5E4E2';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading customer...</Text>
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Customer not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const address = customer.address;
  const addressLine = address
    ? [address.street, address.city, address.country, address.postalCode].filter(Boolean).join(', ')
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{customer.name}</Text>
        <TouchableOpacity onPress={handleEdit} disabled={storeLoading}>
          <Text style={styles.editButton}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{customer.name}</Text>
            <View style={[styles.tierBadge, { backgroundColor: getTierColor(customer.tier) }]}>
              <Text style={styles.tierText}>{customer.tier.toUpperCase()}</Text>
            </View>
          </View>

          {customer.email ? (
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              <Text style={styles.detailText}>{customer.email}</Text>
            </View>
          ) : null}
          {customer.phoneNumber ? (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={18} color="#6B7280" />
              <Text style={styles.detailText}>{customer.phoneNumber}</Text>
            </View>
          ) : null}
          {addressLine ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={18} color="#6B7280" />
              <Text style={styles.detailText}>{addressLine}</Text>
            </View>
          ) : null}
          {customer.notes ? (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{customer.notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatCurrency(customer.totalSpent)}</Text>
              <Text style={styles.statLabel}>Total spent</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{customer.totalOrders}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{customer.loyaltyPoints}</Text>
              <Text style={styles.statLabel}>Loyalty points</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={18} color="#6B7280" />
            <Text style={styles.detailText}>Last visit: {formatDate(customer.lastVisit)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddLoyalty} disabled={storeLoading}>
            <Ionicons name="star-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Add loyalty points</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleSubtractLoyalty} disabled={storeLoading}>
            <Ionicons name="remove-circle-outline" size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>Subtract loyalty points</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={handleDelete} disabled={storeLoading}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={styles.dangerButtonText}>Delete customer</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 8,
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
