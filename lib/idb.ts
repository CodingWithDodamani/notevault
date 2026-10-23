'use client';

/**
 * A very small IndexedDB key/value store.
 *
 * The vault index is metadata for every file in a Drive that can hold
 * thousands of items. localStorage caps out around 5 MB, and a quota failure
 * there silently discards the write, which previously meant a user's index
 * could vanish without any error. IndexedDB has no such practical ceiling.
 *
 * The API is deliberately identical to the localStorage calls it replaces, so
 * the store does not have to care which backend is in use.
 */

const DB_NAME = 'notevault';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;
let idbAvailable = true;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab.'));
  }).catch((error) => {
    idbAvailable = false;
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = work(tx.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
      })
  );
}

export function isIdbSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (!isIdbSupported()) return null;
  const value = await runTransaction<T | undefined>('readonly', (store) => store.get(key));
  return (value ?? null) as T | null;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (!isIdbSupported()) throw new Error('IndexedDB is not available in this environment.');
  await runTransaction('readwrite', (store) => store.put(value, key));
}

export async function idbDelete(key: string): Promise<void> {
  if (!isIdbSupported()) return;
  await runTransaction('readwrite', (store) => store.delete(key));
}

export async function idbKeys(): Promise<string[]> {
  if (!isIdbSupported()) return [];
  const keys = await runTransaction<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  return keys.map(String);
}
