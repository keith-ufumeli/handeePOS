import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../src/stores/productStore';
import Category from '../../src/database/models/Category';

export default function NewProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { categories, createProduct, isLoading, error, clearError } = useProductStore();
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    price: '',
    cost: '',
    taxRate: '0',
    stockQuantity: '0',
    lowStockThreshold: '5',
    unit: 'pcs',
    description: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    if (params.barcode) {
      setFormData(prev => ({
        ...prev,
        barcode: params.barcode as string
      }));
    }
  }, [params.barcode]);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Product name is required';
    }

    if (!formData.sku.trim()) {
      errors.sku = 'SKU is required';
    }

    if (!formData.categoryId) {
      errors.categoryId = 'Category is required';
    }

    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) < 0) {
      errors.price = 'Valid price is required';
    }

    if (!formData.cost || isNaN(Number(formData.cost)) || Number(formData.cost) < 0) {
      errors.cost = 'Valid cost is required';
    }

    if (isNaN(Number(formData.taxRate)) || Number(formData.taxRate) < 0 || Number(formData.taxRate) > 100) {
      errors.taxRate = 'Tax rate must be between 0 and 100';
    }

    if (isNaN(Number(formData.stockQuantity)) || Number(formData.stockQuantity) < 0) {
      errors.stockQuantity = 'Valid stock quantity is required';
    }

    if (isNaN(Number(formData.lowStockThreshold)) || Number(formData.lowStockThreshold) < 0) {
      errors.lowStockThreshold = 'Valid low stock threshold is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await createProduct({
        name: formData.name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        barcode: formData.barcode.trim() || undefined,
        categoryId: formData.categoryId,
        price: Number(formData.price),
        cost: Number(formData.cost),
        taxRate: Number(formData.taxRate),
        stockQuantity: Number(formData.stockQuantity),
        lowStockThreshold: Number(formData.lowStockThreshold),
        unit: formData.unit,
        description: formData.description.trim() || undefined,
      });

      Alert.alert('Success', 'Product created successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to create product');
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType: 'default' | 'numeric' = 'default',
    error?: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  const renderSelect = (
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    options: { label: string; value: string }[],
    error?: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.selectContainer, error && styles.inputError]}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.selectOption,
              value === option.value && styles.selectOptionActive,
            ]}
            onPress={() => onValueChange(option.value)}
          >
            <Text style={[
              styles.selectOptionText,
              value === option.value && styles.selectOptionTextActive,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Product</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
          <Text style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}>
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderInput(
          'Product Name *',
          formData.name,
          (text) => setFormData({ ...formData, name: text }),
          'Enter product name',
          'default',
          validationErrors.name
        )}

        {renderInput(
          'SKU *',
          formData.sku,
          (text) => setFormData({ ...formData, sku: text }),
          'Enter SKU',
          'default',
          validationErrors.sku
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Barcode</Text>
          <View style={styles.barcodeInputContainer}>
            <TextInput
              style={styles.barcodeInput}
              value={formData.barcode}
              onChangeText={(text) => setFormData({ ...formData, barcode: text })}
              placeholder="Enter barcode (optional)"
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.barcodeScanButton}
              onPress={() => router.push('/barcode-scanner')}
            >
              <Ionicons name="barcode-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          {validationErrors.barcode && (
            <Text style={styles.errorText}>{validationErrors.barcode}</Text>
          )}
        </View>

        {renderSelect(
          'Category *',
          formData.categoryId,
          (value) => setFormData({ ...formData, categoryId: value }),
          [
            { label: 'Select Category', value: '' },
            ...categories.map((category: Category) => ({
              label: category.name,
              value: category.id,
            })),
          ],
          validationErrors.categoryId
        )}

        <View style={styles.row}>
          {renderInput(
            'Price *',
            formData.price,
            (text) => setFormData({ ...formData, price: text }),
            '0.00',
            'numeric',
            validationErrors.price
          )}

          {renderInput(
            'Cost *',
            formData.cost,
            (text) => setFormData({ ...formData, cost: text }),
            '0.00',
            'numeric',
            validationErrors.cost
          )}
        </View>

        <View style={styles.row}>
          {renderInput(
            'Tax Rate (%)',
            formData.taxRate,
            (text) => setFormData({ ...formData, taxRate: text }),
            '0',
            'numeric',
            validationErrors.taxRate
          )}

          {renderInput(
            'Unit',
            formData.unit,
            (text) => setFormData({ ...formData, unit: text }),
            'pcs',
            'default'
          )}
        </View>

        <View style={styles.row}>
          {renderInput(
            'Stock Quantity',
            formData.stockQuantity,
            (text) => setFormData({ ...formData, stockQuantity: text }),
            '0',
            'numeric',
            validationErrors.stockQuantity
          )}

          {renderInput(
            'Low Stock Threshold',
            formData.lowStockThreshold,
            (text) => setFormData({ ...formData, lowStockThreshold: text }),
            '5',
            'numeric',
            validationErrors.lowStockThreshold
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Enter product description (optional)"
            multiline
            numberOfLines={3}
          />
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Creating product...</Text>
          </View>
        )}
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
  cancelButton: {
    fontSize: 16,
    color: '#FF3B30',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  saveButtonDisabled: {
    color: '#999',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#666',
  },
  selectOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  barcodeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barcodeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginRight: 8,
  },
  barcodeScanButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  inputContainer: {
    marginBottom: 16,
  },
});
