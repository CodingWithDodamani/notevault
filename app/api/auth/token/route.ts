import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server-auth';
import { getDocument, putDocument } from '@/lib/firestore-rest';
import firebaseConfig from '@/firebase-applet-config.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-side storage for the long-lived Google OAuth refresh token.
 *
 * The short-lived Google *access* token always lives in browser memory only.
 * The refresh token is long-lived and would be a serious liability in
 * localStorage, so it is stored server-side in Firestore under the owning
 * user's document and protected by Firestore security rules.
 *
 * Requires:
 *  - Firestore enabled on the project
 *  - `firestore.rules` deployed (see the README section "Drive token storage")
 */

const TOKEN_DOC = (uid: string) => `users/${uid}/tokens`;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

type Action = 'store' | 'refresh' | 'clear';

interface Body {
  action?: Action;
  refreshToken?: string;
}

export async function POST(req: NextRequest) {
  const authResult = await authenticate(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { uid } = authResult.user;
  const idToken = authResult.idToken;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const action: Action = body.action ?? 'refresh';

  try {
    if (action === 'store') {
      const refreshToken = body.refreshToken;
      if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.length < 20) {
        return NextResponse.json({ error: 'A valid refreshToken is required.' }, { status: 400 });
      }

      await putDocument(
        TOKEN_DOC(uid),
        {
          refreshToken,
          scopes: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly',
          updatedAt: new Date().toISOString(),
        },
        idToken
      );

      return NextResponse.json({ ok: true, stored: true });
    }

    if (action === 'clear') {
      await putDocument(TOKEN_DOC(uid), { refreshToken: '' }, idToken);
      return NextResponse.json({ ok: true, stored: false });
    }

    // action === 'refresh'
    const stored = await getDocument(TOKEN_DOC(uid), idToken);
    const refreshToken = stored?.refreshToken;
    if (!refreshToken || typeof refreshToken !== 'string' || !refreshToken) {
      return NextResponse.json(
        { error: 'no-stored-token', message: 'No stored Drive session for this account.' },
        { status: 404 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || firebaseConfig.oAuthClientId;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    const tokenBody = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });
    if (clientSecret) {
      tokenBody.set('client_secret', clientSecret);
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => '');
      console.error('[auth] Google token refresh failed:', tokenRes.status, detail.slice(0, 200));
      return NextResponse.json(
        {
          error: 'refresh-failed',
          message:
            'The stored Google session could not be renewed. Please sign in again.',
        },
        { status: 401 }
      );
    }

    const tokenData = await tokenRes.json();
    return NextResponse.json({
      ok: true,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in ?? 3600,
      scope: tokenData.scope ?? null,
    });
  } catch (error) {
    console.error('[auth] token route error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const looksLikeMissingFirestore =
      message.includes('Firestore') || message.includes('404') || message.includes('403');
    return NextResponse.json(
      {
        error: 'token-store-unavailable',
        message: looksLikeMissingFirestore
          ? 'Drive session storage is not available. Enable Firestore and deploy firestore.rules to enable automatic reconnection.'
          : 'Could not complete the Drive session request.',
      },
      { status: 503 }
    );
  }
}
