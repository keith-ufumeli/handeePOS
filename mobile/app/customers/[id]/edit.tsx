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
import { useCustomerStore, Customer } from '../../../src/stores/customerStore';

export default function EditCustomerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCustomer, updateCustomer, loading: storeLoading, error, clearError } = useCustomerStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    street: '',
    city: '',
    country: '',
    postalCode: '',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const customer = await getCustomer(id);
        if (customer) {
          setFormData({
            name: customer.name || '',
            email: customer.email || '',
            phoneNumber: customer.phoneNumber || '',
            street: customer.address?.street || '',
            city: customer.address?.city || '',
            country: customer.address?.country || '',
            postalCode: customer.address?.postalCode || '',
            notes: customer.notes || '',
          });
        } else {
          Alert.alert('Error', 'Customer not found', [{ text: 'OK', onPress: () => router.back() }]);
        }
      } catch {
        Alert.alert('Error', 'Failed to load customer', [{ text: 'OK', onPress: () => router.back() }]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, getCustomer, router]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Customer name is required';
    if (formData.email.trim() && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !id) return;
    try {
      const customerData: Partial<Customer> = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };
      if (formData.street || formData.city || formData.country || formData.postalCode) {
        customerData.address = {
          street: formData.street.trim(),
          city: formData.city.trim(),
          country: formData.country.trim(),
          postalCode: formData.postalCode.trim(),
        };
      }
      await updateCustomer(id, customerData);
      Alert.alert('Success', 'Customer updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to update customer');
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default',
    err?: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, err && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
      />
      {err ? <Text style={styles.errorText}>{err}</Text> : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading customer...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Customer</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={storeLoading}>
          <Text style={[styles.saveButton, storeLoading && styles.saveButtonDisabled]}>
            {storeLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderInput('Name *', formData.name, (t) => setFormData({ ...formData, name: t }), 'Enter customer name', 'default', validationErrors.name)}
        {renderInput('Email', formData.email, (t) => setFormData({ ...formData, email: t }), 'Enter email (optional)', 'email-address', validationErrors.email)}
        {renderInput('Phone', formData.phoneNumber, (t) => setFormData({ ...formData, phoneNumber: t }), 'Enter phone (optional)', 'phone-pad')}
        <Text style={styles.sectionLabel}>Address (optional)</Text>
        {renderInput('Street', formData.street, (t) => setFormData({ ...formData, street: t }), 'Street address')}
        <View style={styles.row}>
          {renderInput('City', formData.city, (t) => setFormData({ ...formData, city: t }), 'City')}
          {renderInput('Postal Code', formData.postalCode, (t) => setFormData({ ...formData, postalCode: t }), 'Postal code')}
        </View>
        {renderInput('Country', formData.country, (t) => setFormData({ ...formData, country: t }), 'Country')}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.notes}
            onChangeText={(t) => setFormData({ ...formData, notes: t })}
            placeholder="Notes (optional)"
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: { fontSize: 16, color: '#FF3B30' },
  title: { fontSize: 18, fontWeight: '600', color: '#333' },
  saveButton: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  saveButtonDisabled: { color: '#999' },
  content: { flex: 1, padding: 16 },
  inputGroup: { marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 8 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#FF3B30' },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  errorText: { fontSize: 12, color: '#FF3B30', marginTop: 4 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
});
