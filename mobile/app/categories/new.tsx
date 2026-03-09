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
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../../src/stores/productStore';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

export default function NewCategoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const { createCategory, isLoading, error, clearError } = useProductStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  const validate = () => {
    if (!name.trim()) {
      setNameError('Category name is required');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      await createCategory({ name: name.trim(), description: description.trim() || undefined });
      Alert.alert('Success', 'Category created successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      // error shown via useEffect
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>New Category</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: isLoading ? theme.gray300 : theme.primary }]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.cardBg, ...Shadows.sm }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.gray700 }]}>Name *</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.inputBg, borderColor: nameError ? theme.error : theme.border, color: theme.text },
              ]}
              value={name}
              onChangeText={(t) => { setName(t); if (nameError) setNameError(''); }}
              placeholder="e.g. Clothing, Electronics"
              placeholderTextColor={theme.gray400}
              autoFocus
            />
            {nameError ? <Text style={[styles.errorText, { color: theme.error }]}>{nameError}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.gray700 }]}>Description</Text>
            <TextInput
              style={[
                styles.input,
                styles.textarea,
                { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              placeholderTextColor={theme.gray400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  backBtn: { padding: Spacing.xs, marginRight: Spacing.sm },
  title: {
    flex: 1,
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
  },
  saveBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 64,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: Typography.sizes.md },
  content: { flex: 1, padding: Spacing.lg },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  field: { marginBottom: Spacing.lg },
  label: { fontSize: Typography.sizes.sm, fontWeight: '500', marginBottom: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    fontSize: Typography.sizes.md,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  errorText: { fontSize: Typography.sizes.xs, marginTop: 4 },
});
