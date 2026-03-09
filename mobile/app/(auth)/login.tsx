import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useAuthStore } from '../../src/stores/authStore';
import { AuthStatus } from '../../src/types/auth';
import {
  getKnownUsers,
  getUserProfile,
  type UserProfile,
} from '../../src/services/authStorage';

interface KnownUser {
  userId: string;
  profile: UserProfile;
}

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // P7-01: Shared device user selector state
  const [knownUsers, setKnownUsers] = useState<KnownUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [loadingKnownUsers, setLoadingKnownUsers] = useState(true);

  const {
    login,
    offlineLogin,
    error,
    isLoading,
    clearError,
    isAuthenticated,
    authStatus,
    statusMessage,
    user,
  } = useAuthStore();

  // Navigate to main app after any successful authentication (online or offline)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);

  // P7-01: Load known users with their profiles for the shared device selector
  useEffect(() => {
    let cancelled = false;
    async function loadKnownUsers() {
      try {
        const ids = await getKnownUsers();
        const users: KnownUser[] = [];
        for (const id of ids) {
          const profile = await getUserProfile(id);
          if (profile) users.push({ userId: id, profile });
        }
        if (!cancelled) setKnownUsers(users);
      } catch {
        // Non-fatal — fall back to standard login form
      } finally {
        if (!cancelled) setLoadingKnownUsers(false);
      }
    }
    loadKnownUsers();
    return () => { cancelled = true; };
  }, []);

  // When a known user is selected in offline mode, keep their userId tracked
  const handleSelectUser = (ku: KnownUser) => {
    setSelectedUserId(ku.userId);
    setShowUserPicker(false);
    clearError();
    setPassword('');
  };

  // Offline mode: app started offline, user has prior session on this device.
  const isOfflineMode = authStatus === AuthStatus.OFFLINE_AUTHENTICATED;

  const handleOnlineLogin = async () => {
    try {
      await login(email, password, rememberMe);
    } catch (err) {
      console.error('[LOGIN_SCREEN] Online login error:', err instanceof Error ? err.message : String(err));
    }
  };

  const handleOfflineLogin = async () => {
    // Use explicitly selected user (picker) or fall back to the persisted user
    const targetUserId = selectedUserId ?? user?.userId;
    if (!targetUserId) return;
    try {
      await offlineLogin(targetUserId, password);
    } catch (err) {
      console.error('[LOGIN_SCREEN] Offline login error:', err instanceof Error ? err.message : String(err));
    }
  };

  // Resolve display identity for the offline form header
  const offlineUser: { email: string; fullName: string } | null =
    selectedUserId
      ? knownUsers.find((ku) => ku.userId === selectedUserId)?.profile ?? null
      : user
      ? { email: user.email, fullName: user.fullName }
      : null;

  // ── Offline login UI ──────────────────────────────────────────────────────────
  if (isOfflineMode) {
    // P7-02: "This device hasn't been set up for your account yet" — shown when
    // there are no known users at all (no prior auth on this device).
    if (!loadingKnownUsers && knownUsers.length === 0 && !user) {
      return (
        <ThemedView style={styles.container}>
          <ThemedText type="title" style={styles.title}>Offline Sign In</ThemedText>
          <ThemedText style={[styles.offlineInfo, { color: theme.gray500 }]}>
            This device hasn&apos;t been set up for your account yet.
            Please sign in online first.
          </ThemedText>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Offline Sign In
        </ThemedText>

        <ThemedText style={[styles.offlineInfo, { color: theme.gray500 }]}>
          You&apos;re offline. Enter your password to access your saved session.
        </ThemedText>

        {statusMessage ? (
          <ThemedText style={[styles.statusMessage, { color: theme.warning }]}>{statusMessage}</ThemedText>
        ) : null}

        {/* P7-01: User selector — shown when multiple known users exist */}
        {!loadingKnownUsers && knownUsers.length > 1 ? (
          <TouchableOpacity
            style={[styles.input, styles.userSelectorButton, { borderColor: theme.border, backgroundColor: theme.cardBg }]}
            onPress={() => setShowUserPicker(true)}
          >
            <ThemedText style={[styles.userSelectorText, { color: theme.text }]}>
              {offlineUser?.email ?? 'Select account...'}
            </ThemedText>
            <Ionicons name="chevron-down" size={16} color={theme.gray500} />
          </TouchableOpacity>
        ) : (
          /* Single known user — read-only identity display */
          <View style={[styles.input, styles.readonlyInput, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
            <ThemedText style={[styles.readonlyText, { color: theme.gray600 }]}>
              {offlineUser?.email ?? user?.email ?? ''}
            </ThemedText>
          </View>
        )}

        {error ? (
          <ThemedText style={[styles.error, { color: theme.error }]}>{error}</ThemedText>
        ) : null}

        <TextInput
          style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardBg, color: theme.text }]}
          placeholderTextColor={theme.gray400}
          placeholder="Password"
          value={password}
          onChangeText={(v) => {
            clearError();
            setPassword(v);
          }}
          secureTextEntry
          autoFocus={knownUsers.length <= 1}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleOfflineLogin}
          disabled={isLoading || !password || (!selectedUserId && !user?.userId)}
        >
          <ThemedText style={[styles.buttonText, { color: theme.white }]}>
            {isLoading ? 'Verifying...' : 'Continue Offline'}
          </ThemedText>
        </TouchableOpacity>

        <ThemedText style={[styles.offlineFootnote, { color: theme.gray500 }]}>
          Offline access is limited to previously cached data.
          Connect to the internet to sync the latest changes.
        </ThemedText>

        {/* P7-01: User picker modal */}
        <Modal
          visible={showUserPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUserPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowUserPicker(false)}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
              <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
                Select Account
              </ThemedText>
              <FlatList
                data={knownUsers}
                keyExtractor={(item) => item.userId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => handleSelectUser(item)}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: theme.primary }]}>
                      <ThemedText style={[styles.userAvatarText, { color: theme.white }]}>
                        {item.profile.fullName.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={styles.userInfo}>
                      <ThemedText type="defaultSemiBold">{item.profile.fullName}</ThemedText>
                      <ThemedText style={[styles.userEmail, { color: theme.gray500 }]}>{item.profile.email}</ThemedText>
                    </View>
                    {selectedUserId === item.userId && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </ThemedView>
    );
  }

  // ── Standard online login UI ──────────────────────────────────────────────────

  // Show context-aware banner when redirected from expired / invalidated state
  const contextBanner =
    authStatus === AuthStatus.SESSION_EXPIRED || authStatus === AuthStatus.INVALIDATED
      ? statusMessage
      : null;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Welcome Back
      </ThemedText>

      {contextBanner ? (
        <ThemedText style={[styles.statusMessage, { color: theme.warning }]}>{contextBanner}</ThemedText>
      ) : null}

      {error ? (
        <ThemedText style={[styles.error, { color: theme.error }]}>{error}</ThemedText>
      ) : null}

      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardBg, color: theme.text }]}
        placeholderTextColor={theme.gray400}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardBg, color: theme.text }]}
        placeholderTextColor={theme.gray400}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={handleOnlineLogin}
        disabled={isLoading}
      >
        <ThemedText style={[styles.buttonText, { color: theme.white }]}>
          {isLoading ? 'Logging in...' : 'Login'}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.rememberMeContainer}
        onPress={() => setRememberMe(!rememberMe)}
      >
        <View style={[styles.checkbox, { borderColor: theme.primary }, rememberMe && { backgroundColor: theme.primary }]} />
        <ThemedText>Remember me</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          clearError();
          router.push('/(auth)/forgot-password' as any);
        }}
      >
        <ThemedText type="link" style={styles.forgotPassword}>
          Forgot password?
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          clearError();
          router.push('/register');
        }}
      >
        <ThemedText type="link" style={styles.registerLink}>
          Don&apos;t have an account? Register here
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  offlineInfo: {
    textAlign: 'center',
    marginBottom: 16,
  },
  offlineFootnote: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
  },
  statusMessage: {
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  readonlyInput: {
    justifyContent: 'center',
  },
  readonlyText: {},
  userSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userSelectorText: {},
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 10,
  },
  forgotPassword: {
    marginBottom: 10,
    textAlign: 'center',
  },
  registerLink: {
    marginTop: 20,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    maxHeight: 400,
  },
  modalTitle: {
    marginBottom: 16,
    fontSize: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontWeight: '700',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  separator: {
    height: 1,
  },
});
