'use client';

import { useSyncExternalStore, useMemo, useCallback, useEffect } from 'react';
import { VaultFile, VaultFolder, LibraryStats } from './types';
import { idbGet, idbSet, isIdbSupported } from './idb';

const STORAGE_KEY_FILES = 'notevault_files_v2';
const STORAGE_KEY_FOLDERS = 'notevault_folders_v2';
const STORAGE_KEY_SYNC_INFO = 'notevault_sync_info_v2';

// Old keys to wipe to eliminate any legacy dummy sample data
const OLD_STORAGE_KEYS = ['notevault_files_v1', 'notevault_folders_v1', 'notevault_sync_info_v1'];

export interface DriveSyncInfo {
  isConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
  lastSyncedAt: string | null;
  totalDriveStorageUsed?: string;
  isSyncing: boolean;
  statusMessage?: string;
  scanMode?: 'all' | 'folder';
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// In-memory module state for useSyncExternalStore (initialized to EMPTY - NO DUMMY DATA)
let filesState: VaultFile[] = [];
let foldersState: VaultFolder[] = [];
let syncInfoState: DriveSyncInfo = {
  isConnected: false,
  userEmail: null,
  userName: null,
  rootFolderId: 'all',
  rootFolderName: 'Entire Google Drive',
  lastSyncedAt: null,
  isSyncing: false,
  scanMode: 'all',
};

let isHydrated = false;
let hydrationStarted = false;

/**
 * Persists a value.
 *
 * IndexedDB is the primary store because a Drive with thousands of files
 * produces more metadata than localStorage's ~5 MB quota allows, and a quota
 * failure there discards the write silently. localStorage remains as a
 * fallback for browsers where IndexedDB is unavailable.
 */
async function persist(key: string, value: unknown): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isIdbSupported()) {
    try {
      await idbSet(key, value);
      return;
    } catch (error) {
      console.error(`[vault] IndexedDB write failed for ${key}:`, error);
    }
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[vault] localStorage write failed for ${key}:`, error);
  }
}

async function readPersisted<T>(key: string): Promise<T | null> {
  if (isIdbSupported()) {
    try {
      const value = await idbGet<T>(key);
      if (value !== null && value !== undefined) return value;
    } catch (error) {
      console.error(`[vault] IndexedDB read failed for ${key}:`, error);
    }
  }

  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[vault] localStorage read failed for ${key}:`, error);
  }
  return null;
}

/**
 * Loads the index.
 *
 * The first run migrates the existing localStorage index into IndexedDB, then
 * removes the localStorage copy so the two cannot drift apart. The migration
 * is one-way and only runs once, so a failed migration never loses data.
 */
async function hydrateStorage(): Promise<void> {
  if (isHydrated || typeof window === 'undefined') return;
  hydrationStarted = true;

  try {
    OLD_STORAGE_KEYS.forEach((oldKey) => {
      try {
        localStorage.removeItem(oldKey);
      } catch {
        /* ignore */
      }
    });

    const [storedFiles, storedFolders, storedSync] = await Promise.all([
      readPersisted<VaultFile[]>(STORAGE_KEY_FILES),
      readPersisted<VaultFolder[]>(STORAGE_KEY_FOLDERS),
      readPersisted<DriveSyncInfo>(STORAGE_KEY_SYNC_INFO),
    ]);

    // Drop only the legacy dummy/sample entries. Real Drive files AND any
    // locally added files are preserved - the old filter dropped anything
    // that was not source === 'google_drive', silently losing user data.
    filesState = (storedFiles ?? []).filter(
      (f) => f && typeof f.id === 'string' && !f.id.startsWith('doc-')
    );
    foldersState = (storedFolders ?? []).filter(
      (f) => f && typeof f.id === 'string' && !f.id.startsWith('folder-rrb') && !f.id.startsWith('folder-ssc')
    );
    if (storedSync) {
      syncInfoState = { ...syncInfoState, ...storedSync };
    }

    // If we just read from localStorage, copy the data into IndexedDB and
    // drop the localStorage copy so the next load reads from one place.
    if (isIdbSupported()) {
      const migratedFiles = await idbGet<VaultFile[]>(STORAGE_KEY_FILES);
      if (migratedFiles === null || migratedFiles === undefined) {
        await idbSet(STORAGE_KEY_FILES, filesState);
        await idbSet(STORAGE_KEY_FOLDERS, foldersState);
        await idbSet(STORAGE_KEY_SYNC_INFO, syncInfoState);
      }
      try {
        localStorage.removeItem(STORAGE_KEY_FILES);
        localStorage.removeItem(STORAGE_KEY_FOLDERS);
        localStorage.removeItem(STORAGE_KEY_SYNC_INFO);
      } catch {
        /* ignore */
      }
    }
  } catch (error) {
    console.warn('[vault] storage load warning:', error);
  } finally {
    isHydrated = true;
    notifyListeners();
  }
}

const listeners = new Set<() => void>();
function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getFilesSnapshot(): VaultFile[] {
  return filesState;
}

function getFoldersSnapshot(): VaultFolder[] {
  return foldersState;
}

function getSyncInfoSnapshot(): DriveSyncInfo {
  return syncInfoState;
}

function getHydrationSnapshot(): boolean {
  return isHydrated;
}

function getServerHydrationSnapshot(): boolean {
  return false;
}

const SERVER_FILES_SNAPSHOT: VaultFile[] = [];
const SERVER_FOLDERS_SNAPSHOT: VaultFolder[] = [];
const SERVER_SYNC_INFO_SNAPSHOT: DriveSyncInfo = {
  isConnected: false,
  userEmail: null,
  userName: null,
  rootFolderId: 'all',
  rootFolderName: 'Entire Google Drive',
  lastSyncedAt: null,
  isSyncing: false,
  scanMode: 'all',
};

function getServerFilesSnapshot(): VaultFile[] {
  return SERVER_FILES_SNAPSHOT;
}

function getServerFoldersSnapshot(): VaultFolder[] {
  return SERVER_FOLDERS_SNAPSHOT;
}

function getServerSyncInfoSnapshot(): DriveSyncInfo {
  return SERVER_SYNC_INFO_SNAPSHOT;
}

export function useVaultStore() {
  const files = useSyncExternalStore(subscribe, getFilesSnapshot, getServerFilesSnapshot);
  const folders = useSyncExternalStore(subscribe, getFoldersSnapshot, getServerFoldersSnapshot);
  const syncInfo = useSyncExternalStore(subscribe, getSyncInfoSnapshot, getServerSyncInfoSnapshot);

  // Hydration is asynchronous because the index now lives in IndexedDB. The
  // loading gate in the app shell waits for this.
  const isLoaded = useSyncExternalStore(
    subscribe,
    getHydrationSnapshot,
    getServerHydrationSnapshot
  );

  useEffect(() => {
    // Kick off hydration. The store notifies subscribers when it finishes, so
    // there is no state update inside this effect.
    void hydrateStorage();
  }, []);

  // Actions
  const saveFiles = useCallback((newFiles: VaultFile[]) => {
    filesState = newFiles;
    void persist(STORAGE_KEY_FILES, newFiles);
    notifyListeners();
  }, []);

  const saveSyncInfo = useCallback(
    (newSyncInfo: DriveSyncInfo | ((prev: DriveSyncInfo) => DriveSyncInfo)) => {
      syncInfoState =
        typeof newSyncInfo === 'function' ? newSyncInfo(syncInfoState) : newSyncInfo;
      void persist(STORAGE_KEY_SYNC_INFO, syncInfoState);
      notifyListeners();
    },
    []
  );

  const toggleFavorite = useCallback(
    (fileId: string) => {
      const updated = filesState.map((f) =>
        f.id === fileId ? { ...f, isFavorite: !f.isFavorite } : f
      );
      saveFiles(updated);
    },
    [saveFiles]
  );

  const recordOpened = useCallback(
    (fileId: string, pageNumber?: number) => {
      const updated = filesState.map((f) => {
        if (f.id === fileId) {
          return {
            ...f,
            lastOpenedAt: new Date().toISOString(),
            readingProgress:
              typeof pageNumber === 'number' && Number.isFinite(pageNumber)
                ? {
                    currentPage: Math.max(0, pageNumber),
                    totalPages: f.readingProgress?.totalPages || Math.max(1, pageNumber),
                  }
                : f.readingProgress,
          };
        }
        return f;
      });
      saveFiles(updated);
    },
    [saveFiles]
  );

  const updateFileMetadata = useCallback(
    (fileId: string, updates: Partial<VaultFile>) => {
      const updated = filesState.map((f) =>
        f.id === fileId ? { ...f, ...updates } : f
      );
      saveFiles(updated);
    },
    [saveFiles]
  );

  // Add or merge drive files. Never discards local state.
  const addDriveFiles = useCallback(
    (newDriveFiles: VaultFile[], newFolders?: VaultFolder[], replaceAll = false) => {
      let finalFiles: VaultFile[];

      if (replaceAll) {
        finalFiles = newDriveFiles;
      } else {
        const existingById = new Map(filesState.map((f) => [f.id, f]));
        const newIds = new Set(newDriveFiles.map((f) => f.id));

        // Carry local state (favourite, reading progress, last opened, and any
        // user-edited metadata) across a re-sync. Previously the freshly
        // scanned object replaced the stored one wholesale, which silently
        // reset every favourite and every metadata edit on each sync.
        const merged = newDriveFiles.map((incoming) => {
          const existing = existingById.get(incoming.id);
          if (!existing) return incoming;
          return {
            ...incoming,
            isFavorite: existing.isFavorite,
            lastOpenedAt: existing.lastOpenedAt,
            readingProgress: existing.readingProgress,
            category: existing.category || incoming.category,
            subject: existing.subject || incoming.subject,
            topic: existing.topic || incoming.topic,
            exam: existing.exam || incoming.exam,
            year: existing.year ?? incoming.year,
            tags: existing.tags?.length ? existing.tags : incoming.tags,
            description: existing.description || incoming.description,
          };
        });

        // Keep every existing file the scan did not reach, regardless of source.
        const remainingExisting = filesState.filter((f) => !newIds.has(f.id));
        finalFiles = [...merged, ...remainingExisting];
      }
      saveFiles(finalFiles);

      if (newFolders) {
        if (replaceAll) {
          foldersState = newFolders;
        } else {
          const newFolderIds = new Set(newFolders.map((f) => f.id));
          const remainingFolders = foldersState.filter((f) => !newFolderIds.has(f.id));
          foldersState = [...newFolders, ...remainingFolders];
        }
        try {
          if (typeof window !== 'undefined') {
            void persist(STORAGE_KEY_FOLDERS, foldersState);
          }
        } catch (err) {
          console.error(err);
        }
        notifyListeners();
      }
    },
    [saveFiles]
  );

  const clearVault = useCallback(() => {
    filesState = [];
    foldersState = [];
    // Reset the connection state too. Previously the UI kept showing
    // "Connected" and "Sync Drive" against an empty vault.
    syncInfoState = {
      ...syncInfoState,
      isConnected: false,
      userEmail: null,
      userName: null,
      lastSyncedAt: null,
      isSyncing: false,
    };
    if (typeof window !== 'undefined') {
      void persist(STORAGE_KEY_FILES, []);
      void persist(STORAGE_KEY_FOLDERS, []);
      void persist(STORAGE_KEY_SYNC_INFO, syncInfoState);
    }
    notifyListeners();
  }, []);

  // Computed statistics over REAL Drive files
  const stats: LibraryStats = useMemo(() => {
    let totalSizeBytes = 0;
    let pdfCount = 0;
    let sdocxCount = 0;
    let docxCount = 0;
    let otherCount = 0;
    let favoritesCount = 0;
    const exams = new Set<string>();
    const subjects = new Set<string>();

    files.forEach((f) => {
      totalSizeBytes += f.sizeBytes;
      if (f.extension === 'pdf') pdfCount++;
      else if (f.extension === 'sdocx') sdocxCount++;
      else if (f.extension === 'docx' || f.extension === 'doc') docxCount++;
      else otherCount++;

      if (f.isFavorite) favoritesCount++;
      if (f.exam) exams.add(f.exam);
      if (f.subject) subjects.add(f.subject);
    });

    return {
      totalFiles: files.length,
      totalSizeBytes,
      pdfCount,
      sdocxCount,
      docxCount,
      otherCount,
      favoritesCount,
      examsTracked: exams.size,
      subjectsTracked: subjects.size,
    };
  }, [files]);

  // Distinct taxonomy lists for filtering
  const taxonomy = useMemo(() => {
    const exams = new Set<string>();
    const subjects = new Set<string>();
    const topicCounts = new Map<string, number>();
    const years = new Set<number>();
    const tags = new Set<string>();

    files.forEach((f) => {
      if (f.exam && f.exam !== 'General') exams.add(f.exam);
      if (f.subject && f.subject !== 'General Study') subjects.add(f.subject);
      if (f.topic) topicCounts.set(f.topic, (topicCounts.get(f.topic) ?? 0) + 1);
      if (f.year) years.add(f.year);
      f.tags?.forEach((t) => tags.add(t));
    });

    // Topics are derived from file names, so there can be hundreds of them.
    // Only the most common are offered as a filter; the rest stay reachable
    // through the search box.
    const topics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 50)
      .map(([topic]) => topic);

    return {
      exams: Array.from(exams).sort(),
      subjects: Array.from(subjects).sort(),
      topics,
      years: Array.from(years).sort((a, b) => b - a),
      tags: Array.from(tags).sort(),
    };
  }, [files]);

  // Recently opened files
  const recentlyOpened = useMemo(() => {
    return files
      .filter((f) => f.lastOpenedAt)
      .sort((a, b) => new Date(b.lastOpenedAt!).getTime() - new Date(a.lastOpenedAt!).getTime())
      .slice(0, 6);
  }, [files]);

  // Recently added files
  const recentlyAdded = useMemo(() => {
    return [...files]
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
      .slice(0, 6);
  }, [files]);

  return {
    files,
    folders,
    stats,
    taxonomy,
    recentlyOpened,
    recentlyAdded,
    syncInfo,
    isLoaded,
    toggleFavorite,
    recordOpened,
    updateFileMetadata,
    addDriveFiles,
    clearVault,
    saveFiles,
    saveSyncInfo,
  };
}
