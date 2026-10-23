/**
 * Shared between the client and the server so the header name is defined once.
 * Kept in its own module because `lib/server-auth.ts` pulls in `firebase-admin`,
 * which must never be bundled for the browser.
 */
export const ID_TOKEN_HEADER = 'x-notevault-id-token';
