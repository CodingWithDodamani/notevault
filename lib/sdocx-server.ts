import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server-auth';
import {
  readCentralDirectory,
  extractMembers,
  locateStoredMemberData,
  type RangeFetcher,
  type ZipEntry,
} from '@/lib/zip-range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Members larger than this are excluded from the "slim" bundle. A Samsung
 * Notes note that embeds a PDF as its page background can easily be hundreds
 * of megabytes, and the renderer refuses inputs over 250 MiB.
 */
export const MAX_MEMBER_BYTES = 4 * 1024 * 1024;

const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface SdocxContext {
  id: string;
  token: string;
  fetcher: RangeFetcher;
  entries: ZipEntry[];
}

/**
 * Builds a range fetcher over the Google Drive copy of a `.sdocx`, plus the
 * ZIP central directory so callers can decide what to pull.
 */
export async function loadSdocxContext(req: NextRequest, id: string): Promise<SdocxContext> {
  const token = req.headers.get('Authorization') ?? '';
  if (!token) {
    throw Object.assign(new Error('Missing Google OAuth Bearer token'), { status: 401 });
  }

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType`,
    { headers: { Authorization: token } }
  );
  if (!metaRes.ok) {
    throw Object.assign(new Error(`Google Drive metadata error ${metaRes.status}`), {
      status: metaRes.status,
    });
  }
  const meta = await metaRes.json();
  const totalSize = Number(meta?.size ?? 0);
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    throw Object.assign(new Error('Could not determine the size of the Drive file.'), {
      status: 502,
    });
  }

  const fetcher: RangeFetcher = {
    totalSize,
    async fetchRange(start: number, end: number): Promise<Uint8Array> {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
        {
          headers: {
            Authorization: token,
            Range: `bytes=${start}-${end}`,
          },
        }
      );
      if (res.status !== 206 && res.status !== 200) {
        const detail = await res.text().catch(() => '');
        throw new Error(
          `Google Drive range request failed (${res.status}): ${detail.slice(0, 200)}`
        );
      }
      const buffer = new Uint8Array(await res.arrayBuffer());
      if (res.status === 200) {
        // The upstream ignored the Range header and sent the whole file.
        return buffer.subarray(start, end + 1);
      }
      return buffer;
    },
  };

  const { entries } = await readCentralDirectory(fetcher);
  return { id, token, fetcher, entries };
}

export function assertValidDriveId(id: string): void {
  if (!DRIVE_ID_PATTERN.test(id)) {
    throw Object.assign(new Error('Invalid file id'), { status: 400 });
  }
}

export { authenticate, extractMembers, locateStoredMemberData };
export type { ZipEntry, RangeFetcher };
