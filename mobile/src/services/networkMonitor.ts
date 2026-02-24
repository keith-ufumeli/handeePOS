/**
 * networkMonitor.ts
 *
 * Singleton that watches real network connectivity changes and fires
 * callbacks only on genuine transitions (online → offline, offline → online).
 *
 * Backed by @react-native-community/netinfo.
 * Uses `isInternetReachable` in addition to `isConnected` to avoid false
 * positives on captive-portal or airplane-mode-with-wifi scenarios.
 */

import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from '@react-native-community/netinfo';

type ConnectivityHandler = () => void;

class NetworkMonitor {
  private subscription: NetInfoSubscription | null = null;
  /** null = not yet observed; true/false = last known state */
  private wasConnected: boolean | null = null;

  /**
   * Start watching connectivity.
   *
   * Callbacks fire only on genuine state transitions — not on every
   * NetInfo event (which can fire multiple times per second during
   * unstable connections).
   *
   * @param onOnline  Called when connectivity is restored.
   * @param onOffline Called when connectivity is lost.
   */
  start(onOnline: ConnectivityHandler, onOffline: ConnectivityHandler): void {
    this.stop(); // Guard: stop any existing subscription first

    this.subscription = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = this.resolveConnected(state);

      if (this.wasConnected === null) {
        // First event — record baseline without firing callbacks.
        // The auth store's initialize() handles the startup state check separately.
        this.wasConnected = connected;
        return;
      }

      if (connected && !this.wasConnected) {
        this.wasConnected = true;
        onOnline();
      } else if (!connected && this.wasConnected) {
        this.wasConnected = false;
        onOffline();
      }
      // Same state — do nothing (avoids spurious callbacks during reconnect oscillation)
    });
  }

  /** Stop watching and reset internal state. */
  stop(): void {
    this.subscription?.();
    this.subscription = null;
    this.wasConnected = null;
  }

  /**
   * One-shot connectivity check.
   * Safe to call before `start()` — does not require an active subscription.
   */
  async isConnected(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return this.resolveConnected(state);
  }

  /**
   * Resolve true connectivity from a NetInfo state object.
   * `isInternetReachable` can be null when not yet determined — we treat
   * null as "reachable" (optimistic) to avoid falsely blocking the user
   * on slow networks where the reachability probe hasn't returned yet.
   */
  private resolveConnected(state: NetInfoState): boolean {
    return !!(state.isConnected && state.isInternetReachable !== false);
  }
}

export default new NetworkMonitor();
