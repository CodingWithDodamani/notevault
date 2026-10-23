import { auth } from './firebase';

/**
 * Returns a fresh Firebase ID token for the signed-in user.
 *
 * This is the credential the server uses to authorise requests to the paid AI
 * endpoints. It is distinct from the Google OAuth access token used for the
 * Drive API.
 */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('[auth] failed to obtain ID token:', error);
    return null;
  }
}

/**
 * True when the user has a usable Firebase session, even if the Google Drive
 * OAuth token has been lost (which is the normal state after a page reload).
 */
export function isSignedIn(): boolean {
  return auth.currentUser !== null;
}
