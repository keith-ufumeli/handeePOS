import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';

interface StoreSettings {
  _id: string;
  name: string;
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  phoneNumber?: string;
  email?: string;
  currency: string;
  timezone: string;
  receiptSettings: {
    headerText: string;
    footerText: string;
    showLogo: boolean;
    logoUrl?: string;
    showTaxBreakdown: boolean;
    showLoyaltyPoints: boolean;
    paperSize: string;
    fontSize: string;
    showQRCode: boolean;
    qrCodeData?: string;
  };
  taxSettings: {
    defaultTaxRate: number;
    taxInclusive: boolean;
    taxName: string;
    taxNumber?: string;
    showTaxOnReceipt: boolean;
  };
  businessHours: {
    [key: string]: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
      breakStart?: string;
      breakEnd?: string;
    };
  };
  features: {
    loyaltyProgram: boolean;
    multiStore: boolean;
    advancedReports: boolean;
    inventoryTracking: boolean;
  };
}

export default function SettingsScreen() {
  const { user } = useAuthStore();
  const {
    storeSettings,
    loading,
    refreshing,
    fetchStoreSettings,
    updateStoreSettings,
    refreshSettings
  } = useSettingsStore();

  const [activeSection, setActiveSection] = useState<'general' | 'receipt' | 'tax' | 'hours' | 'features'>('general');
  const [isEditing, setIsEditing] = useState(false);
  const [editedSettings, setEditedSettings] = useState<Partial<StoreSettings>>({});

  useEffect(() => {
    fetchStoreSettings();
  }, [fetchStoreSettings]);

  const handleSave = async () => {
    try {
      await updateStoreSettings(editedSettings);
      setIsEditing(false);
      setEditedSettings({});
      Alert.alert('Success', 'Settings updated successfully');
    } catch {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedSettings({});
  };


  const handleFieldChange = (field: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleReceiptFieldChange = (field: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      receiptSettings: {
        ...prev.receiptSettings,
        ...storeSettings?.receiptSettings,
        [field]: value
      } as StoreSettings['receiptSettings']
    }));
  };

  const handleTaxFieldChange = (field: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      taxSettings: {
        ...prev.taxSettings,
        ...storeSettings?.taxSettings,
        [field]: value
      } as StoreSettings['taxSettings']
    }));
  };

  const renderGeneralSettings = () => {
    if (!storeSettings) return null;

    const settings = { ...storeSettings, ...editedSettings };

    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Store Name</Text>
            <TextInput
              style={styles.input}
              value={settings.name}
              onChangeText={(value) => handleFieldChange('name', value)}
              editable={isEditing}
              placeholder="Enter store name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={settings.phoneNumber || ''}
              onChangeText={(value) => handleFieldChange('phoneNumber', value)}
              editable={isEditing}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={settings.email || ''}
              onChangeText={(value) => handleFieldChange('email', value)}
              editable={isEditing}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerText}>{settings.currency}</Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Timezone</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerText}>{settings.timezone}</Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Street Address</Text>
            <TextInput
              style={styles.input}
              value={settings.address.street}
              onChangeText={(value) => handleFieldChange('address', { ...settings.address, street: value })}
              editable={isEditing}
              placeholder="Enter street address"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={settings.address.city}
                onChangeText={(value) => handleFieldChange('address', { ...settings.address, city: value })}
                editable={isEditing}
                placeholder="City"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Postal Code</Text>
              <TextInput
                style={styles.input}
                value={settings.address.postalCode}
                onChangeText={(value) => handleFieldChange('address', { ...settings.address, postalCode: value })}
                editable={isEditing}
                placeholder="Postal code"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={settings.address.country}
              onChangeText={(value) => handleFieldChange('address', { ...settings.address, country: value })}
              editable={isEditing}
              placeholder="Country"
            />
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderReceiptSettings = () => {
    if (!storeSettings) return null;

    const settings = { ...storeSettings, ...editedSettings };
    const receiptSettings = settings.receiptSettings || storeSettings.receiptSettings;

    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipt Header & Footer</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Header Text</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={receiptSettings.headerText}
              onChangeText={(value) => handleReceiptFieldChange('headerText', value)}
              editable={isEditing}
              placeholder="Enter header text"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Footer Text</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={receiptSettings.footerText}
              onChangeText={(value) => handleReceiptFieldChange('footerText', value)}
              editable={isEditing}
              placeholder="Enter footer text"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show Logo</Text>
            <Switch
              value={receiptSettings.showLogo}
              onValueChange={(value) => handleReceiptFieldChange('showLogo', value)}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show Tax Breakdown</Text>
            <Switch
              value={receiptSettings.showTaxBreakdown}
              onValueChange={(value) => handleReceiptFieldChange('showTaxBreakdown', value)}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show Loyalty Points</Text>
            <Switch
              value={receiptSettings.showLoyaltyPoints}
              onValueChange={(value) => handleReceiptFieldChange('showLoyaltyPoints', value)}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show QR Code</Text>
            <Switch
              value={receiptSettings.showQRCode}
              onValueChange={(value) => handleReceiptFieldChange('showQRCode', value)}
              disabled={!isEditing}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipt Format</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Paper Size</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerText}>{receiptSettings.paperSize}</Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Font Size</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerText}>{receiptSettings.fontSize}</Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderTaxSettings = () => {
    if (!storeSettings) return null;

    const settings = { ...storeSettings, ...editedSettings };
    const taxSettings = settings.taxSettings || storeSettings.taxSettings;

    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Configuration</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Default Tax Rate (%)</Text>
            <TextInput
              style={styles.input}
              value={taxSettings.defaultTaxRate.toString()}
              onChangeText={(value) => handleTaxFieldChange('defaultTaxRate', parseFloat(value) || 0)}
              editable={isEditing}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tax Name</Text>
            <TextInput
              style={styles.input}
              value={taxSettings.taxName}
              onChangeText={(value) => handleTaxFieldChange('taxName', value)}
              editable={isEditing}
              placeholder="e.g., VAT, Sales Tax"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tax Number</Text>
            <TextInput
              style={styles.input}
              value={taxSettings.taxNumber || ''}
              onChangeText={(value) => handleTaxFieldChange('taxNumber', value)}
              editable={isEditing}
              placeholder="Enter tax registration number"
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Tax Inclusive Pricing</Text>
            <Switch
              value={taxSettings.taxInclusive}
              onValueChange={(value) => handleTaxFieldChange('taxInclusive', value)}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show Tax on Receipt</Text>
            <Switch
              value={taxSettings.showTaxOnReceipt}
              onValueChange={(value) => handleTaxFieldChange('showTaxOnReceipt', value)}
              disabled={!isEditing}
            />
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderBusinessHours = () => {
    if (!storeSettings) return null;

    const settings = { ...storeSettings, ...editedSettings };
    const businessHours = settings.businessHours || storeSettings.businessHours;

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Hours</Text>
          
          {days.map((day) => {
            const dayHours = businessHours[day] || { isOpen: false, openTime: '09:00', closeTime: '17:00' };
            return (
              <View key={day} style={styles.dayContainer}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                  <Switch
                    value={dayHours.isOpen}
                    onValueChange={(value) => {
                      const newHours = { ...businessHours };
                      newHours[day] = { ...dayHours, isOpen: value };
                      handleFieldChange('businessHours', newHours);
                    }}
                    disabled={!isEditing}
                  />
                </View>
                
                {dayHours.isOpen && (
                  <View style={styles.timeInputs}>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Open</Text>
                      <TextInput
                        style={styles.timeInputField}
                        value={dayHours.openTime}
                        onChangeText={(value) => {
                          const newHours = { ...businessHours };
                          newHours[day] = { ...dayHours, openTime: value };
                          handleFieldChange('businessHours', newHours);
                        }}
                        editable={isEditing}
                        placeholder="09:00"
                      />
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Close</Text>
                      <TextInput
                        style={styles.timeInputField}
                        value={dayHours.closeTime}
                        onChangeText={(value) => {
                          const newHours = { ...businessHours };
                          newHours[day] = { ...dayHours, closeTime: value };
                          handleFieldChange('businessHours', newHours);
                        }}
                        editable={isEditing}
                        placeholder="17:00"
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderFeatures = () => {
    if (!storeSettings) return null;

    const settings = { ...storeSettings, ...editedSettings };
    const features = settings.features || storeSettings.features;

    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feature Toggles</Text>
          
          <View style={styles.switchGroup}>
            <View style={styles.featureInfo}>
              <Text style={styles.label}>Loyalty Program</Text>
              <Text style={styles.featureDescription}>Enable customer loyalty points and rewards</Text>
            </View>
            <Switch
              value={features.loyaltyProgram}
              onValueChange={(value) => handleFieldChange('features', { ...features, loyaltyProgram: value })}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.featureInfo}>
              <Text style={styles.label}>Multi-Store Support</Text>
              <Text style={styles.featureDescription}>Manage multiple store locations</Text>
            </View>
            <Switch
              value={features.multiStore}
              onValueChange={(value) => handleFieldChange('features', { ...features, multiStore: value })}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.featureInfo}>
              <Text style={styles.label}>Advanced Reports</Text>
              <Text style={styles.featureDescription}>Access detailed analytics and insights</Text>
            </View>
            <Switch
              value={features.advancedReports}
              onValueChange={(value) => handleFieldChange('features', { ...features, advancedReports: value })}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.featureInfo}>
              <Text style={styles.label}>Inventory Tracking</Text>
              <Text style={styles.featureDescription}>Track stock levels and low stock alerts</Text>
            </View>
            <Switch
              value={features.inventoryTracking}
              onValueChange={(value) => handleFieldChange('features', { ...features, inventoryTracking: value })}
              disabled={!isEditing}
            />
          </View>
        </View>
      </ScrollView>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerActions}>
          {isEditing ? (
            <>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
              <Ionicons name="create-outline" size={24} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'general' && styles.activeTab]}
            onPress={() => setActiveSection('general')}
          >
            <Text style={[styles.tabText, activeSection === 'general' && styles.activeTabText]}>
              General
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'receipt' && styles.activeTab]}
            onPress={() => setActiveSection('receipt')}
          >
            <Text style={[styles.tabText, activeSection === 'receipt' && styles.activeTabText]}>
              Receipt
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'tax' && styles.activeTab]}
            onPress={() => setActiveSection('tax')}
          >
            <Text style={[styles.tabText, activeSection === 'tax' && styles.activeTabText]}>
              Tax
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'hours' && styles.activeTab]}
            onPress={() => setActiveSection('hours')}
          >
            <Text style={[styles.tabText, activeSection === 'hours' && styles.activeTabText]}>
              Hours
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'features' && styles.activeTab]}
            onPress={() => setActiveSection('features')}
          >
            <Text style={[styles.tabText, activeSection === 'features' && styles.activeTabText]}>
              Features
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshSettings}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
      >
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person" size={32} color="#fff" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.fullName || 'User'}</Text>
                <Text style={styles.profileEmail}>{user?.email || ''}</Text>
                <Text style={styles.profileRole}>{user?.role || 'Staff'}</Text>
              </View>
            </View>

          </View>
        </View>

        {/* Settings Content */}
        {activeSection === 'general' && renderGeneralSettings()}
        {activeSection === 'receipt' && renderReceiptSettings()}
        {activeSection === 'tax' && renderTaxSettings()}
        {activeSection === 'hours' && renderBusinessHours()}
        {activeSection === 'features' && renderFeatures()}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabScroll: {
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 16,
    paddingHorizontal: 20,
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
  sectionContent: {
    padding: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  pickerText: {
    fontSize: 16,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureInfo: {
    flex: 1,
    marginRight: 16,
  },
  featureDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  dayContainer: {
    marginBottom: 20,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  timeInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  timeInputField: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 13,
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },

});
