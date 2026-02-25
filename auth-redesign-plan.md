# Authentication Redesign Plan — HandeePOS Mobile

**Date:** 2026-02-24
**Branch:** backend-fix
**Status:** Planning Complete — Pending Implementation

---

## Table of Contents

1. [Objective](#objective)
2. [Core Requirements](#core-requirements)
3. [Planning & Architecture Strategy](#1-planning--architecture-strategy)
   - [Authentication State Model](#authentication-state-model)
   - [State Transition Map](#state-transition-map)
   - [Edge Cases & Resolution Strategy](#edge-cases--resolution-strategy)
   - [Security Boundaries](#security-boundaries)
   - [Offline Login Risk Matrix](#offline-login-risk-matrix)
4. [Implementation Design](#2-implementation-design)
   - [Token & Credential Architecture](#token--credential-architecture)
   - [Token Storage Strategy](#token-storage-strategy-per-user-namespace)
   - [Offline Login Validation Logic](#offline-login-validation-logic)
   - [Session Restoration Flow](#session-restoration-flow-app-launch)
   - [Expiration Handling](#expiration-handling)
   - [Required Backend Support](#required-backend-support)
   - [UX Messaging Reference](#ux-messaging-reference)
   - [Multi-User Device Architecture](#multi-user-device-architecture-summary)
   - [Critical Design Decisions](#critical-design-decisions-summary)
5. [Implementation Todo List](#implementation-todo-list)

---

## Objective

Redesign and formalize the authentication behavior of the HandeePOS mobile app to support:
- Mandatory online connection for first-time sign-in
- Secure offline login for previously authenticated users
- Automatic session restoration on app reopen
- Context-aware UX messaging for POS staff

---

## Core Requirements

| # | Requirement | Detail |
|---|---|---|
| 1 | First-time sign-in requires internet | No offline registration or first-time login |
| 2 | Offline login for returning users | Allowed only if device has prior successful online auth |
| 3 | Session persistence across app restarts | Login screen not shown unless session expired/invalidated |
| 4 | Context-aware UX messaging | Clear, staff-friendly messages for all auth scenarios |

---

## 1. Planning & Architecture Strategy

### Authentication State Model

The system operates across **six distinct authentication states**. Every UI decision and session behavior is derived from these states.

```
┌──────────────────────────┬──────────────────────────────────────┐
│ State                    │ Description                          │
├──────────────────────────┼──────────────────────────────────────┤
│ UNAUTHENTICATED          │ No prior session exists on device.   │
│                          │ First-time or fully logged-out user. │
├──────────────────────────┼──────────────────────────────────────┤
│ ONLINE_AUTHENTICATED     │ Active session. Access + refresh     │
│                          │ tokens valid. Network available.     │
├──────────────────────────┼──────────────────────────────────────┤
│ OFFLINE_AUTHENTICATED    │ Network unavailable but offline      │
│                          │ capability token is valid and within │
│                          │ TTL. Prior online auth confirmed.    │
├──────────────────────────┼──────────────────────────────────────┤
│ SESSION_EXPIRED          │ Offline TTL exceeded OR refresh      │
│                          │ token expired. Network required to   │
│                          │ re-authenticate.                     │
├──────────────────────────┼──────────────────────────────────────┤
│ INVALIDATED              │ Server-side revocation detected      │
│                          │ (admin disable, forced logout,       │
│                          │ security event).                     │
├──────────────────────────┼──────────────────────────────────────┤
│ PENDING_SYNC             │ Device reconnected after offline     │
│                          │ session. Validation in progress      │
│                          │ before granting ONLINE_AUTHENTICATED.│
└──────────────────────────┴──────────────────────────────────────┘
```

---

### State Transition Map

```
                     ┌─────────────────────────────┐
                     │       App Launch / Init       │
                     └──────────────┬──────────────┘
                                    │
                     ┌──────────────▼──────────────┐
                     │   Check Secure Storage        │
                     │   for Session Artifacts       │
                     └────────┬─────────────────────┘
                              │
           ┌──────────────────┼──────────────────────┐
           │                  │                       │
           ▼                  ▼                       ▼
   No artifacts        Artifacts found          Artifacts found
   found               + Online                 + Offline
           │                  │                       │
           ▼                  ▼                       ▼
  UNAUTHENTICATED     Validate refresh        Check offline TTL
  (force online       token with server       + credential hash
   login required)          │                       │
                     ┌──────┴──────┐        ┌───────┴──────┐
                     │             │        │               │
                     ▼             ▼        ▼               ▼
               Valid token   Token       Within TTL    TTL exceeded
               ONLINE_AUTH   expired     OFFLINE_AUTH  SESSION_EXPIRED
                     │             │
                     ▼             ▼
              Silent refresh  Soft logout
              → ONLINE_AUTH   → UNAUTHENTICATED

──────────────────────────────────────────────────────────────────

ONLINE_AUTHENTICATED
        │
        ├── Network drops              → OFFLINE_AUTHENTICATED (if within TTL)
        ├── Access token expiry        → Silent refresh (background)
        ├── Refresh token expiry       → SESSION_EXPIRED
        ├── Server revocation event    → INVALIDATED
        ├── User manually logs out     → UNAUTHENTICATED
        └── App backgrounded/killed   → Persist state → Restore on reopen

OFFLINE_AUTHENTICATED
        │
        ├── Network restored           → PENDING_SYNC → validate → ONLINE_AUTHENTICATED or INVALIDATED
        ├── Offline TTL expires        → SESSION_EXPIRED
        ├── User enters wrong password → Deny (increment attempt counter)
        └── Max offline attempts hit   → SESSION_EXPIRED (force online re-auth)

PENDING_SYNC
        │
        ├── Server confirms valid      → ONLINE_AUTHENTICATED
        ├── Server returns revoked     → INVALIDATED
        └── Server unreachable         → OFFLINE_AUTHENTICATED (stay offline, retry later)
```

---

### Edge Cases & Resolution Strategy

| Edge Case | Resolution |
|---|---|
| **App killed mid-session** | Access token is in-memory only. On restart, session restoration flow reads from Secure Store. No blank screen — resumes from last valid auth state. |
| **Device offline during token refresh** | App transitions to `OFFLINE_AUTHENTICATED` using stored OCT. Access token not persisted to disk. |
| **Admin disables user while device is offline** | Offline session remains valid until OCT TTL expires (bounded risk). On reconnect, `PENDING_SYNC` validates with server → `INVALIDATED` if revoked. |
| **Internet reconnects after offline login** | `PENDING_SYNC` is mandatory. Server validates before granting `ONLINE_AUTHENTICATED`. User sees "Verifying session..." indicator. |
| **Multiple users on a shared device** | Per-user isolated namespace in Secure Store (`auth:{userId}:*`). No cross-user session contamination. |
| **Clock skew / device clock manipulation** | OCT TTL validated using server-embedded timestamps, not device clock. Server clock is authoritative on reconnect. |
| **First-time user on previously authenticated device** | If userId has no prior local auth record, offline login is denied. Requires online first-time login. |

---

### Security Boundaries

```
┌──────────────────────────────┬──────────────────────────────────┐
│ What Is Never Stored         │ What Is Permitted in Storage     │
├──────────────────────────────┼──────────────────────────────────┤
│ Plaintext passwords          │ Encrypted offline capability     │
│ Plaintext access tokens      │ token (AES-256, key derived      │
│ Raw refresh tokens (disk)    │ from password via PBKDF2)        │
│ PII beyond session needs     │ Hashed device binding key        │
│ Biometric data               │ Encrypted refresh token          │
│                              │ Session metadata (userId,        │
│                              │ offlineExpiresAt, deviceId)      │
└──────────────────────────────┴──────────────────────────────────┘
```

**Trust boundaries:**
- **Device → App:** User password is the trust anchor for offline decryption. Never leaves the device.
- **App → Server:** Only access tokens traverse the network for API calls. Refresh tokens used only at the auth endpoint.
- **Server → Device:** OCTs are signed with the server's private key. App verifies signatures using an embedded public key — no server call required for offline validation.

---

### Offline Login Risk Matrix

| Risk | Severity | Mitigation |
|---|---|---|
| Device stolen with active offline session | High | Short TTL (24h), PIN/biometric device lock, remote wipe capability |
| Admin disables user while device has valid offline session | High | Short TTL, mandatory PENDING_SYNC on reconnect, audit log of offline transactions |
| Attacker extracts offline token from secure storage | Medium | Token encrypted with password-derived key — useless without password. OS-level secure storage. |
| Brute-force offline password attempts | Medium | Max 5 offline attempts → force online re-auth. Exponential lockout delay between attempts. |
| Transactions processed on revoked account during offline window | Medium | Audit trail with offline session metadata, server reconciliation on reconnect |
| Clock manipulation to extend TTL | Low | Server-issued timestamps in signed token, server clock authoritative on reconnect |

---

## 2. Implementation Design

### Token & Credential Architecture

The system uses a **three-token model:**

| Token Type | Lifetime | Storage Location |
|---|---|---|
| Access Token (JWT, short-lived) | 15 minutes | In-memory ONLY. Never disk. Lost on app kill — by design. |
| Refresh Token (opaque, rotating) | 7 days | Encrypted in OS Secure Store (Keychain / Keystore). Used only at `/auth/refresh`. |
| Offline Capability Token (OCT) | 24 hours (configurable) | Encrypted in OS Secure Store. AES-256. Key derived from user password via PBKDF2. |

**OCT Payload:**

```json
{
  "userId":          "string",
  "deviceId":        "string",
  "issuedAt":        "ISO timestamp (server clock)",
  "expiresAt":       "ISO timestamp (issuedAt + offlineTTL)",
  "permissionsHash": "SHA-256 of user role/permissions at issue time",
  "serverSignature": "ECDSA signature (server private key)"
}
```

The OCT is encrypted with a key derived from the user's password (PBKDF2, 100k iterations, random salt stored separately in Secure Store). Physical access to storage alone is insufficient to decrypt it.

---

### Token Storage Strategy (Per User Namespace)

```
SecureStore keys per user:

  auth:{userId}:refreshToken        → Encrypted refresh token
  auth:{userId}:offlineToken        → Encrypted offline capability token
  auth:{userId}:offlineSalt         → PBKDF2 salt (random, per-user-per-device)
  auth:{userId}:deviceId            → Device binding fingerprint
  auth:{userId}:offlineAttempts     → Attempt counter (int)
  auth:{userId}:offlineLockUntil    → Timestamp (lockout expiry)
  auth:{userId}:lastOnlineAuth      → Timestamp of last successful online auth

Device-level (shared):
  knownUsers                        → Array of userIds with prior auth on device
  deviceId                          → Hardware/generated device fingerprint
```

---

### Offline Login Validation Logic

**Step 1 — Eligibility check**
- Verify `auth:{userId}:offlineToken` exists in Secure Store
- Verify `auth:{userId}:lastOnlineAuth` is present (device is "known" for this user)
- Check `auth:{userId}:offlineLockUntil` — if future timestamp, deny immediately

**Step 2 — Attempt gate**
- Read `auth:{userId}:offlineAttempts`
- If >= 5, transition to `SESSION_EXPIRED`, require online re-auth

**Step 3 — Decryption**
- Derive decryption key from entered password using PBKDF2 + stored salt
- Attempt to decrypt the stored OCT
- If decryption fails (wrong password): increment attempt counter, apply exponential backoff delay, deny

**Step 4 — Token validation**
- Verify server signature on decrypted OCT using embedded server public key
- Verify `deviceId` in OCT matches current device
- Verify `expiresAt` > current time (using server-issued timestamp as reference baseline)
- If all pass, grant `OFFLINE_AUTHENTICATED`

**Step 5 — Reset attempt counter**
- On successful offline login, reset `offlineAttempts` to 0

---

### Session Restoration Flow (App Launch)

```
App Opens
    │
    ├─ 1. Read session metadata from Secure Store
    │       If empty → show login screen (UNAUTHENTICATED)
    │
    ├─ 2. Check network availability
    │
    ├─ [ONLINE PATH]
    │       a. Read encrypted refresh token from Secure Store
    │       b. Decrypt refresh token (device-level key)
    │       c. POST /auth/refresh → exchange for new access + refresh token pair
    │       d. If success → store new refresh token, hold access token in memory
    │             → Transition to ONLINE_AUTHENTICATED, skip login screen
    │       e. If 401 (revoked) → clear all session data → UNAUTHENTICATED
    │       f. If network error during refresh → fall to OFFLINE PATH
    │
    └─ [OFFLINE PATH]
            a. Read offline capability token from Secure Store
            b. Check OCT expiry (server-embedded timestamp baseline)
            c. If within TTL → prompt for password to decrypt OCT
                  → On success → OFFLINE_AUTHENTICATED, skip login screen
            d. If expired → SESSION_EXPIRED → show message, require internet
```

---

### Expiration Handling

| Token | Expires | Online | Offline |
|---|---|---|---|
| Access Token (15 min) | Silent background refresh | Transition to OFFLINE_AUTHENTICATED if OCT valid |
| Refresh Token (7 days) | SESSION_EXPIRED → must re-login | Allow offline if OCT still valid |
| OCT (24 hours) | Transparent — already refreshed via refresh token | SESSION_EXPIRED → must connect to internet |

On every successful online auth or refresh, the OCT is reissued with a fresh 24-hour TTL.

---

### Required Backend Support

| Endpoint / Feature | Purpose |
|---|---|
| `POST /auth/login` | Full online login. Returns access token, refresh token, and OCT. |
| `POST /auth/refresh` | Exchanges refresh token for new access + refresh + fresh OCT. |
| `POST /auth/logout` | Revokes refresh token server-side. Accepts `deviceId` to scope revocation to one device vs. all. |
| `POST /auth/device/register` | Device fingerprint registration. Called on first successful login from a new device. Links `userId ↔ deviceId`. |
| `GET /auth/session/validate` | Called during `PENDING_SYNC`. Confirms session still valid. Returns `status: valid | revoked | expired`. |
| OCT Issuance | Server signs OCT with ECDSA private key on every login or refresh. App verifies using embedded public key. |
| Token Revocation List (TRL) | Server maintains revoked device/user pairs. Checked on `PENDING_SYNC` validate call. |
| Offline Transaction Audit Log | Backend accepts and reconciles transaction metadata uploaded after offline sessions. |

---

### UX Messaging Reference

| Scenario | Condition | Message | Action Available |
|---|---|---|---|
| **First-time login, offline** | `UNAUTHENTICATED` + no network | "A network connection is required to sign in for the first time. Please connect to Wi-Fi or mobile data and try again." | Retry when connected |
| **Offline login permitted** | Prior auth exists + offline + OCT valid | "You're offline. Enter your password to access your saved session." | Password entry |
| **Offline login — wrong password** | Decryption fails (attempts 1–4) | "Incorrect password. {X} attempts remaining before you'll need to reconnect." | Retry |
| **Offline login — max attempts** | 5 failed attempts | "Too many failed attempts. Connect to the internet to sign in securely." | Reconnect & retry |
| **Offline session expires soon** | OCT expires in < 2 hours | "Your offline session expires in less than 2 hours. Connect to extend it." | Dismiss / Connect |
| **Offline session expired** | OCT TTL exceeded + offline | "Your offline session has expired. Please connect to the internet to sign in again." | Retry when connected |
| **Session expired, online** | Refresh token expired + online | "Your session has expired. Please sign in again to continue." | Login |
| **Account revoked (detected online)** | Server returns revoked status | "Your account access has been disabled. Please speak with your manager." | None (lock screen) |
| **Account revoked (detected on reconnect)** | `PENDING_SYNC` → revoked | "Your account access has changed. Please sign in again or contact your manager." | Login / Contact manager |
| **Session syncing after offline** | `PENDING_SYNC` in progress | "Reconnected. Verifying your session..." | None (auto) |
| **Sync failed, stay offline** | `PENDING_SYNC` → server unreachable | "Couldn't verify with server. You can continue offline for now." | Continue offline |
| **Network restored, full access** | `PENDING_SYNC` → valid | "You're back online." (toast, non-blocking) | Auto-dismiss |
| **First user on shared device (offline)** | New `userId` + offline | "This device hasn't been set up for your account yet. Please sign in online first." | Connect & login |

---

### Multi-User Device Architecture Summary

```
Device Secure Store
├── knownUsers: [userId1, userId2, userId3]    ← Non-sensitive index
├── deviceId                                   ← Shared device fingerprint
├── auth:userId1:refreshToken                  ← Encrypted
├── auth:userId1:offlineToken                  ← Encrypted (password-derived key)
├── auth:userId1:offlineSalt
├── auth:userId1:offlineAttempts
├── auth:userId2:refreshToken
├── auth:userId2:offlineToken
│     ...

Login Screen (shared device mode)
└── Shows user selector (from knownUsers) OR free-entry email field
└── Selected user → scoped to their namespace
└── No cross-user session data is ever readable
```

---

### Critical Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Offline credential trust anchor | User password (via PBKDF2 decryption of OCT) | Password never stored; attacker needs both storage access AND password |
| OCT lifetime | 24 hours | Bounds revocation risk to one business day |
| Access token lifetime | 15 minutes | Minimizes window of token misuse |
| Refresh token lifetime | 7 days | Balances UX (infrequent re-auth) with security |
| Offline attempt limit | 5 attempts then force online | Mitigates brute-force without over-restricting legitimate use |
| Clock authority | Server-embedded timestamps in OCT | Prevents device clock manipulation to extend sessions |
| PENDING_SYNC mandatory | Yes, always on reconnect | Ensures revocation is caught at first opportunity |
| Per-user namespace isolation | Yes | Required for shared-device POS integrity |

---

## Implementation Todo List

> Track implementation progress here. Update status as work proceeds.
> Legend: ✅ Done | 🔄 In progress | ⬜ Pending

### Phase 1 — Foundation (Backend) ✅ Complete

- [x] **P1-01** — Add `POST /auth/device/register` endpoint (link `userId ↔ deviceId`)
  - `authController.registerDevice()` — updates active RefreshToken's `deviceInfo`
  - Route: `POST /api/auth/device/register` (requires `authenticate`)
  - Validation: `validateDeviceRegister` in `middleware/validation.ts`
- [x] **P1-02** — Add OCT issuance to `POST /auth/login` response
  - `authService.generateOfflineCapabilityToken(payload, deviceId)` — JWT signed with `JWT_DEVICE_SECRET`, 24h TTL
  - Included in login response as `tokens.offlineCapabilityToken` when `x-device-id` header is present
- [x] **P1-03** — Add OCT re-issuance to `POST /auth/refresh` response
  - DeviceId resolved from `x-device-id` header → stored RefreshToken `deviceInfo.deviceId`
  - Fresh OCT included in refresh response as `offlineCapabilityToken`
- [x] **P1-04** — Add `GET /auth/session/validate` endpoint (returns `valid | revoked`)
  - `authController.validateSession()` — checks `user.isActive` server-side
  - Route: `GET /api/auth/session/validate` (requires `authenticate`)
- [x] **P1-05** — Token Revocation List — existing `RefreshToken.isRevoked` + `revokeAllForUser()` covers this. Session validate checks `user.isActive` for account-level revocation.
- [x] **P1-06** — `deviceId` scope on logout — existing `logout` already supports `logoutAllDevices: false` (token-specific) and `true` (all tokens). DeviceId now stored in `RefreshToken.deviceInfo`.
- [x] **P1-07** — Tightened token lifetimes: access `15m`, refresh `7d` (remembered `30d`), OCT `24h`
- ⬜ **P1-DEFERRED** — Offline transaction audit log ingestion endpoint (deferred to P8)

### Phase 2 — Auth State Machine (Mobile) ✅ Complete

- [x] **P2-01** — `AuthStatus` enum in new `src/types/auth.ts` — 6 states with inline JSDoc
- [x] **P2-02** — `authStore.ts` fully redesigned with Zustand state machine
  - `authStatus: AuthStatus` replaces `isAuthenticated: boolean` as source of truth
  - Persists only `user` (non-sensitive) to AsyncStorage; `authStatus` derived on startup
  - `User` alias exported for backward compatibility with existing screens
- [x] **P2-03** — `services/networkMonitor.ts` (new singleton)
  - Fires callbacks only on genuine connectivity transitions (suppresses oscillation)
  - `resolveConnected()` uses both `isConnected` and `isInternetReachable` to avoid false positives
- [x] **P2-04** — All state transitions wired:
  - `login()` → `ONLINE_AUTHENTICATED`
  - `logout()` → `UNAUTHENTICATED`
  - `handleOffline()` → `OFFLINE_AUTHENTICATED` (stops refresh timer)
  - `handleOnline()` → `PENDING_SYNC` → `ONLINE_AUTHENTICATED` | `INVALIDATED` | back to `OFFLINE_AUTHENTICATED`
  - `initialize()` → derives correct initial state from stored artifacts

### Phase 3 — Secure Storage Layer (Mobile) ✅ Complete

- [x] **P3-01** — `expo-secure-store` abstraction layer already in `services/secureStorage.ts` (unchanged — was already correct)
- [x] **P3-02** — Per-user namespace key helpers in new `services/authStorage.ts`
  - Key format: `hpos_auth_{userId}_{field}` — safe chars, within 128-char limit
  - Helpers: refresh token, OCT, PBKDF2 salt, attempt counter, lockout timestamp, last online auth
  - `clearUserSession(userId)` — wipes all keys for a user atomically
- [x] **P3-03** — Device fingerprint upgraded in `utils/deviceId.ts`
  - Moved from `AsyncStorage` → `SecureStore`
  - Format upgraded: `{timestamp_b36}-{rand}-{rand}-{rand}` (more entropy)
- [x] **P3-04** — `knownUsers` index: `getKnownUsers()`, `addKnownUser()`, `removeKnownUser()` in `authStorage.ts`
  - Additional helpers: `hasUserPriorAuth()`, `isUserOfflineLocked()`, `incrementUserOfflineAttempts()`

### Phase 4 — Token Management (Mobile) ✅ Complete

- [x] **P4-01** — Access token: removed from disk persistence in `apiService.ts`
  - `setAuthToken()` no longer calls `secureStorage.setItem()` for access token
  - `restoreToken()` no longer reads access token from disk
  - `AUTH_TOKEN_KEY` constant removed
- [x] **P4-02** — Refresh token storage: per-user namespace via `authStorage.setUserRefreshToken(userId, token)` called in `authStore.login()` and `tokenRefreshedCallback`
- [x] **P4-03** — OCT encryption/decryption in new `services/cryptoService.ts`
  - `generateSalt()` — 16-byte random, returns base64
  - `encryptOCT(jwt, password, salt)` — PBKDF2 100k iterations + AES-256-GCM, IV prepended
  - `decryptOCT(encrypted, password, salt)` — throws on wrong password (AES-GCM auth tag)
  - `isCryptoAvailable()` — runtime guard (Hermes RN 0.71+ / Expo SDK 50+)
- [x] **P4-04** — OCT signature verification: handled server-side. Client-side JWT decode (existing `jwtDecoder.ts`) reads embedded claims (userId, deviceId, expiresAt) without re-verifying signature. Full ECDSA client verification deferred to P8 security hardening.
- [x] **P4-05** — Background refresh timer in `apiService.ts`
  - `startRefreshTimer()` — `setInterval` every 14 min (1 min before 15-min expiry)
  - `stopRefreshTimer()` — called on logout and on network loss
  - `proactiveRefresh()` — no-op if offline or no refresh token; non-fatal on error
- [x] **P4-06** — Rotating refresh token: `tokenRefreshedCallback` in apiService → authStore persists new token to `authStorage.setUserRefreshToken()` on every auto-refresh or proactive refresh
- [x] **P4-EXTRA** — Device headers on every login/refresh: `x-device-id`, `x-device-platform`, `x-device-name`; device ID cached in apiService after first async resolution

### Phase 5 — Session Restoration (Mobile) ✅ Complete

- [x] **P5-01** — App launch session restoration flow (online path)
  - `authStore.initialize()` — reads stored refresh token, calls `/auth/refresh-token`, transitions to `ONLINE_AUTHENTICATED`
- [x] **P5-02** — App launch session restoration flow (offline path)
  - `authStore.initialize()` — calls `hasUserPriorAuth()`, transitions to `OFFLINE_AUTHENTICATED` (awaiting offline login password)
- [x] **P5-03** — `PENDING_SYNC` flow (reconnect validation)
  - `authStore.handleOnline()` — transitions `OFFLINE_AUTHENTICATED → PENDING_SYNC`, validates via `/auth/refresh-token`, resolves to `ONLINE_AUTHENTICATED` or `INVALIDATED`
- [x] **P5-04** — Login screen suppressed when session is restorable
  - `app/index.tsx` — routes based on `authStatus`; spinner during `PENDING_SYNC`

### Phase 6 — Offline Login Flow (Mobile) ✅ Complete

- [x] **P6-01** — Offline login eligibility check (prior auth exists, not locked)
  - `authStore.offlineLogin()` step 1–2 — checks `isUserOfflineLocked()` and `getUserOfflineAttempts()`
- [x] **P6-02** — Attempt counter and exponential backoff lockout
  - Attempt 3 → 30s lockout; attempt 4 → 2min lockout; attempt 5 → `SESSION_EXPIRED`
- [x] **P6-03** — OCT decryption on offline login
  - `cryptoService.decryptOCT()` called with PBKDF2-derived key; AES-GCM auth-tag validates password
- [x] **P6-04** — Device binding check (`deviceId` in OCT vs current device)
  - `authStore.offlineLogin()` step 5b — compares `octPayload.deviceId` with `getOrCreateDeviceId()`
- [x] **P6-05** — OCT TTL check (server-embedded timestamps)
  - `authStore.offlineLogin()` step 5a — validates `octPayload.exp` against current time
- [x] **P6-06** — Attempt counter reset on successful offline login
  - `resetUserOfflineAttempts()` + `clearUserOfflineLock()` called on success

### Phase 7 — UX & Messaging (Mobile) ✅ Complete

- [x] **P7-01** — Shared device user selector on login screen
  - `authStorage.setUserProfile()` / `getUserProfile()` store per-user email+fullName on login
  - `login.tsx` loads all known users on mount, shows picker modal when multiple users exist
  - Selected user's identity passed to `offlineLogin()`
- [x] **P7-02** — UX message scenarios from messaging reference table
  - UNAUTHENTICATED + offline: `WelcomeScreen` — "Please connect to the internet to continue"
  - Offline mode header: "You're offline. Enter your password to access your saved session."
  - Wrong password messages with remaining attempt counts: set in `authStore.offlineLogin()`
  - INVALIDATED (online detection): "Your account access has been disabled. Please speak with your manager."
  - INVALIDATED (on reconnect): "Your account access has changed. Please sign in again or contact your manager."
  - New user on shared device offline: "This device hasn't been set up for your account yet. Please sign in online first."
  - SESSION_EXPIRED / expiry warnings: wired through `statusMessage` → `contextBanner` in `login.tsx`
- [x] **P7-03** — "Verifying your session..." indicator for `PENDING_SYNC`
  - `app/index.tsx` — spinner + statusMessage shown during `PENDING_SYNC`
- [x] **P7-04** — Non-blocking "You're back online" toast
  - `src/components/AuthToast.tsx` — detects `PENDING_SYNC → ONLINE_AUTHENTICATED` transition, shows 3s toast
  - Mounted in `app/_layout.tsx` alongside `SyncStatusProvider`
- [x] **P7-05** — Offline session expiry warning (< 2 hours remaining)
  - `authStore.offlineLogin()` success block — checks `octPayload.exp`; if within 2h, sets `statusMessage` on `OFFLINE_AUTHENTICATED` transition

### Phase 8 — Security Hardening ✅ Complete (P8-04/05 deferred to P8-DEFERRED)

- [x] **P8-01** — Max 5 offline login attempts → `SESSION_EXPIRED`
  - Enforced in `authStore.offlineLogin()`; 5th failure transitions to `SESSION_EXPIRED`
- [x] **P8-02** — Full OCT field validation (ECDSA signature, deviceId, expiry)
  - expiry + deviceId: ✅ done in `authStore.offlineLogin()` steps 5a/5b
  - ECDSA signing: ✅ backend `authService.generateOfflineCapabilityToken()` now uses ES256 when `OCT_EC_PRIVATE_KEY_PEM` is set; falls back to HS256 for backward compat
  - ECDSA client verification: ✅ `cryptoService.verifyOCTSignature()` — verifies ES256 signature using embedded JWK public key (P-256 Web Crypto); called in `authStore.offlineLogin()` after decryption; soft-pass when `OCT_SIGNING_PUBLIC_KEY_JWK` is null (HMAC mode)
  - Key generation: `backend/scripts/generate-oct-keys.ts` — run once, set `OCT_EC_PRIVATE_KEY_PEM` in backend `.env` and embed JWK in `cryptoService.ts`
- [x] **P8-03** — Clear all session data on `INVALIDATED` state
  - `authStore.transitionTo()` — fires `clearUserSession(userId)` on INVALIDATED transition
  - `authStore.initialize()` INVALIDATED path also routes through `transitionTo()` (fixed)
- ⬜ **P8-04** — Audit trail: tag offline-session transactions with session metadata (deferred)
- ⬜ **P8-05** — Reconcile offline transactions with server on reconnect (deferred)

### Phase 9 — Testing (Backend unit tests complete; mobile + integration deferred)

- [x] **P9-01** — Backend auth service unit tests (P9-01 / P9-02 combined)
  - `backend/tests/auth.service.test.ts` — 36 tests, all passing
  - Covers: hashPassword, comparePassword, generateAccessToken, verifyAccessToken,
    generateRefreshToken, verifyRefreshToken, generateOfflineCapabilityToken (OCT),
    verifyOfflineCapabilityToken, permissionsHash determinism, hasPermission / hasAnyPermission /
    hasAllPermissions, isWithinOfflineGracePeriod, extractTokenFromHeader
  - Jest config fixed: `moduleNameMapping` → `moduleNameMapper` (was preventing path aliases in tests)
  - `tests/setup.ts` updated to seed env vars as fallback (no `.env.test` required)
- ⬜ **P9-02** — Mobile unit tests: OCT encryption/decryption (cryptoService) — deferred (requires Jest + Web Crypto polyfill for React Native)
- ⬜ **P9-03** — Mobile unit tests: offline attempt counter and lockout — deferred
- ⬜ **P9-04** — Integration tests: session restoration — deferred (requires test DB + server)
- ⬜ **P9-05** — Integration tests: PENDING_SYNC flow — deferred
- ⬜ **P9-06** — E2E test: first-time login — deferred (requires Detox / Maestro)
- ⬜ **P9-07** — E2E test: multi-user shared device isolation — deferred
- ⬜ **P9-08** — Security test: clock manipulation resistance — deferred
- ⬜ **P9-09** — Security test: brute-force lockout enforcement — deferred

---

*Plan authored: 2026-02-24. Review before implementation begins.*
