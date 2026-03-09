import React, { useState, useEffect, useMemo } from 'react';
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
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';

// ─── Picker options ──────────────────────────────────────────────────────────

const CURRENCIES = [
  { value: 'USD', label: 'USD – US Dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British Pound' },
  { value: 'ZAR', label: 'ZAR – South African Rand' },
  { value: 'KES', label: 'KES – Kenyan Shilling' },
  { value: 'NGN', label: 'NGN – Nigerian Naira' },
  { value: 'GHS', label: 'GHS – Ghanaian Cedi' },
  { value: 'UGX', label: 'UGX – Ugandan Shilling' },
  { value: 'TZS', label: 'TZS – Tanzanian Shilling' },
  { value: 'AUD', label: 'AUD – Australian Dollar' },
  { value: 'CAD', label: 'CAD – Canadian Dollar' },
  { value: 'JPY', label: 'JPY – Japanese Yen' },
  { value: 'CNY', label: 'CNY – Chinese Yuan' },
  { value: 'INR', label: 'INR – Indian Rupee' },
  { value: 'BRL', label: 'BRL – Brazilian Real' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
  { value: 'Africa/Accra', label: 'Africa/Accra (GMT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
];

const PAPER_SIZES = [
  { value: '58mm', label: '58mm (Small receipt)' },
  { value: '80mm', label: '80mm (Standard receipt)' },
  { value: 'A4', label: 'A4 (Full page)' },
];

const FONT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── PickerModal ─────────────────────────────────────────────────────────────

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function PickerModal({ visible, title, options, selected, onSelect, onClose }: PickerModalProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={[pickerStyles.sheet, { backgroundColor: theme.cardBg }]}>
        <View style={[pickerStyles.handle, { backgroundColor: theme.gray300 }]} />
        <View style={pickerStyles.sheetHeader}>
          <Text style={[pickerStyles.sheetTitle, { color: theme.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={theme.gray500} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={pickerStyles.option}
              onPress={() => { onSelect(item.value); onClose(); }}
            >
              <Text style={[pickerStyles.optionText, { color: theme.gray700 }, item.value === selected && { color: theme.accent, fontWeight: '600' }]}>
                {item.label}
              </Text>
              {item.value === selected && (
                <Ionicons name="checkmark" size={20} color={theme.accent} />
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={[pickerStyles.separator, { backgroundColor: theme.border }]} />}
          style={pickerStyles.list}
        />
      </SafeAreaView>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  list: { paddingHorizontal: 4 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  optionText: {
    fontSize: 16,
  },
  separator: {
    height: 1,
    marginHorizontal: 20,
  },
});

// ─── Settings Screen ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const styles = useMemo(() => createStyles(theme), [theme]);
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

  // Picker modal state
  const [picker, setPicker] = useState<{
    type: 'currency' | 'timezone' | 'paperSize' | 'fontSize' | null;
  }>({ type: null });

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
    setEditedSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleReceiptFieldChange = (field: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      receiptSettings: {
        ...storeSettings?.receiptSettings,
        ...prev.receiptSettings,
        [field]: value,
      } as StoreSettings['receiptSettings'],
    }));
  };

  const handleTaxFieldChange = (field: string, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      taxSettings: {
        ...storeSettings?.taxSettings,
        ...prev.taxSettings,
        [field]: value,
      } as StoreSettings['taxSettings'],
    }));
  };

  // ── Picker helpers ────────────────────────────────────────────────────────

  const currentValue = (field: 'currency' | 'timezone') => {
    const merged = { ...storeSettings, ...editedSettings };
    return (merged as any)[field] ?? '';
  };
  const currentReceiptValue = (field: 'paperSize' | 'fontSize') => {
    const merged = { ...storeSettings?.receiptSettings, ...editedSettings.receiptSettings };
    return (merged as any)[field] ?? '';
  };

  const PickerRow = ({
    label,
    value,
    pickerType,
  }: {
    label: string;
    value: string;
    pickerType: 'currency' | 'timezone' | 'paperSize' | 'fontSize';
  }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.pickerContainer, !isEditing && styles.pickerDisabled]}
        onPress={() => isEditing && setPicker({ type: pickerType })}
        activeOpacity={isEditing ? 0.7 : 1}
      >
        <Text style={[styles.pickerText, !value && { color: theme.gray400 }]}>{value || '—'}</Text>
        {isEditing && <Ionicons name="chevron-down" size={20} color="#6B7280" />}
      </TouchableOpacity>
    </View>
  );

  // ── Section renderers ─────────────────────────────────────────────────────

  const renderGeneralSettings = () => {
    if (!storeSettings) return null;
    const settings = { ...storeSettings, ...editedSettings };

    return (
      <View style={styles.sectionContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Store Name</Text>
            <TextInput
              style={styles.input}
              value={settings.name}
              onChangeText={(v) => handleFieldChange('name', v)}
              editable={isEditing}
              placeholder="Enter store name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={settings.phoneNumber || ''}
              onChangeText={(v) => handleFieldChange('phoneNumber', v)}
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
              onChangeText={(v) => handleFieldChange('email', v)}
              editable={isEditing}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <PickerRow
            label="Currency"
            value={currentValue('currency')}
            pickerType="currency"
          />

          <PickerRow
            label="Timezone"
            value={currentValue('timezone')}
            pickerType="timezone"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Street Address</Text>
            <TextInput
              style={styles.input}
              value={settings.address.street}
              onChangeText={(v) => handleFieldChange('address', { ...settings.address, street: v })}
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
                onChangeText={(v) => handleFieldChange('address', { ...settings.address, city: v })}
                editable={isEditing}
                placeholder="City"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Postal Code</Text>
              <TextInput
                style={styles.input}
                value={settings.address.postalCode}
                onChangeText={(v) => handleFieldChange('address', { ...settings.address, postalCode: v })}
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
              onChangeText={(v) => handleFieldChange('address', { ...settings.address, country: v })}
              editable={isEditing}
              placeholder="Country"
            />
          </View>
        </View>
      </View>
    );
  };

  const renderReceiptSettings = () => {
    if (!storeSettings) return null;
    const receiptSettings = { ...storeSettings.receiptSettings, ...editedSettings.receiptSettings };

    return (
      <View style={styles.sectionContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipt Header & Footer</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Header Text</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={receiptSettings.headerText}
              onChangeText={(v) => handleReceiptFieldChange('headerText', v)}
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
              onChangeText={(v) => handleReceiptFieldChange('footerText', v)}
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
              onValueChange={(v) => handleReceiptFieldChange('showLogo', v)}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show Tax Breakdown</Text>
            <Switch
              value={receiptSettings.showTaxBreakdown}
              onValueChange={(v) => handleReceiptFieldChange('showTaxBreakdown', v)}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show Loyalty Points</Text>
            <Switch
              value={receiptSettings.showLoyaltyPoints}
              onValueChange={(v) => handleReceiptFieldChange('showLoyaltyPoints', v)}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show QR Code</Text>
            <Switch
              value={receiptSettings.showQRCode}
              onValueChange={(v) => handleReceiptFieldChange('showQRCode', v)}
              disabled={!isEditing}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Receipt Format</Text>

          <PickerRow
            label="Paper Size"
            value={currentReceiptValue('paperSize')}
            pickerType="paperSize"
          />

          <PickerRow
            label="Font Size"
            value={currentReceiptValue('fontSize')}
            pickerType="fontSize"
          />
        </View>
      </View>
    );
  };

  const renderTaxSettings = () => {
    if (!storeSettings) return null;
    const taxSettings = { ...storeSettings.taxSettings, ...editedSettings.taxSettings };

    return (
      <View style={styles.sectionContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Configuration</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Default Tax Rate (%)</Text>
            <TextInput
              style={styles.input}
              value={taxSettings.defaultTaxRate.toString()}
              onChangeText={(v) => handleTaxFieldChange('defaultTaxRate', parseFloat(v) || 0)}
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
              onChangeText={(v) => handleTaxFieldChange('taxName', v)}
              editable={isEditing}
              placeholder="e.g., VAT, Sales Tax"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tax Number</Text>
            <TextInput
              style={styles.input}
              value={taxSettings.taxNumber || ''}
              onChangeText={(v) => handleTaxFieldChange('taxNumber', v)}
              editable={isEditing}
              placeholder="Enter tax registration number"
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Tax Inclusive Pricing</Text>
            <Switch
              value={taxSettings.taxInclusive}
              onValueChange={(v) => handleTaxFieldChange('taxInclusive', v)}
              disabled={!isEditing}
            />
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Show Tax on Receipt</Text>
            <Switch
              value={taxSettings.showTaxOnReceipt}
              onValueChange={(v) => handleTaxFieldChange('showTaxOnReceipt', v)}
              disabled={!isEditing}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderBusinessHours = () => {
    if (!storeSettings) return null;
    const settings = { ...storeSettings, ...editedSettings };
    const businessHours = settings.businessHours || storeSettings.businessHours || {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return (
      <View style={styles.sectionContent}>
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
                    onValueChange={(v) => {
                      const newHours = { ...(businessHours || {}), [day]: { ...dayHours, isOpen: v } };
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
                        onChangeText={(v) => {
                          const newHours = { ...(businessHours || {}), [day]: { ...dayHours, openTime: v } };
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
                        onChangeText={(v) => {
                          const newHours = { ...(businessHours || {}), [day]: { ...dayHours, closeTime: v } };
                          handleFieldChange('businessHours', newHours);
                        }}
                        editable={isEditing}
                        placeholder="17:00"
                      />
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Break Start</Text>
                      <TextInput
                        style={styles.timeInputField}
                        value={dayHours.breakStart || ''}
                        onChangeText={(v) => {
                          const newHours = { ...(businessHours || {}), [day]: { ...dayHours, breakStart: v || undefined } };
                          handleFieldChange('businessHours', newHours);
                        }}
                        editable={isEditing}
                        placeholder="optional"
                      />
                    </View>
                    <View style={styles.timeInput}>
                      <Text style={styles.timeLabel}>Break End</Text>
                      <TextInput
                        style={styles.timeInputField}
                        value={dayHours.breakEnd || ''}
                        onChangeText={(v) => {
                          const newHours = { ...(businessHours || {}), [day]: { ...dayHours, breakEnd: v || undefined } };
                          handleFieldChange('businessHours', newHours);
                        }}
                        editable={isEditing}
                        placeholder="optional"
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderFeatures = () => {
    if (!storeSettings) return null;
    const settings = { ...storeSettings, ...editedSettings };
    const features = settings.features || storeSettings.features;

    return (
      <View style={styles.sectionContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feature Toggles</Text>

          {([
            { key: 'loyaltyProgram', label: 'Loyalty Program', desc: 'Enable customer loyalty points and rewards' },
            { key: 'multiStore', label: 'Multi-Store Support', desc: 'Manage multiple store locations' },
            { key: 'advancedReports', label: 'Advanced Reports', desc: 'Access detailed analytics and insights' },
            { key: 'inventoryTracking', label: 'Inventory Tracking', desc: 'Track stock levels and low stock alerts' },
          ] as const).map(({ key, label, desc }) => (
            <View key={key} style={styles.switchGroup}>
              <View style={styles.featureInfo}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.featureDescription}>{desc}</Text>
              </View>
              <Switch
                value={features[key]}
                onValueChange={(v) => handleFieldChange('features', { ...features, [key]: v })}
                disabled={!isEditing}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ── Picker modal selection ────────────────────────────────────────────────

  const handlePickerSelect = (value: string) => {
    switch (picker.type) {
      case 'currency':
        handleFieldChange('currency', value);
        break;
      case 'timezone':
        handleFieldChange('timezone', value);
        break;
      case 'paperSize':
        handleReceiptFieldChange('paperSize', value);
        break;
      case 'fontSize':
        handleReceiptFieldChange('fontSize', value);
        break;
    }
  };

  const pickerConfig = (): { title: string; options: { value: string; label: string }[]; selected: string } => {
    switch (picker.type) {
      case 'currency':
        return { title: 'Select Currency', options: CURRENCIES, selected: currentValue('currency') };
      case 'timezone':
        return { title: 'Select Timezone', options: TIMEZONES, selected: currentValue('timezone') };
      case 'paperSize':
        return { title: 'Select Paper Size', options: PAPER_SIZES, selected: currentReceiptValue('paperSize') };
      case 'fontSize':
        return { title: 'Select Font Size', options: FONT_SIZES, selected: currentReceiptValue('fontSize') };
      default:
        return { title: '', options: [], selected: '' };
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  const { title: pTitle, options: pOptions, selected: pSelected } = pickerConfig();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Picker modal */}
      {picker.type !== null && (
        <PickerModal
          visible
          title={pTitle}
          options={pOptions}
          selected={pSelected}
          onSelect={handlePickerSelect}
          onClose={() => setPicker({ type: null })}
        />
      )}

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
              <Ionicons name="create-outline" size={24} color={theme.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {(['general', 'receipt', 'tax', 'hours', 'features'] as const).map((section) => (
            <TouchableOpacity
              key={section}
              style={[styles.tab, activeSection === section && styles.activeTab]}
              onPress={() => setActiveSection(section)}
            >
              <Text style={[styles.tabText, activeSection === section && styles.activeTabText]}>
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshSettings}
            colors={[theme.accent]}
            tintColor={theme.accent}
          />
        }
      >
        {/* User Profile */}
        <View style={styles.profileSection}>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person" size={32} color={theme.white} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.fullName || 'User'}</Text>
                <Text style={styles.profileEmail}>{user?.email || ''}</Text>
                <Text style={styles.profileRole}>{user?.role || 'Staff'}</Text>
              </View>
            </View>
          </View>
        </View>

        {activeSection === 'general' && renderGeneralSettings()}
        {activeSection === 'receipt' && renderReceiptSettings()}
        {activeSection === 'tax' && renderTaxSettings()}
        {activeSection === 'hours' && renderBusinessHours()}
        {activeSection === 'features' && renderFeatures()}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: typeof Colors.light) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.gray500,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
      backgroundColor: theme.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.text,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    editButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.gray100,
    },
    saveButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.primary,
    },
    saveButtonText: {
      color: theme.white,
      fontWeight: '600',
    },
    cancelButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.gray100,
    },
    cancelButtonText: {
      color: theme.gray500,
      fontWeight: '600',
    },
    tabContainer: {
      backgroundColor: theme.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabScroll: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    tab: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: {
      borderBottomColor: theme.accent,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.gray500,
    },
    activeTabText: {
      color: theme.accent,
    },
  content: {
    flex: 1,
  },
  sectionContent: {
    padding: 20,
  },
  section: {
    backgroundColor: theme.cardBg,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.gray700,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.cardBg,
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
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.cardBg,
  },
  pickerDisabled: {
    backgroundColor: theme.background,
  },
  pickerText: {
    fontSize: 16,
    color: theme.text,
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
    color: theme.gray500,
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
    color: theme.text,
  },
  timeInputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeInput: {
    flex: 1,
    minWidth: 80,
  },
  timeLabel: {
    fontSize: 12,
    color: theme.gray500,
    marginBottom: 4,
  },
  timeInputField: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.text,
    backgroundColor: theme.cardBg,
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  profileCard: {
    backgroundColor: theme.cardBg,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.accent,
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
    color: theme.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: theme.gray500,
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 13,
    color: theme.gray400,
    textTransform: 'capitalize',
  },
  });
}
