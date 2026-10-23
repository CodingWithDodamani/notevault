import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App safely (avoid duplicate initialization)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
// Request offline access so Google issues a long-lived refresh token, which
// lets the server mint a fresh access token after a page reload.
provider.setCustomParameters({
  access_type: 'offline',
  prompt: 'consent',
  include_granted_scopes: 'true',
});

// In-memory token cache (never stored in localStorage or sessionStorage per security skill)
let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token not in memory; the caller can try a silent restore.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      cachedRefreshToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
  refreshToken: string | null;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Auth credential');
    }

    // `credentialFromResult` is typed as the generic OAuthCredential, but for a
    // Google provider the runtime object also carries `refreshToken` when
    // offline access was granted.
    const googleCredential = credential as typeof credential & { refreshToken?: string };

    cachedAccessToken = credential.accessToken;
    cachedRefreshToken = googleCredential.refreshToken ?? null;
    return { user: result.user, accessToken: cachedAccessToken, refreshToken: cachedRefreshToken };
  } catch (error: unknown) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setManualAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getRefreshToken = (): string | null => cachedRefreshToken;

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedRefreshToken = null;
};
