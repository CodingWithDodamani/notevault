'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  FolderSync,
  HardDrive,
  Folder,
  ShieldCheck,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { googleSignIn, googleSignInRedirect, logout, getAccessToken } from '@/lib/firebase';
import { VaultFile, VaultFolder } from '@/lib/types';
import { DriveSyncInfo } from '@/lib/vault-store';
import { apiFetch, readApiError } from '@/lib/api-client';
import { storeRefreshToken } from '@/lib/drive-session';
import { useToast } from '@/lib/use-toast';
import { Dialog } from '@/components/Dialog';

/** Result of a completed /?connect=drive full-page redirect sign-in. */
export interface PendingDriveConnect {
  accessToken: string;
  refreshToken: string | null;
  email: string | null;
  name: string | null;
}

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncInfo: DriveSyncInfo;
  onUpdateSyncInfo: (info: DriveSyncInfo | ((prev: DriveSyncInfo) => DriveSyncInfo)) => void;
  onAddFiles: (files: VaultFile[], folders?: VaultFolder[], replaceAll?: boolean) => void;
  onClearVault: () => void;
  pendingConnect?: PendingDriveConnect | null;
  pendingConnectError?: string | null;
  onPendingConnectHandled?: () => void;
}

export function DriveSyncModal({
  isOpen,
  onClose,
  syncInfo,
  onUpdateSyncInfo,
  onAddFiles,
  onClearVault,
  pendingConnect,
  pendingConnectError,
  onPendingConnectHandled,
}: DriveSyncModalProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanScope, setScanScope] = useState<'all' | 'folder'>(syncInfo.scanMode || 'all');
  const [folderIdInput, setFolderIdInput] = useState(syncInfo.rootFolderId || 'all');
  const [scanStats, setScanStats] = useState<{
    discovered: number;
    pdfs: number;
    sdocx: number;
    docx: number;
  } | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const { toast } = useToast();

  // Identity guards so a pending redirect result is consumed exactly once,
  // even if the modal re-renders before the parent clears the pending state.
  const handledConnectRef = useRef<PendingDriveConnect | null>(null);
  const handledErrorRef = useRef<string | null>(null);

    const executeScan = async (tokenOverride?: string, forceFullScan = false) => {
    setIsScanning(true);
    setScanStats(null);

    try {
      const token = tokenOverride || (await getAccessToken());
      if (!token) {
        toast({
          title: 'Session expired',
          description:
            'Click "Sign in with Google" to reconnect, then sync again.',
        });
        throw new Error('No Google access token');
      }

      const targetFolder = scanScope === 'all' ? 'all' : folderIdInput || 'all';

      // Incremental sync: when we already have an index for the same scope,
      // only ask Drive for what changed since the last successful scan.
      const canDelta =
        !forceFullScan &&
        Boolean(syncInfo.lastSyncedAt) &&
        syncInfo.rootFolderId === targetFolder;

      const params = new URLSearchParams({ folderId: targetFolder });
      if (canDelta && syncInfo.lastSyncedAt) {
        params.set('modifiedSince', syncInfo.lastSyncedAt);
      }

      const res = await apiFetch(`/api/drive/files?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, `Failed to fetch Google Drive files (${res.status})`));
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const driveFiles: VaultFile[] = data.files || [];
      const driveFolders: VaultFolder[] = data.folders || [];

      let pdfs = 0;
      let sdocx = 0;
      let docx = 0;

      driveFiles.forEach((f) => {
        if (f.extension === 'pdf') pdfs++;
        else if (f.extension === 'sdocx') sdocx++;
        else if (f.extension === 'docx' || f.extension === 'doc') docx++;
      });

      setScanStats({
        discovered: driveFiles.length,
        pdfs,
        sdocx,
        docx,
      });

      if (canDelta) {
        toast({
          title: 'Sync complete',
          description:
            driveFiles.length === 0
              ? 'No changes since the last sync.'
              : `${driveFiles.length} file${driveFiles.length === 1 ? '' : 's'} changed since the last sync.`,
        });
      }

      if (data.truncated) {
        toast({
          title: 'Partial scan',
          description:
            'This Drive is larger than the 10,000 file scan limit, so the index is incomplete. Your existing index was kept intact — try scanning a specific folder for a complete result.',
        });
      }

      // MERGE, never replace. The previous implementation called
      // onAddFiles(..., replaceAll = true) after reading only the first 1000
      // Drive items, which permanently destroyed the local index for any Drive
      // larger than one page. Merging keeps local favourites, reading
      // progress and any file the scan did not reach.
      onAddFiles(driveFiles, driveFolders, false);

      onUpdateSyncInfo((prev) => ({
        ...prev,
        isConnected: true,
        rootFolderId: targetFolder,
        rootFolderName: scanScope === 'all' ? 'Entire Google Drive' : 'Selected Folder',
        lastSyncedAt: new Date().toISOString(),
        isSyncing: false,
        scanMode: scanScope,
      }));
    } catch (err: unknown) {
      console.error('Scan error:', err);
      toast({
        title: 'Sync failed',
        description:
          err instanceof Error
            ? err.message
            : 'Sync failed. Please check permissions and try again.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Complete a /?connect=drive full-page redirect once the modal opens:
  // mark connected, persist the refresh token, then auto-scan Drive.
  useEffect(() => {
    if (!isOpen) return;

    if (pendingConnect && handledConnectRef.current !== pendingConnect) {
      handledConnectRef.current = pendingConnect;
      onPendingConnectHandled?.();
      const { accessToken, refreshToken, email, name } = pendingConnect;

      onUpdateSyncInfo((prev) => ({
        ...prev,
        isConnected: true,
        userEmail: email,
        userName: name,
        lastSyncedAt: new Date().toISOString(),
        isSyncing: false,
      }));

      toast({
        title: 'Google Drive connected',
        description: email
          ? `Signed in as ${email}. Scanning your Drive…`
          : 'Signed in. Scanning your Drive…',
      });

      if (refreshToken) {
        void storeRefreshToken(refreshToken).then((stored) => {
          if (!stored) {
            toast({
              title: 'Auto-reconnect unavailable',
              description:
                'Drive session storage is unavailable — you will need to sign in again after reloading this page.',
            });
          }
        });
      }

      void executeScan(accessToken);
      return;
    }

    if (pendingConnectError && handledErrorRef.current !== pendingConnectError) {
      handledErrorRef.current = pendingConnectError;
      onPendingConnectHandled?.();
      const isUnauthorizedDomain = /unauthorized-domain/.test(pendingConnectError);
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      toast({
        title: 'Sign-in failed',
        description: isUnauthorizedDomain
          ? `Add "${hostname}" to your Firebase project’s Authorized domains (Authentication → Settings → Authorized domains), then reopen the link.`
          : pendingConnectError,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pendingConnect, pendingConnectError]);

  const showSignInError = (err: unknown) => {
    const message = err instanceof Error ? err.message : '';
    const isUnauthorizedDomain = /unauthorized-domain/.test(message);

    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    toast({
      title: 'Sign-in failed',
      description:
        isUnauthorizedDomain
          ? `Add "${hostname}" to your Firebase project’s Authorized domains (Authentication → Settings → Authorized domains), then reload and try again.`
          : `Could not complete Google Sign-In. ${isLocal ? 'Check your popup settings.' : `If you're on Vercel/Netlify, also add "${origin}" to your Google Cloud Console OAuth client (Authorized JavaScript origins + redirect URIs).`}`,
    });
  };

  const handleConnectGoogle = async () => {
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res?.user && res.accessToken) {
        onUpdateSyncInfo((prev) => ({
          ...prev,
          isConnected: true,
          userEmail: res.user.email,
          userName: res.user.displayName,
          lastSyncedAt: new Date().toISOString(),
          isSyncing: false,
        }));

        // Persist the long-lived refresh token server-side so a page reload can
        // silently restore the Drive session instead of forcing a new popup.
        if (res.refreshToken) {
          const stored = await storeRefreshToken(res.refreshToken);
          if (!stored) {
            toast({
              title: 'Auto-reconnect unavailable',
              description:
                'Drive session storage is unavailable — you will need to sign in again after reloading this page.',
            });
          }
        }

        // Automatically trigger immediate scan of Google Drive files!
        await executeScan(res.accessToken);
      }
    } catch (err: unknown) {
      console.error('Google sign in error:', err);
      const code = (err as { code?: string })?.code ?? '';

      // Popup blocked or unsupported (mobile / strict browsers): fall back to
      // the full-page redirect flow, which returns to this page afterwards.
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await googleSignInRedirect();
          return;
        } catch (redirectErr) {
          console.error('Redirect fallback failed:', redirectErr);
          showSignInError(redirectErr);
          return;
        }
      }

      showSignInError(err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      onUpdateSyncInfo((prev) => ({
        ...prev,
        isConnected: false,
        userEmail: null,
        userName: null,
        rootFolderId: 'all',
        rootFolderName: 'Entire Google Drive',
        lastSyncedAt: null,
        isSyncing: false,
      }));
      onClearVault();
      toast({ title: 'Disconnected', description: 'Drive session cleared.' });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Sign-out failed',
        description: 'Could not sign out cleanly. Please try again.',
      });
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Google Drive Synchronization">
      <div className="p-6 space-y-5 text-xs">
        {/* Connection Status Card */}
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-zinc-500" />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {syncInfo.isConnected ? 'Google Account Connected' : 'Google Account'}
                </span>
              </div>
              <span
                className={`text-[11px] font-medium ${
                  syncInfo.isConnected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-500'
                }`}
              >
                {syncInfo.isConnected ? 'Active & Linked' : 'Not Connected'}
              </span>
            </div>

            {syncInfo.isConnected ? (
              <div className="space-y-2 text-zinc-600 dark:text-zinc-400 pt-1">
                <p>
                  Connected as:{' '}
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    {syncInfo.userEmail}
                  </strong>
                </p>
                {syncInfo.lastSyncedAt && (
                  <p className="text-zinc-500 text-[11px]">
                    Last indexed: {new Date(syncInfo.lastSyncedAt).toLocaleString()}
                  </p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => executeScan()}
                    disabled={isScanning}
                    className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1"
                  >
                    <RotateCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Re-scan Drive</span>
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="text-[11px] text-red-600 dark:text-red-400 hover:underline"
                  >
                    Disconnect & Clear Cache
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-zinc-500 leading-relaxed">
                  Sign in with Google to index and search all your personal PDFs, study notes, and Samsung Notes (`.sdocx`) directly from your Google Drive.
                </p>
                <button
                  onClick={handleConnectGoogle}
                  disabled={isSigningIn || isScanning}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  <Cloud className="w-4 h-4" />
                  <span>
                    {isSigningIn
                      ? 'Connecting Google Account...'
                      : isScanning
                      ? 'Scanning Drive Notes...'
                      : 'Sign in with Google'}
                  </span>
                </button>
                {/* Full-page fallback link. Deliberately a plain <a> (not a
                    Next.js Link/button) so the browser performs a real page
                    load and the /?connect=drive flow starts cleanly. */}
                <p className="text-xs text-zinc-500 text-center">
                  Popup blocked?{' '}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load is required so the /?connect=drive effect runs */}
                  <a
                    href="/?connect=drive"
                    className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Connect with the full-page link →
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Folder / Drive Scope Selector */}
          <div className="space-y-2">
            <label className="block font-medium text-zinc-800 dark:text-zinc-200">
              Indexing Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScanScope('all')}
                className={`px-3 py-2 text-xs rounded-md border text-left transition-colors ${
                  scanScope === 'all'
                    ? 'border-zinc-900 dark:border-zinc-100 font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span className="font-semibold block">Entire Google Drive</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  Finds all PDFs & notes across all folders
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScanScope('folder')}
                className={`px-3 py-2 text-xs rounded-md border text-left transition-colors ${
                  scanScope === 'folder'
                    ? 'border-zinc-900 dark:border-zinc-100 font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span className="font-semibold block">Specific Folder</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  Target a specific folder ID
                </span>
              </button>
            </div>

            {scanScope === 'folder' && (
              <div className="pt-1">
                <input
                  type="text"
                  value={folderIdInput}
                  onChange={(e) => setFolderIdInput(e.target.value)}
                  placeholder="Paste Google Drive Folder ID"
                  className="w-full px-3 py-2 font-mono text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
                />
              </div>
            )}
          </div>

          {/* Live Scan State */}
          {isScanning && (
            <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-center space-y-2">
              <RotateCw className="w-5 h-5 mx-auto animate-spin text-zinc-600 dark:text-zinc-300" />
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                Scanning your Google Drive documents...
              </p>
              <p className="text-[11px] text-zinc-500">
                Indexing PDFs, DOCX, Samsung Notes (.sdocx), and formula notes into your vault.
              </p>
            </div>
          )}

          {scanStats && !isScanning && (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sync Complete — Real Drive Files Loaded</span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
                <div className="p-2 bg-white dark:bg-zinc-900 rounded border border-emerald-100 dark:border-emerald-900/50">
                  <span className="block text-xs text-zinc-500 font-sans">Total</span>
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {scanStats.discovered}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-zinc-900 rounded border border-emerald-100 dark:border-emerald-900/50">
                  <span className="block text-xs text-zinc-500 font-sans">PDFs</span>
                  <span className="font-bold text-sm text-red-600 dark:text-red-400">
                    {scanStats.pdfs}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-zinc-900 rounded border border-emerald-100 dark:border-emerald-900/50">
                  <span className="block text-xs text-zinc-500 font-sans">.sdocx</span>
                  <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
                    {scanStats.sdocx}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-zinc-900 rounded border border-emerald-100 dark:border-emerald-900/50">
                  <span className="block text-xs text-zinc-500 font-sans">DOCX</span>
                  <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                    {scanStats.docx}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Guarantee Box */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-2.5 text-zinc-600 dark:text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong>Zero Heavy Storage Guarantee:</strong> Your original 96 GB documents remain in your Google Drive. NoteVault stores only lightweight metadata and search indices.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-center justify-between">
          <button
            onClick={() => setIsConfirmingClear(true)}
            className="text-[11px] text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Clear Local Index
          </button>

          {isConfirmingClear && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-zinc-500 dark:text-zinc-400">Delete all indexed metadata?</span>
              <button
                onClick={() => {
                  onClearVault();
                  setScanStats(null);
                  setIsConfirmingClear(false);
                }}
                className="px-2 py-0.5 font-medium text-white bg-red-600 hover:bg-red-700 rounded"
              >
                Delete
              </button>
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="px-2 py-0.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {syncInfo.lastSyncedAt && (
              <button
                onClick={() => executeScan(undefined, true)}
                disabled={isScanning}
                className="px-2.5 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline disabled:opacity-50 disabled:no-underline"
                title="Scan the whole Drive again instead of only what changed"
              >
                Full re-scan
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
            >
              Close
            </button>
            <button
              onClick={() => executeScan()}
              disabled={isScanning || isSigningIn}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 shadow-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>
      </Dialog>
  );
}
