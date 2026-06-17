import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useAuthStore } from '../../src/stores/authStore';
import Constants from 'expo-constants';

interface MenuOption {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
}

export default function MoreScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user, logout } = useAuthStore();

  const menuOptions: MenuOption[] = [
    {
      id: 'customers',
      title: 'Customers',
      subtitle: 'Manage customer information',
      icon: 'people',
      route: '/(tabs)/customers',
      color: theme.primary,
    },
    {
      id: 'categories',
      title: 'Categories',
      subtitle: 'Organise products into categories',
      icon: 'pricetags',
      route: '/categories',
      color: theme.primaryVariant,
    },
    {
      id: 'reports',
      title: 'Reports',
      subtitle: 'View sales analytics and insights',
      icon: 'bar-chart',
      route: '/(tabs)/reports',
      color: theme.warning,
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'Configure store and app settings',
      icon: 'settings',
      route: '/(tabs)/settings',
      color: theme.accent,
    },
  ];

  const handleOptionPress = (route: string) => {
    router.push(route as any);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            More
          </ThemedText>
          {user && (
            <View style={styles.userInfo}>
              <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                <Ionicons name="person" size={24} color={theme.white} />
              </View>
              <View style={styles.userDetails}>
                <ThemedText style={styles.userName}>{user.fullName}</ThemedText>
                <ThemedText style={styles.userRole}>{user.role}</ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          {menuOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.menuOption,
                { backgroundColor: theme.cardBg, borderBottomColor: theme.border },
                index === 0 && styles.firstOption,
                index === menuOptions.length - 1 && styles.lastOption,
              ]}
              onPress={() => handleOptionPress(option.route)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${option.color}15` }]}>
                <Ionicons name={option.icon} size={24} color={option.color} />
              </View>
              <View style={styles.optionContent}>
                <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
                <ThemedText style={styles.optionSubtitle}>{option.subtitle}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.gray400} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: theme.cardBg }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={[styles.logoutIconContainer, { backgroundColor: theme.errorBg }]}>
              <Ionicons name="log-out" size={24} color={theme.error} />
            </View>
            <ThemedText style={[styles.logoutText, { color: theme.error }]}>Logout</ThemedText>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <ThemedText style={styles.appInfoText}>
            HandeePOS v{Constants.expoConfig?.version || '1.0.0'}
          </ThemedText>
          <ThemedText style={styles.appInfoSubtext}>
            Built with Expo
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
  },
  title: {
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 14,
    opacity: 0.6,
    textTransform: 'capitalize',
  },
  menuSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    minHeight: 72,
  },
  firstOption: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  lastOption: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  appInfo: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  appInfoText: {
    fontSize: 13,
    opacity: 0.5,
    marginBottom: 4,
  },
  appInfoSubtext: {
    fontSize: 12,
    opacity: 0.4,
  },
  logoutSection: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF3B3015',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
});

