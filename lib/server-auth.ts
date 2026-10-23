import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { ID_TOKEN_HEADER } from './auth-constants';

/**
 * Server-side authentication for the paid AI endpoints.
 *
 * The Google OAuth access token (Drive scope) is NOT an identity token for our
 * own app - anyone can present one. The Firebase ID token is, so every request
 * that spends money on the Gemini API must carry it.
 *
 * Only a projectId is required to verify ID tokens: firebase-admin validates the
 * RS256 signature against Google's published public certificates, so no service
 * account and no GOOGLE_APPLICATION_CREDENTIALS are required. This keeps the
 * app deployable to Cloud Run with zero extra IAM setup.
 */

export const FIREBASE_PROJECT_ID: string = firebaseConfig.projectId;

/** Header carrying the Firebase ID token. Kept separate from `Authorization`,
 *  which is reserved for the Google OAuth token used against the Drive API. */
export { ID_TOKEN_HEADER };

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
}

export type AuthResult =
  | { ok: true; user: AuthUser; idToken: string }
  | { ok: false; response: NextResponse };

let authInstance: ReturnType<typeof getAuth> | null = null;

function getAdminAuth() {
  if (authInstance) return authInstance;
  if (!FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID is not configured');
  }
  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: FIREBASE_PROJECT_ID });
  authInstance = getAuth(app);
  return authInstance;
}

/**
 * Verifies the Firebase ID token on the request.
 * Fails closed: if we cannot verify, the request is denied.
 */
export async function authenticate(req: Request): Promise<AuthResult> {
  const token = req.headers.get(ID_TOKEN_HEADER);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: missing Firebase ID token.' },
        { status: 401 }
      ),
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    return {
      ok: true,
      idToken: token,
      user: {
        uid: decoded.uid,
        email: typeof decoded.email === 'string' ? decoded.email : null,
        name: typeof decoded.name === 'string' ? decoded.name : null,
      },
    };
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'unknown';
    console.error('[auth] ID token verification failed:', code, (error as Error)?.message);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: invalid or expired session. Please sign in again.' },
        { status: 401 }
      ),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Per-user quota                                                      */
/* ------------------------------------------------------------------ */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

/**
 * Fixed-window per-user rate limit.
 *
 * In-memory on purpose: this is a single-user personal applet, and the bucket
 * resets on cold start (which only ever grants the user *more* room, never
 * less). A multi-instance deployment would need a shared store such as
 * Firestore or Redis.
 */
export function checkQuota(uid: string, limit = 60, windowMs = 60 * 60 * 1000): QuotaResult {
  const now = Date.now();
  const existing = buckets.get(uid);

  if (!existing || existing.resetAt <= now) {
    const fresh: Bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(uid, fresh);
    return { allowed: true, remaining: limit, limit, resetAt: fresh.resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, limit, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, limit, resetAt: existing.resetAt };
}

export function quotaHeaders(result: QuotaResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
