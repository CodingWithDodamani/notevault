import { NextRequest, NextResponse } from 'next/server';
import {
  authenticate,
  assertValidDriveId,
  loadSdocxContext,
  locateStoredMemberData,
  extractMembers,
  MAX_MEMBER_BYTES,
} from '@/lib/sdocx-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Streams a single member out of a `.sdocx` archive.
 *
 * When the member is stored uncompressed (the common case for the embedded
 * PDF that forms a note's page background) its bytes map one-to-one onto the
 * original file, so Range requests pass straight through and pdf.js can load
 * a 267 MB PDF a page at a time without ever downloading it in full.
 *
 * Deflated members have to be decompressed as a whole, so they are served
 * without Range support.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticate(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    assertValidDriveId(id);

    const requestedPath = new URL(req.url).searchParams.get('path');
    if (!requestedPath) {
      return NextResponse.json({ error: 'A "path" query parameter is required.' }, { status: 400 });
    }
    if (requestedPath.includes('..') || requestedPath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
    }

    const ctx = await loadSdocxContext(req, id);
    const entry = ctx.entries.find((e) => e.name === requestedPath);
    if (!entry) {
      return NextResponse.json({ error: 'That member does not exist in this archive.' }, { status: 404 });
    }

    const contentType = mediaContentType(entry.name);

    // Stored member: byte ranges map directly onto the Drive file.
    if (entry.method === 0) {
      const { start, end } = await locateStoredMemberData(ctx.fetcher, entry);
      const total = end - start + 1;

      const rangeHeader = req.headers.get('Range');
      let from = 0;
      let to = total - 1;
      let status = 200;

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        if (match) {
          if (match[1]) from = parseInt(match[1], 10);
          if (match[2]) to = Math.min(total - 1, parseInt(match[2], 10));
          if (from > to || from >= total) {
            return new NextResponse(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${total}` },
            });
          }
          status = 206;
        }
      }

      const data = await ctx.fetcher.fetchRange(start + from, start + to);
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
      };
      if (status === 206) {
        headers['Content-Range'] = `bytes ${from}-${to}/${total}`;
      }
      return new NextResponse(Buffer.from(data), { status, headers });
    }

    // Deflated member: fetch and inflate in full, then serve without ranges.
    const members = await extractMembers(
      ctx.fetcher,
      ctx.entries,
      (e) => e.name === requestedPath && e.uncompressedSize <= MAX_MEMBER_BYTES
    );
    const data = members.get(requestedPath);
    if (!data) {
      return NextResponse.json(
        { error: 'This media member is too large to extract in one piece.' },
        { status: 413 }
      );
    }
    return new NextResponse(Buffer.from(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const status = (error as { status?: number })?.status ?? 500;
    console.error('[sdocx/media] failed:', error);
    return NextResponse.json(
      { error: 'Could not read that member from the Samsung Notes archive.' },
      { status: status >= 500 ? 500 : status }
    );
  }
}

function mediaContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}
