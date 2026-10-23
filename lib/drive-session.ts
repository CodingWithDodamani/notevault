import { getIdToken } from './client-auth';
import { setManualAccessToken } from './firebase';
import { apiFetch } from './api-client';
import type { DriveSyncInfo } from './vault-store';

/**
 * Persistence for the Google Drive session.
 *
 * The short-lived access token is never written to disk. The long-lived
 * refresh token is handed to the server once, which stores it in Firestore
 * under the user's own document. After that, a page reload can silently
 * obtain a fresh access token again.
 */

export async function storeRefreshToken(refreshToken: string | null): Promise<boolean> {
  if (!refreshToken) return false;
  const idToken = await getIdToken();
  if (!idToken) return false;

  try {
    const res = await apiFetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'store', refreshToken }),
    });
    return res.ok;
  } catch (error) {
    console.warn('[drive-session] could not store refresh token:', error);
    return false;
  }
}

/**
 * Attempts to silently restore the Drive access token after a page reload.
 * Returns the new access token, or null if the user needs to sign in again.
 */
export async function restoreAccessToken(): Promise<string | null> {
  const idToken = await getIdToken();
  if (!idToken) return null;

  try {
    const res = await apiFetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh' }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || typeof data.accessToken !== 'string' || !data.accessToken) return null;

    setManualAccessToken(data.accessToken);
    return data.accessToken;
  } catch (error) {
    console.warn('[drive-session] silent restore failed:', error);
    return null;
  }
}

/**
 * Restores the Drive session and reports the result through the store, so the
 * UI stops claiming to be connected when it is not (and stops claiming to be
 * disconnected when it is).
 */
export async function restoreDriveSession(
  saveSyncInfo: (info: DriveSyncInfo | ((prev: DriveSyncInfo) => DriveSyncInfo)) => void
): Promise<boolean> {
  const accessToken = await restoreAccessToken();
  if (!accessToken) return false;

  saveSyncInfo((prev) => ({
    ...prev,
    isConnected: true,
    lastSyncedAt: prev.lastSyncedAt ?? new Date().toISOString(),
    isSyncing: false,
  }));
  return true;
}
