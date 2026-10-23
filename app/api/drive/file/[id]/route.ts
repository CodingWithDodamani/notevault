import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Streaming proxy for a Google Drive file.
 *
 * The browser cannot talk to the Drive API directly because the OAuth token
 * lives in memory on the client and CORS would block it anyway. This route
 * forwards the caller's own token to Drive and streams the response back.
 *
 * Range requests are supported end to end, which is what lets pdf.js load a
 * large PDF incrementally instead of downloading the whole file.
 */

const PASS_THROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'content-disposition',
  'etag',
  'last-modified',
] as const;

const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticate(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const { id } = await params;
  if (!DRIVE_ID_PATTERN.test(id)) {
    return new Response('Invalid file id', { status: 400 });
  }

  const token = req.headers.get('Authorization');
  if (!token) {
    return new Response('Missing Google OAuth Bearer token', { status: 401 });
  }

  const upstreamHeaders: Record<string, string> = { Authorization: token };
  const range = req.headers.get('Range');
  if (range) {
    upstreamHeaders.Range = range;
  }

  try {
    const upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
      { headers: upstreamHeaders, redirect: 'follow' }
    );

    if (!upstream.ok && upstream.status !== 206) {
      const detail = await upstream.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: `Google Drive error ${upstream.status}`, detail: detail.slice(0, 300) }),
        { status: upstream.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const headers = new Headers();
    for (const name of PASS_THROUGH_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has('accept-ranges')) {
      headers.set('accept-ranges', 'bytes');
    }
    headers.set('cache-control', 'private, no-store');

    // `upstream.body` is a ReadableStream. Passing it straight through keeps
    // the response streaming. The status must be forwarded explicitly or a
    // 206 becomes a 200 and the client treats a partial body as the whole file.
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error('[drive/file] streaming failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to stream file from Google Drive.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
