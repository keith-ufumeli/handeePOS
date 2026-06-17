/**
 * authStore.ts — Auth state machine
 *
 * Single source of truth for all authentication state.
 * Every UI screen derives its behaviour from `authStatus` (AuthStatus enum).
 *
 * Persistence:
 *   - `user`        → AsyncStorage (non-sensitive profile data only)
 *   - tokens        → per-user Secure Store via authStorage (P3)
 *   - `authStatus`  → NOT persisted; derived on every app start by initialize()
 *   - `isAuthenticated` → derived from authStatus + _sessionOCT; NOT persisted
 *
 * Token lifecycle:
 *   - Access token  → in-memory only (apiService.authToken)
 *   - Refresh token → per-user Secure Store; apiService holds in-memory copy
 *   - OCT           → per-user Secure Store (encrypted with PBKDF2+AES-GCM)
 *                     + in-memory plaintext for the current online session
 *
 * isAuthenticated rules:
 *   - ONLINE_AUTHENTICATED              → true (active server-validated session)
 *   - PENDING_SYNC                      → true (mid-sync; keep user in app)
 *   - OFFLINE_AUTHENTICATED + _sessionOCT non-null → true (active offline session)
 *   - OFFLINE_AUTHENTICATED + _sessionOCT null     → false (needs offline re-auth)
 *   - SESSION_EXPIRED / INVALIDATED / UNAUTHENTICATED → false
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import { decodeJWT, extractStoreIdFromToken } from '../utils/jwtDecoder';
import { getOrCreateDeviceId } from '../utils/deviceId';
import { AuthStatus, AuthUser } from '../types/auth';
import {
  addKnownUser,
  setUserRefreshToken,
  setUserOfflineToken,
  setUserOfflineSalt,
  setUserLastOnlineAuth,
  setUserProfile,
  getUserProfile,
  clearUserSession,
  getUserRefreshToken,
  hasUserPriorAuth,
  resetUserOfflineAttempts,
  // P6 — offline login
  isUserOfflineLocked,
  getUserOfflineLockUntil,
  setUserOfflineLockUntil,
  getUserOfflineToken,
  getUserOfflineSalt,
  getUserOfflineAttempts,
  incrementUserOfflineAttempts,
  clearUserOfflineLock,
} from '../services/authStorage';
import { generateSalt, encryptOCT, decryptOCT, isCryptoAvailable, verifyOCTSignature } from '../services/cryptoService';
import networkMonitor from '../services/networkMonitor';

// ─── Backward-compatible alias ─────────────────────────────────────────────────
// Existing screens that import `User` from authStore continue to work.
export type User = AuthUser;

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_OFFLINE_ATTEMPTS = 5;

// ─── State & Actions ──────────────────────────────────────────────────────────

interface AuthStoreState {
  authStatus: AuthStatus;
  /**
   * True when the user has an active, usable session.
   * Derived from authStatus + _sessionOCT — kept in state so existing screens
   * that destructure `isAuthenticated` continue to work without changes.
   *
   * Computation: see computeIsAuthenticated() below.
   */
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  isHydrated: boolean;
  /** Short context-aware message for UX display (P7). null = no message. */
  statusMessage: string | null;
  error: string | null;
  /**
   * In-memory plaintext OCT for the current session.
   * Populated on online login, on background refresh, and on successful offline login.
   * NOT persisted — lost on app kill (intentional).
   * When non-null with OFFLINE_AUTHENTICATED → isAuthenticated is true.
   */
  _sessionOCT: string | null;
}

interface AuthStoreActions {
  /** Full online login flow. Requires internet. */
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  /**
   * Offline login using the encrypted OCT stored from the last online session.
   * Validates device binding, OCT TTL, and enforces exponential-backoff lockout.
   * Requires no network connection. Fails gracefully if OCT has expired.
   */
  offlineLogin: (userId: string, password: string) => Promise<void>;
  /** Log out from the current device. Clears all per-user session data. */
  logout: () => Promise<void>;
  /**
   * Called by networkMonitor when connectivity is restored.
   * Transitions OFFLINE_AUTHENTICATED → PENDING_SYNC → validates → ONLINE_AUTHENTICATED | INVALIDATED.
   */
  handleOnline: () => Promise<void>;
  /**
   * Called by networkMonitor when connectivity is lost.
   * Transitions ONLINE_AUTHENTICATED → OFFLINE_AUTHENTICATED.
   */
  handleOffline: () => void;
  /** Internal: move to a new auth state, optionally with a UX message. */
  transitionTo: (status: AuthStatus, message?: string | null) => void;
  setStatusMessage: (msg: string | null) => void;
  clearError: () => void;
  /**
   * Called once after Zustand rehydration.
   * Restores the session from stored tokens or determines the correct initial state.
   */
  initialize: () => Promise<void>;
}

export type AuthState = AuthStoreState & AuthStoreActions;

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Computes the `isAuthenticated` boolean from an auth status + current OCT.
 *
 * The OCT check for OFFLINE_AUTHENTICATED distinguishes:
 *   - Active offline session (OCT in memory → true)
 *   - App restarted while offline, password not yet entered (null → false)
 */
function computeIsAuthenticated(status: AuthStatus, sessionOCT: string | null): boolean {
  if (status === AuthStatus.ONLINE_AUTHENTICATED) return true;
  if (status === AuthStatus.PENDING_SYNC) return true;
  if (status === AuthStatus.OFFLINE_AUTHENTICATED) return sessionOCT !== null;
  return false;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      authStatus: AuthStatus.UNAUTHENTICATED,
      isAuthenticated: false,
      user: null,
      isLoading: false,
      isHydrated: false,
      statusMessage: null,
      error: null,
      _sessionOCT: null,

      // ─── transitionTo ────────────────────────────────────────────────────────

      transitionTo(status, message = null) {
        const { _sessionOCT, user } = get();
        const isAuthenticated = computeIsAuthenticated(status, _sessionOCT);
        console.log(
          `[AUTH_STORE] Transition → ${status} (isAuthenticated=${isAuthenticated})`,
          message ? `(${message})` : ''
        );

        // P8-03: Wipe all per-user Secure Store data on server-side revocation.
        // Fire-and-forget — UI transition must not block on storage I/O.
        if (status === AuthStatus.INVALIDATED && user?.userId) {
          clearUserSession(user.userId).catch((err) =>
            console.warn('[AUTH_STORE] Failed to clear session on INVALIDATED:', err)
          );
        }

        set({ authStatus: status, isAuthenticated, statusMessage: message, isLoading: false });
      },

      setStatusMessage(msg) {
        set({ statusMessage: msg });
      },

      clearError() {
        set({ error: null });
      },

      // ─── login ───────────────────────────────────────────────────────────────

      login: async (email, password, rememberMe = false) => {
        console.log('[AUTH_STORE] Login initiated', { email, rememberMe });
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.login(email, password, rememberMe);

          if (!response.success) {
            set({ error: response.message || 'Login failed', isLoading: false });
            return;
          }

          const { user: rawUser, tokens } = response.data;
          const { accessToken, refreshToken, offlineCapabilityToken } = tokens;

          // ── 1. Extract storeId (JWT is the source of truth) ──────────────────
          let storeId = '';
          if (accessToken) {
            storeId = extractStoreIdFromToken(accessToken) ?? '';
          }
          if (!storeId && rawUser?.storeId) {
            storeId = resolveStoreId(rawUser.storeId);
          }
          if (storeId && !/^[0-9a-fA-F]{24}$/.test(storeId)) {
            console.warn('[AUTH_STORE] Invalid storeId format — clearing', storeId);
            storeId = '';
          }

          const mappedUser: AuthUser = {
            userId: rawUser.id,
            email: rawUser.email,
            fullName: rawUser.fullName,
            role: rawUser.role,
            storeId,
            permissions: rawUser.permissions ?? [],
          };

          // ── 2. Store tokens in per-user authStorage (Secure Store) ────────────
          await addKnownUser(mappedUser.userId);
          await setUserProfile(mappedUser.userId, {
            email: mappedUser.email,
            fullName: mappedUser.fullName,
          });
          await setUserRefreshToken(mappedUser.userId, refreshToken);
          await setUserLastOnlineAuth(mappedUser.userId, new Date().toISOString());
          await resetUserOfflineAttempts(mappedUser.userId);

          // ── 3. Encrypt & store OCT (if server issued one and crypto available) ─
          if (offlineCapabilityToken && isCryptoAvailable()) {
            try {
              const salt = generateSalt();
              const encryptedOCT = await encryptOCT(offlineCapabilityToken, password, salt);
              await setUserOfflineSalt(mappedUser.userId, salt);
              await setUserOfflineToken(mappedUser.userId, encryptedOCT);
              console.log('[AUTH_STORE] OCT encrypted and stored');
            } catch (octError) {
              console.warn('[AUTH_STORE] OCT encryption failed — offline login unavailable:', octError);
            }
          } else if (!offlineCapabilityToken) {
            console.warn('[AUTH_STORE] Server did not issue OCT — offline login unavailable (check JWT_DEVICE_SECRET)');
          } else {
            console.warn('[AUTH_STORE] Web Crypto unavailable — OCT not stored');
          }

          // ── 4. Set in-memory tokens on apiService ────────────────────────────
          await apiService.setAuthToken(accessToken, refreshToken);

          // ── 5. Start background refresh timer ─────────────────────────────────
          apiService.startRefreshTimer();

          // ── 6. Update store state ──────────────────────────────────────────────
          set({
            user: mappedUser,
            authStatus: AuthStatus.ONLINE_AUTHENTICATED,
            isAuthenticated: true,
            _sessionOCT: offlineCapabilityToken ?? null,
            isLoading: false,
            error: null,
          });

          console.log('[AUTH_STORE] Login successful', { userId: mappedUser.userId, role: mappedUser.role });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          console.error('[AUTH_STORE] Login error:', message);
          set({ error: message, isLoading: false });
        }
      },

      // ─── offlineLogin ─────────────────────────────────────────────────────────

      offlineLogin: async (userId, password) => {
        console.log('[AUTH_STORE] Offline login initiated for userId:', userId);
        set({ isLoading: true, error: null });

        try {
          // ── 1. Lockout check ──────────────────────────────────────────────────
          const locked = await isUserOfflineLocked(userId);
          if (locked) {
            const lockUntil = await getUserOfflineLockUntil(userId);
            const remainingMs = lockUntil ? new Date(lockUntil).getTime() - Date.now() : 0;
            const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
            const waitMsg =
              remainingSec >= 60
                ? `${Math.ceil(remainingSec / 60)} minute(s)`
                : `${remainingSec} second(s)`;
            set({
              error: `Too many failed attempts. Please try again in ${waitMsg}.`,
              isLoading: false,
            });
            return;
          }

          // ── 2. Attempt gate ───────────────────────────────────────────────────
          const attempts = await getUserOfflineAttempts(userId);
          if (attempts >= MAX_OFFLINE_ATTEMPTS) {
            // Hard cap — shouldn't be reachable if lockout check above is working,
            // but guard in case the lock_until key was cleared externally.
            get().transitionTo(
              AuthStatus.SESSION_EXPIRED,
              'Maximum offline login attempts reached. Please connect to the internet to sign in.'
            );
            return;
          }

          // ── 3. Retrieve encrypted OCT and salt ───────────────────────────────
          const encryptedOCT = await getUserOfflineToken(userId);
          const salt = await getUserOfflineSalt(userId);

          if (!encryptedOCT || !salt) {
            set({
              error: 'Offline login is not available. Please connect to the internet to sign in.',
              isLoading: false,
            });
            return;
          }

          // ── 4. Decrypt OCT — wrong password throws here ───────────────────────
          let decryptedOCT: string;
          try {
            decryptedOCT = await decryptOCT(encryptedOCT, password, salt);
          } catch {
            // AES-GCM auth-tag mismatch → wrong password (or corrupted data)
            const newAttempts = await incrementUserOfflineAttempts(userId);

            if (newAttempts >= MAX_OFFLINE_ATTEMPTS) {
              // 5th failure → force online re-auth
              get().transitionTo(
                AuthStatus.SESSION_EXPIRED,
                'Maximum offline login attempts reached. Please connect to the internet to sign in.'
              );
              return;
            }

            // Apply exponential-backoff lockout
            if (newAttempts === 4) {
              const lockUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
              await setUserOfflineLockUntil(userId, lockUntil);
              set({
                error: `Incorrect password. Locked for 2 minutes. ${MAX_OFFLINE_ATTEMPTS - newAttempts} attempt(s) remaining.`,
                isLoading: false,
              });
            } else if (newAttempts === 3) {
              const lockUntil = new Date(Date.now() + 30 * 1000).toISOString();
              await setUserOfflineLockUntil(userId, lockUntil);
              set({
                error: `Incorrect password. Locked for 30 seconds. ${MAX_OFFLINE_ATTEMPTS - newAttempts} attempt(s) remaining.`,
                isLoading: false,
              });
            } else {
              set({
                error: `Incorrect password. ${MAX_OFFLINE_ATTEMPTS - newAttempts} attempt(s) remaining.`,
                isLoading: false,
              });
            }
            return;
          }

          // ── 5. Decode OCT payload ─────────────────────────────────────────────
          const octPayload = decodeJWT(decryptedOCT);

          if (!octPayload) {
            set({
              error: 'Session data is corrupted. Please connect to the internet to sign in.',
              isLoading: false,
            });
            return;
          }

          // ── 5a. TTL check ─────────────────────────────────────────────────────
          const nowSeconds = Math.floor(Date.now() / 1000);
          if (octPayload.exp !== undefined && octPayload.exp < nowSeconds) {
            get().transitionTo(
              AuthStatus.SESSION_EXPIRED,
              'Your offline session has expired. Please connect to the internet to sign in.'
            );
            return;
          }

          // ── 5b. Device binding check ──────────────────────────────────────────
          if (octPayload.deviceId) {
            const currentDeviceId = await getOrCreateDeviceId();
            if (octPayload.deviceId !== currentDeviceId) {
              console.warn('[AUTH_STORE] OCT device binding mismatch', {
                oct: octPayload.deviceId,
                device: currentDeviceId,
              });
              get().transitionTo(
                AuthStatus.INVALIDATED,
                'This session is not valid for this device. Please sign in online.'
              );
              return;
            }
          }

          // ── 5c. P8-02: ECDSA signature verification ───────────────────────────
          // Verifies the OCT was issued by our server using the embedded public key.
          // Returns true when no key is embedded (soft pass — backward compat).
          const sigValid = await verifyOCTSignature(decryptedOCT);
          if (!sigValid) {
            console.error('[AUTH_STORE] OCT signature invalid — token tampered or wrong key');
            get().transitionTo(
              AuthStatus.INVALIDATED,
              'Session token is invalid. Please sign in again.'
            );
            return;
          }

          // ── 6. Success ────────────────────────────────────────────────────────
          await resetUserOfflineAttempts(userId);
          await clearUserOfflineLock(userId);

          // P7-05: Warn if OCT expires in less than 2 hours.
          let expiryWarning: string | null = null;
          if (octPayload.exp !== undefined) {
            const twoHoursFromNow = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
            if (octPayload.exp < twoHoursFromNow) {
              expiryWarning =
                'Your offline session expires in less than 2 hours. Connect to extend it.';
            }
          }

          // If a different user was selected via the shared device picker,
          // update the store's `user` so downstream code (including P8-03
          // clearUserSession in transitionTo) operates on the correct userId.
          const currentUser = get().user;
          if (!currentUser || currentUser.userId !== userId) {
            const profile = await getUserProfile(userId);
            if (profile) {
              set({
                user: {
                  userId,
                  email: profile.email,
                  fullName: profile.fullName,
                  role: octPayload.role ?? currentUser?.role ?? '',
                  storeId: octPayload.storeId ?? currentUser?.storeId ?? '',
                  permissions: octPayload.permissions ?? currentUser?.permissions ?? [],
                },
              });
            }
          }

          // Place decrypted OCT in memory — this makes isAuthenticated true when
          // transitionTo(OFFLINE_AUTHENTICATED) is called below.
          set({ _sessionOCT: decryptedOCT });
          get().transitionTo(AuthStatus.OFFLINE_AUTHENTICATED, expiryWarning);

          console.log('[AUTH_STORE] Offline login successful for userId:', userId);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Offline login failed';
          console.error('[AUTH_STORE] Offline login error:', message);
          set({ error: message, isLoading: false });
        }
      },

      // ─── logout ──────────────────────────────────────────────────────────────

      logout: async () => {
        console.log('[AUTH_STORE] Logout initiated');
        set({ isLoading: true });

        const { user } = get();

        // Stop background refresh
        apiService.stopRefreshTimer();

        // Tell the backend to revoke this refresh token (best-effort)
        try {
          await apiService.logout();
        } catch (error) {
          console.warn('[AUTH_STORE] Backend logout failed (continuing local logout):', error);
        }

        // Clear per-user Secure Store data
        if (user?.userId) {
          try {
            await clearUserSession(user.userId);
          } catch (error) {
            console.warn('[AUTH_STORE] Failed to clear user session from storage:', error);
          }
        }

        // Clear in-memory tokens
        await apiService.setAuthToken('', '');

        // Stop network monitoring — will restart on next initialize()
        networkMonitor.stop();

        set({
          user: null,
          authStatus: AuthStatus.UNAUTHENTICATED,
          isAuthenticated: false,
          _sessionOCT: null,
          isLoading: false,
          error: null,
          statusMessage: null,
        });
      },

      // ─── handleOffline ────────────────────────────────────────────────────────

      handleOffline: () => {
        const { authStatus, user } = get();

        if (authStatus !== AuthStatus.ONLINE_AUTHENTICATED) return;

        console.log('[AUTH_STORE] Network lost — transitioning to OFFLINE_AUTHENTICATED');

        // Stop refresh timer — no network, no point refreshing
        apiService.stopRefreshTimer();

        // _sessionOCT is non-null here (set during login/refresh), so
        // transitionTo will compute isAuthenticated: true — user stays in tabs.
        get().transitionTo(
          AuthStatus.OFFLINE_AUTHENTICATED,
          user ? null : 'No active user session'
        );
      },

      // ─── handleOnline ─────────────────────────────────────────────────────────

      handleOnline: async () => {
        const { authStatus, user } = get();

        if (authStatus !== AuthStatus.OFFLINE_AUTHENTICATED) return;

        console.log('[AUTH_STORE] Network restored — starting PENDING_SYNC');
        get().transitionTo(AuthStatus.PENDING_SYNC, null);

        try {
          // Attempt token refresh — this validates the refresh token server-side.
          // If the account was revoked while offline, the server returns 401.
          const response = await apiService.refreshAuthToken();

          if (response.success && response.data?.accessToken) {
            // Persist rotated refresh token to per-user authStorage
            if (user?.userId && response.data.refreshToken) {
              await setUserRefreshToken(user.userId, response.data.refreshToken);
              await setUserLastOnlineAuth(user.userId, new Date().toISOString());
            }

            // Store new in-memory OCT
            const newOCT: string | undefined = response.data.offlineCapabilityToken;
            if (newOCT) {
              set({ _sessionOCT: newOCT });
            }

            // Restart background refresh
            apiService.startRefreshTimer();

            get().transitionTo(AuthStatus.ONLINE_AUTHENTICATED, null);
            console.log('[AUTH_STORE] PENDING_SYNC resolved → ONLINE_AUTHENTICATED');
          } else {
            get().transitionTo(
              AuthStatus.SESSION_EXPIRED,
              'Your session has expired. Please sign in again.'
            );
          }
        } catch (error: any) {
          const msg = error instanceof Error ? error.message : String(error);
          const is401 =
            msg.includes('401') ||
            msg.toLowerCase().includes('unauthorized') ||
            msg.toLowerCase().includes('revoked');

          if (is401) {
            console.warn('[AUTH_STORE] PENDING_SYNC: account revoked → INVALIDATED');
            get().transitionTo(
              AuthStatus.INVALIDATED,
              'Your account access has changed. Please sign in again or contact your manager.'
              // Note: "detected on reconnect" variant per UX spec (vs. online detection below)
            );
          } else {
            // Network error — stay offline, try again on next reconnect
            console.warn('[AUTH_STORE] PENDING_SYNC: server unreachable, staying OFFLINE_AUTHENTICATED');
            get().transitionTo(
              AuthStatus.OFFLINE_AUTHENTICATED,
              "Couldn't verify with server. You can continue offline for now."
            );
          }
        }
      },

      // ─── initialize ───────────────────────────────────────────────────────────

      initialize: async () => {
        console.log('[AUTH_STORE] Initializing...');
        set({ isLoading: true });

        const { user } = get();

        if (!user?.userId) {
          console.log('[AUTH_STORE] No stored user — UNAUTHENTICATED');
          set({ authStatus: AuthStatus.UNAUTHENTICATED, isAuthenticated: false, isLoading: false });
          startNetworkMonitor();
          return;
        }

        const isOnline = await networkMonitor.isConnected();
        console.log('[AUTH_STORE] Network status on init:', isOnline ? 'online' : 'offline');

        if (isOnline) {
          // Try to restore session via stored refresh token
          try {
            const storedRefreshToken = await getUserRefreshToken(user.userId) ?? null;

            if (!storedRefreshToken && !apiService['refreshToken']) {
              console.log('[AUTH_STORE] No refresh token found → SESSION_EXPIRED');
              set({ authStatus: AuthStatus.SESSION_EXPIRED, isAuthenticated: false, isLoading: false });
              startNetworkMonitor();
              return;
            }

            // Set the refresh token in-memory so refreshAuthToken() can use it
            if (storedRefreshToken) {
              await apiService.setAuthToken('', storedRefreshToken);
            }

            const response = await apiService.refreshAuthToken();

            if (response.success && response.data?.accessToken) {
              // Persist rotated refresh token
              if (response.data.refreshToken) {
                await setUserRefreshToken(user.userId, response.data.refreshToken);
              }
              await setUserLastOnlineAuth(user.userId, new Date().toISOString());

              const newOCT: string | undefined = response.data.offlineCapabilityToken;
              if (newOCT) set({ _sessionOCT: newOCT });

              apiService.startRefreshTimer();
              set({
                authStatus: AuthStatus.ONLINE_AUTHENTICATED,
                isAuthenticated: true,
                isLoading: false,
              });
              console.log('[AUTH_STORE] Session restored → ONLINE_AUTHENTICATED');
            } else {
              set({ authStatus: AuthStatus.SESSION_EXPIRED, isAuthenticated: false, isLoading: false });
            }
          } catch (error: any) {
            const msg = error instanceof Error ? error.message : String(error);
            const is401 = msg.includes('401') || msg.toLowerCase().includes('unauthorized');
            if (is401) {
              // Route through transitionTo so P8-03 clearUserSession fires
              get().transitionTo(
                AuthStatus.INVALIDATED,
                'Your account access has been disabled. Please speak with your manager.'
              );
            } else {
              // Network error during init — fall to offline path
              const hasPrior = await hasUserPriorAuth(user.userId);
              // _sessionOCT is null at init time → isAuthenticated: false for OFFLINE_AUTHENTICATED
              set({
                authStatus: hasPrior
                  ? AuthStatus.OFFLINE_AUTHENTICATED
                  : AuthStatus.SESSION_EXPIRED,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          }
        } else {
          // Offline on startup — _sessionOCT is null → isAuthenticated: false
          const hasPrior = await hasUserPriorAuth(user.userId);
          if (hasPrior) {
            console.log('[AUTH_STORE] Offline with prior auth → OFFLINE_AUTHENTICATED (needs offline login)');
            set({ authStatus: AuthStatus.OFFLINE_AUTHENTICATED, isAuthenticated: false, isLoading: false });
          } else {
            console.log('[AUTH_STORE] Offline, no prior auth → UNAUTHENTICATED');
            set({
              authStatus: AuthStatus.UNAUTHENTICATED,
              isAuthenticated: false,
              user: null,
              isLoading: false,
            });
          }
        }

        startNetworkMonitor();
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the user profile — auth status is always derived from stored
      // artifacts at startup. Tokens are in Secure Store, not AsyncStorage.
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        console.log('[AUTH_STORE] Hydration complete');
        if (state) {
          state.isHydrated = true;
          // Kick off session restoration after hydration provides the user object.
          useAuthStore.getState().initialize();
        }
      },
    }
  )
);

// ─── Network monitor wiring ────────────────────────────────────────────────────

function startNetworkMonitor() {
  networkMonitor.start(
    () => useAuthStore.getState().handleOnline(),
    () => useAuthStore.getState().handleOffline()
  );
}

// ─── apiService callbacks ──────────────────────────────────────────────────────

// Called when the 401 auto-refresh or proactive refresh succeeds.
// Persists the rotated refresh token to per-user authStorage.
apiService.setTokenRefreshedCallback(async (newAccessToken, newRefreshToken, newOCT) => {
  const { user } = useAuthStore.getState();
  if (!user?.userId) return;

  try {
    await setUserRefreshToken(user.userId, newRefreshToken);
  } catch (err) {
    console.warn('[AUTH_STORE] Failed to persist rotated refresh token:', err);
  }

  if (newOCT) {
    useAuthStore.setState({ _sessionOCT: newOCT });
  }
});

// Called when the API service detects a 401 it cannot recover from.
apiService.setSessionExpiredCallback(() => {
  console.log('[AUTH_STORE] Session expired callback triggered');
  useAuthStore.getState().transitionTo(
    AuthStatus.SESSION_EXPIRED,
    'Your session has expired. Please sign in again.'
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize the storeId from various server response shapes. */
function resolveStoreId(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    if ('$oid' in raw) return String(raw.$oid);
    if ('_id' in raw) return String(raw._id);
    if (typeof raw.toString === 'function') return raw.toString();
    const match = JSON.stringify(raw).match(/"([0-9a-fA-F]{24})"/);
    if (match?.[1]) return match[1];
  }
  return String(raw);
}

// ─── Legacy export (kept for backward compatibility with existing screens) ──────

/**
 * @deprecated Use `useAuthStore(state => state.authStatus)` instead.
 * Kept so any direct callers continue to compile during migration.
 */
export const initializeAuth = async () => {
  // initialize() is now triggered automatically from onRehydrateStorage.
  console.log('[AUTH_STORE] initializeAuth() called — initialization is handled by onRehydrateStorage');
};
