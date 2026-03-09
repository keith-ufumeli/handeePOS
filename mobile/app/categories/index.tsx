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
import { Category } from '../../src/database/types';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

export default function CategoriesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const { categories, isLoading, error, loadCategories, deleteCategory, clearError } = useProductStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCategories();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? Products in this category will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(category.id);
              Alert.alert('Deleted', `"${category.name}" has been deleted.`);
            } catch {
              Alert.alert('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <View style={[styles.categoryCard, { backgroundColor: theme.cardBg, ...Shadows.md }]}>
      <View style={styles.categoryIcon}>
        <Ionicons name="pricetag" size={22} color={theme.primary} />
      </View>
      <View style={styles.categoryInfo}>
        <Text style={[styles.categoryName, { color: theme.text }]}>{item.name}</Text>
        {item.description ? (
          <Text style={[styles.categoryDescription, { color: theme.gray500 }]} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.syncBadge}>
          {item.syncStatus === 'synced' ? (
            <Ionicons name="checkmark-circle" size={13} color={theme.success} />
          ) : item.syncStatus === 'pending' ? (
            <Ionicons name="time" size={13} color={theme.warning} />
          ) : (
            <Ionicons name="close-circle" size={13} color={theme.error} />
          )}
          <Text style={[styles.syncLabel, { color: theme.gray400 }]}>
            {item.syncStatus}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.infoBg }]}
          onPress={() => router.push(`/categories/${item.id}/edit` as any)}
        >
          <Ionicons name="create-outline" size={18} color={theme.info} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.errorBg }]}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={18} color={theme.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Categories</Text>
          <Text style={[styles.counter, { color: theme.gray500 }]}>
            {categories.length} {categories.length === 1 ? 'category' : 'categories'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/categories/new' as any)}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.gray500 }]}>Loading categories...</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetags-outline" size={56} color={theme.gray300} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No categories yet</Text>
              <Text style={[styles.emptySubtext, { color: theme.gray500 }]}>
                Add your first category to organise products.
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/categories/new' as any)}
              >
                <Text style={styles.emptyBtnText}>Add Category</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: '700',
  },
  counter: {
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizes.md,
  },
  listContent: {
    padding: Spacing.lg,
    flexGrow: 1,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: Typography.sizes.sm,
    marginBottom: 4,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  syncLabel: {
    fontSize: Typography.sizes.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  emptyBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: Typography.sizes.md,
  },
});
