import { getIdToken } from './client-auth';
import { ID_TOKEN_HEADER } from './auth-constants';

/**
 * `fetch` wrapper that attaches the Firebase ID token to every call.
 *
 * The server requires it on the AI and Drive endpoints so that spending can be
 * attributed to a user and rate-limited. A missing token surfaces as a 401
 * from the server, which the caller surfaces to the user.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const idToken = await getIdToken();
  if (idToken) {
    headers.set(ID_TOKEN_HEADER, idToken);
  }
  return fetch(input, { ...init, headers });
}

/**
 * Parses a JSON error body from the API and produces a message worth showing
 * a user. The server no longer leaks internal error text, so a non-JSON body
 * means something went wrong upstream.
 */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === 'string' && data.error.trim()) {
      return data.error;
    }
  } catch {
    // not JSON
  }
  return fallback;
}
