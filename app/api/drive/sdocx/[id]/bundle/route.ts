import { NextRequest, NextResponse } from 'next/server';
import { zipSync } from 'fflate';
import {
  authenticate,
  assertValidDriveId,
  loadSdocxContext,
  extractMembers,
  MAX_MEMBER_BYTES,
} from '@/lib/sdocx-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Produces a "slim" Samsung Notes archive.
 *
 * A `.sdocx` is a ZIP archive. When a note embeds a PDF as its page background
 * the archive can be hundreds of megabytes, but the note's own stroke and text
 * data is typically under a megabyte. This route reads the ZIP central
 * directory over HTTP Range requests, pulls only the small members, and
 * rebuilds a compact archive that the renderer can parse.
 *
 * The oversized member (the embedded PDF) is deliberately left out: it is
 * served separately by the /media route with working Range support, so
 * pdf.js can stream just the pages it needs.
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

    const ctx = await loadSdocxContext(req, id);

    const members = await extractMembers(
      ctx.fetcher,
      ctx.entries,
      (entry) => entry.uncompressedSize <= MAX_MEMBER_BYTES
    );

    if (members.size === 0) {
      return NextResponse.json(
        { error: 'This file does not look like a Samsung Notes archive.' },
        { status: 422 }
      );
    }

    // Rebuild a compact archive. The Samsung end-tag record is re-appended
    // after the ZIP end-of-central-directory because the native parser treats
    // that trailing copy as authoritative.
    const files: Record<string, Uint8Array> = {};
    for (const [name, data] of members) {
      files[name] = data;
    }

    const zip = zipSync(files, { level: 6 });
    const endTag = members.get('end_tag.bin');
    const payload = new Uint8Array(zip.length + (endTag ? endTag.length : 0));
    payload.set(zip, 0);
    if (endTag) payload.set(endTag, zip.length);

    const excluded = ctx.entries
      .filter((e) => e.uncompressedSize > MAX_MEMBER_BYTES)
      .map((e) => ({ path: e.name, size: e.uncompressedSize }));

    return new NextResponse(Buffer.from(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(payload.length),
        'Cache-Control': 'no-store',
        'X-Sdocx-Page-Data-Bytes': String(payload.length),
        'X-Sdocx-Excluded': JSON.stringify(excluded),
      },
    });
  } catch (error) {
    const status = (error as { status?: number })?.status ?? 500;
    console.error('[sdocx/bundle] failed:', error);
    if (status >= 500) {
      return NextResponse.json(
        { error: 'Could not read this Samsung Notes file from Google Drive.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read the file.' },
      { status }
    );
  }
}
