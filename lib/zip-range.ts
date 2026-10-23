/**
 * Random access to a ZIP archive that is fetched over HTTP Range requests.
 *
 * A Samsung Notes `.sdocx` file is a ZIP archive, and a single one can be
 * hundreds of megabytes because it embeds the original PDF as a page
 * background. Downloading the whole file to read 0.5 MB of stroke data is
 * wasteful, and the parser used to render it rejects inputs over 250 MiB.
 *
 * The ZIP central directory lives at the end of the file, so the layout can be
 * discovered with two small requests and only the members we actually want can
 * be fetched. This module implements exactly that.
 *
 * All offsets are absolute byte offsets into the original file.
 */

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  localHeaderOffset: number;
  /** Length of the file name as recorded in the central directory. */
  nameLength: number;
}

export interface RangeFetcher {
  /** Fetches bytes [start, end] inclusive. */
  fetchRange(start: number, end: number): Promise<Uint8Array>;
  /** Total size of the remote file in bytes. */
  totalSize: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const EOCD64_LOCATOR_SIGNATURE = 0x07064b50;
const EOCD64_SIGNATURE = 0x06064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const MAX_COMMENT = 0xffff;

/** Reads the End Of Central Directory record, scanning backwards from the end. */
export async function readCentralDirectory(
  fetcher: RangeFetcher
): Promise<{ entries: ZipEntry[]; centralDirectoryOffset: number }> {
  const tailLength = Math.min(fetcher.totalSize, MAX_COMMENT + 22);
  const tailStart = fetcher.totalSize - tailLength;
  const tail = await fetcher.fetchRange(tailStart, fetcher.totalSize - 1);

  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw new Error('Not a ZIP archive: end of central directory record not found.');
  }

  let entryCount = view.getUint16(eocd + 10, true);
  let centralSize = view.getUint32(eocd + 12, true);
  let centralOffset = view.getUint32(eocd + 16, true);

  // ZIP64 fallback for archives larger than 4 GiB or with more than 65535 entries.
  if (centralOffset === 0xffffffff || entryCount === 0xffff) {
    const locator = eocd - 20;
    if (locator >= 0 && view.getUint32(locator, true) === EOCD64_LOCATOR_SIGNATURE) {
      const eocd64Offset = Number(view.getBigUint64(locator + 8, true));
      const eocd64 = await fetcher.fetchRange(eocd64Offset, eocd64Offset + 55);
      const eocd64View = new DataView(
        eocd64.buffer,
        eocd64.byteOffset,
        eocd64.byteLength
      );
      if (eocd64View.getUint32(0, true) === EOCD64_SIGNATURE) {
        entryCount = Number(eocd64View.getBigUint64(32, true));
        centralSize = Number(eocd64View.getBigUint64(40, true));
        centralOffset = Number(eocd64View.getBigUint64(48, true));
      }
    }
  }

  const central = await fetcher.fetchRange(
    centralOffset,
    centralOffset + centralSize - 1
  );
  const centralView = new DataView(central.buffer, central.byteOffset, central.byteLength);
  const decoder = new TextDecoder('utf-8');

  const entries: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < entryCount; i++) {
    if (p + 46 > central.length) break;
    if (centralView.getUint32(p, true) !== CENTRAL_SIGNATURE) break;

    const method = centralView.getUint16(p + 10, true);
    const crc32 = centralView.getUint32(p + 16, true);
    const compressedSize = centralView.getUint32(p + 20, true);
    const uncompressedSize = centralView.getUint32(p + 24, true);
    const nameLength = centralView.getUint16(p + 28, true);
    const extraLength = centralView.getUint16(p + 30, true);
    const commentLength = centralView.getUint16(p + 32, true);
    const localHeaderOffset = centralView.getUint32(p + 42, true);

    const nameBytes = central.subarray(p + 46, p + 46 + nameLength);
    // ZIP general purpose bit 11 marks the name as UTF-8; otherwise CP437.
    const utf8 = (centralView.getUint16(p + 8, true) & 0x800) !== 0;
    const name = utf8 ? decoder.decode(nameBytes) : decodeCp437(nameBytes);

    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      crc32,
      localHeaderOffset,
      nameLength,
    });

    p += 46 + nameLength + extraLength + commentLength;
  }

  return { entries, centralDirectoryOffset: centralOffset };
}

/**
 * Resolves where a member's compressed data actually starts, by reading its
 * local file header. The extra field length in the local header may differ
 * from the central directory, so it must be read rather than assumed.
 */
function dataStartInLocalHeader(
  local: Uint8Array,
  entry: ZipEntry
): { dataStart: number; dataLength: number } {
  const view = new DataView(local.buffer, local.byteOffset, local.byteLength);
  if (view.getUint32(0, true) !== LOCAL_SIGNATURE) {
    throw new Error(`Corrupt local file header for "${entry.name}".`);
  }
  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const dataStart = 30 + nameLength + extraLength;
  return { dataStart, dataLength: entry.compressedSize };
}

/** Inflates a raw deflate stream. */
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const { inflateRaw } = await import('node:zlib');
  return new Promise((resolve, reject) => {
    inflateRaw(data, (err, result) => {
      if (err) reject(err);
      else resolve(new Uint8Array(result.buffer, result.byteOffset, result.length));
    });
  });
}

/** Merges a list of [start, end] ranges into the smallest set of fetches. */
function mergeRanges(
  ranges: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 1) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Extracts the named members without downloading the rest of the archive.
 *
 * For each member the byte range covering its local header plus its compressed
 * data is computed, the ranges are merged, and only the merged ranges are
 * fetched. A `.sdocx` with one huge embedded PDF therefore typically needs two
 * requests instead of transferring the whole archive.
 */
export async function extractMembers(
  fetcher: RangeFetcher,
  entries: ZipEntry[],
  shouldInclude: (entry: ZipEntry) => boolean
): Promise<Map<string, Uint8Array>> {
  const wanted = entries.filter(shouldInclude);
  if (wanted.length === 0) return new Map();

  // The local header repeats the file name, so the central directory's name
  // length is a reliable upper bound for the fixed part of the header. The
  // local extra field may differ from the central one, so a generous margin
  // is added and the exact data start is read from the header afterwards.
  const LOCAL_EXTRA_MARGIN = 1024;

  const memberRanges = wanted.map((entry) => {
    const start = entry.localHeaderOffset;
    const end = Math.min(
      fetcher.totalSize - 1,
      start + 30 + entry.nameLength + LOCAL_EXTRA_MARGIN + entry.compressedSize
    );
    return { start, end };
  });

  const groups = mergeRanges(memberRanges);

  const buffers: Array<{ base: number; data: Uint8Array }> = [];
  for (const group of groups) {
    const data = await fetcher.fetchRange(group.start, group.end);
    buffers.push({ base: group.start, data });
  }

  const result = new Map<string, Uint8Array>();
  for (const entry of wanted) {
    const container = buffers.find(
      (b) =>
        entry.localHeaderOffset >= b.base &&
        entry.localHeaderOffset < b.base + b.data.length
    );
    if (!container) {
      throw new Error(`Could not locate member "${entry.name}" in the fetched ranges.`);
    }

    const localStart = entry.localHeaderOffset - container.base;
    const local = container.data.subarray(localStart);
    const { dataStart, dataLength } = dataStartInLocalHeader(local, entry);
    const raw = local.subarray(dataStart, dataStart + dataLength);

    if (raw.length < dataLength) {
      throw new Error(`Member "${entry.name}" was truncated by the range request.`);
    }

    if (entry.method === 0) {
      result.set(entry.name, raw.slice());
    } else if (entry.method === 8) {
      result.set(entry.name, await inflateRaw(raw));
    } else {
      throw new Error(
        `Member "${entry.name}" uses unsupported compression method ${entry.method}.`
      );
    }
  }

  return result;
}

/**
 * Computes the absolute byte range in the original file that holds a stored
 * (uncompressed) member's data. Used to serve an embedded PDF with working
 * Range requests without downloading it.
 */
export async function locateStoredMemberData(
  fetcher: RangeFetcher,
  entry: ZipEntry
): Promise<{ start: number; end: number }> {
  const headerEnd = Math.min(entry.localHeaderOffset + 512 - 1, fetcher.totalSize - 1);
  const local = await fetcher.fetchRange(entry.localHeaderOffset, headerEnd);
  const { dataStart } = dataStartInLocalHeader(local, entry);
  const start = entry.localHeaderOffset + dataStart;
  return { start, end: start + entry.compressedSize - 1 };
}

/** Minimal CP437 decoder for legacy ZIP filenames. */
function decodeCp437(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += String.fromCharCode(b);
  }
  return out;
}
