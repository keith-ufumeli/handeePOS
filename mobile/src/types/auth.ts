/**
 * auth.ts — Auth state machine types
 *
 * All auth-related UI decisions derive from AuthStatus.
 * Nothing in the codebase should hardcode `isAuthenticated: boolean` checks
 * beyond the authStore itself — use `authStatus` instead.
 */

/**
 * The six states of the auth state machine.
 * See auth-redesign-plan.md § State Transition Map for full transition logic.
 */
export enum AuthStatus {
  /** No session exists on this device. First-time user or fully logged out. */
  UNAUTHENTICATED = 'UNAUTHENTICATED',

  /** Active session. Access + refresh tokens valid. Network available. */
  ONLINE_AUTHENTICATED = 'ONLINE_AUTHENTICATED',

  /**
   * Network unavailable. The OCT is valid and within its 24-hour TTL.
   * Prior online auth confirmed on this device.
   * User must enter password to proceed (handled in P6 offline login flow).
   */
  OFFLINE_AUTHENTICATED = 'OFFLINE_AUTHENTICATED',

  /**
   * OCT TTL exceeded OR refresh token expired. Network is required to
   * re-authenticate. Cannot proceed offline.
   */
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  /**
   * Server-side revocation detected: admin disabled the account, forced
   * logout, or a security event was flagged. Offline session cannot
   * override this — account is locked on reconnect.
   */
  INVALIDATED = 'INVALIDATED',

  /**
   * Transient state. Device has reconnected after an offline session.
   * Server validation (POST /auth/refresh-token) is in progress.
   * UI shows "Verifying your session…" — no action required from user.
   */
  PENDING_SYNC = 'PENDING_SYNC',
}

/** User profile stored in the auth store. Contains no secrets. */
export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  storeId: string;
  permissions: string[];
}
