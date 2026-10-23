import { FIREBASE_PROJECT_ID } from './server-auth';

/**
 * Minimal Firestore REST client.
 *
 * Deliberately avoids the `firebase-admin` Firestore SDK, which would require a
 * service account and extra Cloud Run IAM roles. Instead the user's own
 * Firebase ID token is used as the bearer credential, so Firestore's security
 * rules apply exactly as they would for the browser. That means Cloud Run needs
 * no additional setup beyond enabling Firestore and deploying `firestore.rules`.
 */

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export interface StoredDriveToken {
  refreshToken: string;
  scopes?: string;
  updatedAt?: string;
}

function documentUrl(path: string) {
  return `${FIRESTORE_BASE}/${path}`;
}

function encodeValue(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value === null || value === undefined) return { nullValue: null };
  return { stringValue: String(value) };
}

/**
 * Writes (or patches) a document. Firestore REST requires a field mask for
 * PATCH; we always send the full field set we manage, so `updateMask` lists
 * every field.
 */
export async function putDocument(
  path: string,
  fields: Record<string, unknown>,
  idToken: string
): Promise<void> {
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, encodeValue(v)])
    ),
  };

  const url = `${documentUrl(path)}?updateMask.fieldPaths=${Object.keys(fields).join(',')}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore write failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

export async function getDocument(
  path: string,
  idToken: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(documentUrl(path), {
    headers: { Authorization: `Bearer ${idToken}` },
    method: 'GET',
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore read failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const fields = (data?.fields ?? {}) as Record<string, { stringValue?: string }>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v && typeof v === 'object' && 'stringValue' in v) out[k] = v.stringValue;
  }
  return out;
}
