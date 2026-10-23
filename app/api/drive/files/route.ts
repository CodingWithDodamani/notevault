import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server-auth';

interface GoogleDriveRawItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  thumbnailLink?: string;
  iconLink?: string;
}

/** Google Drive file ids are opaque but always match this shape. Validating
 *  before interpolating into the Drive `q` query language prevents query
 *  injection through the folderId parameter. */
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Hard cap on how much of a Drive we will index in one scan. */
const MAX_PAGES = 10; // 10 pages x 1000 = 10,000 files
const PAGE_SIZE = 1000;

const DRIVE_FILE_FIELDS =
  'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, parents, thumbnailLink, iconLink)';

/** Escapes a value for safe interpolation into a Drive `q` string literal. */
function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function GET(req: NextRequest) {
  // The Google OAuth token proves Drive access but says nothing about *which*
  // user is spending our server resources, so we also require a Firebase ID
  // token on this route.
  const authResult = await authenticate(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const token = req.headers.get('Authorization');
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing Google OAuth Bearer token in Authorization header' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get('folderId') || 'all';
  const query = searchParams.get('q');
  const typeFilter = searchParams.get('type'); // 'pdf' | 'sdocx' | 'all'
  const modifiedSince = searchParams.get('modifiedSince');

  if (folderId !== 'all' && !DRIVE_ID_PATTERN.test(folderId)) {
    return NextResponse.json(
      { error: 'Invalid folderId. Expected a Google Drive folder id.' },
      { status: 400 }
    );
  }

  if (modifiedSince && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(modifiedSince)) {
    return NextResponse.json(
      { error: 'Invalid modifiedSince. Expected an RFC3339 timestamp.' },
      { status: 400 }
    );
  }

  // Construct Google Drive API query:
  // If folderId is 'all', scan across the user's entire Drive so all subfolders/notes/PDFs are found
  let q = 'trashed = false';

  if (folderId !== 'all') {
    q += ` and '${escapeDriveQueryValue(folderId)}' in parents`;
  }

  if (query && query.trim()) {
    const sanitized = query.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    q += ` and name contains '${sanitized}'`;
  }

  if (typeFilter === 'pdf') {
    q += ` and (mimeType = 'application/pdf' or name contains '.pdf')`;
  } else if (typeFilter === 'sdocx') {
    q += ` and name contains '.sdocx'`;
  }

  if (modifiedSince) {
    q += ` and modifiedTime > '${escapeDriveQueryValue(modifiedSince)}'`;
  }

  const rawItems: GoogleDriveRawItem[] = [];
  let nextPageToken: string | null = null;
  let truncated = false;

  try {
    // Page through the whole Drive server-side. The client used to stop after
    // the first page (1000 items) and then *replace* the local index, which
    // silently destroyed everything that did not fit.
    for (let page = 0; page < MAX_PAGES; page++) {
      const driveUrl = new URL('https://www.googleapis.com/drive/v3/files');
      driveUrl.searchParams.set('q', q);
      driveUrl.searchParams.set('pageSize', String(PAGE_SIZE));
      driveUrl.searchParams.set('orderBy', 'modifiedTime desc');
      driveUrl.searchParams.set('fields', DRIVE_FILE_FIELDS);
      if (nextPageToken) {
        driveUrl.searchParams.set('pageToken', nextPageToken);
      }

      const res = await fetch(driveUrl.toString(), {
        headers: {
          Authorization: token,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: `Google Drive API error (${res.status}): ${errText}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      const items: GoogleDriveRawItem[] = data.files || [];
      rawItems.push(...items);

      nextPageToken = data.nextPageToken || null;
      if (!nextPageToken) break;
      if (page === MAX_PAGES - 1) {
        truncated = true;
        console.warn(
          `[drive] scan hit the ${MAX_PAGES * PAGE_SIZE} file cap; the index is incomplete.`
        );
      }
    }

    const mappedFolders: Array<{
      id: string;
      name: string;
      parentId: string | null;
      path: string;
      fileCount: number;
      totalSizeBytes: number;
    }> = [];

    const mappedFiles: any[] = [];

    rawItems.forEach((item) => {
      const isFolder = item.mimeType === 'application/vnd.google-apps.folder';

      if (isFolder) {
        mappedFolders.push({
          id: item.id,
          name: item.name,
          parentId: item.parents?.[0] || null,
          path: item.name,
          fileCount: 0,
          totalSizeBytes: 0,
        });
        return;
      }

      // Check if file is a Samsung Note, PDF, DOCX, etc.
      const lowerName = item.name.toLowerCase();
      let ext = lowerName.split('.').pop() || '';
      const isSdocx = lowerName.endsWith('.sdocx') || lowerName.includes('.sdocx');
      const isPdf = lowerName.endsWith('.pdf') || item.mimeType === 'application/pdf';

      if (isSdocx) {
        ext = 'sdocx';
      } else if (isPdf) {
        ext = 'pdf';
      } else if (item.mimeType === 'application/vnd.google-apps.document') {
        ext = 'gdoc';
      } else if (item.mimeType === 'application/vnd.google-apps.presentation') {
        ext = 'gslides';
      } else if (item.mimeType === 'application/vnd.google-apps.spreadsheet') {
        ext = 'gsheet';
      }

      const sizeBytes = item.size ? parseInt(item.size, 10) : 0;
      const webViewLink = item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`;
      const downloadUrl =
        item.webContentLink || `https://drive.google.com/uc?export=download&id=${item.id}`;

      mappedFiles.push({
        id: item.id,
        name: item.name,
        mimeType: isSdocx ? 'application/samsung-note' : item.mimeType,
        extension: ext,
        sizeBytes,
        folderId: item.parents?.[0] || 'root',
        folderPath: 'Google Drive',
        category: isSdocx
          ? 'Samsung Note'
          : isPdf
          ? inferCategory(item.name, 'pdf')
          : inferCategory(item.name, ext),
        subject: inferSubject(item.name),
        topic: inferTopic(item.name),
        exam: inferExam(item.name),
        year: inferYear(item.name),
        tags: generateInitialTags(item.name, ext),
        description: `Original file in Google Drive (${item.name})`,
        isFavorite: false,
        lastOpenedAt: null,
        webViewLink,
        downloadUrl,
        createdTime: item.createdTime || new Date().toISOString(),
        modifiedTime: item.modifiedTime || new Date().toISOString(),
        indexedAt: new Date().toISOString(),
        syncStatus: 'synced',
        source: 'google_drive',
      });
    });

    return NextResponse.json({
      files: mappedFiles,
      folders: mappedFolders,
      nextPageToken: null,
      truncated,
      totalCount: mappedFiles.length,
      scannedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Failed to query Google Drive:', error);
    return NextResponse.json(
      { error: 'Internal server error while querying Google Drive' },
      { status: 500 }
    );
  }
}

function inferCategory(name: string, ext: string): string {
  const lower = name.toLowerCase();
  if (ext === 'sdocx' || lower.includes('.sdocx')) return 'Samsung Note';
  if (lower.includes('pyq') || lower.includes('question') || lower.includes('paper') || lower.includes('test')) return 'Question Bank';
  if (lower.includes('formula') || lower.includes('shortcut') || lower.includes('cheat')) return 'Formula Sheet';
  if (lower.includes('book') || lower.includes('ncert') || lower.includes('module')) return 'Textbook';
  if (lower.includes('handwritten') || lower.includes('class note') || lower.includes('lecture')) return 'Class Notes';
  return 'Study Notes';
}

function inferSubject(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('math') || lower.includes('quant') || lower.includes('trigo') || lower.includes('percentage') || lower.includes('algebra') || lower.includes('arithmetic') || lower.includes('geometry') || lower.includes('calculus')) {
    return 'Mathematics';
  }
  if (lower.includes('reason') || lower.includes('puzzle') || lower.includes('seating') || lower.includes('syllogism') || lower.includes('coding') || lower.includes('analogy')) {
    return 'Reasoning';
  }
  if (lower.includes('bio') || lower.includes('cell') || lower.includes('genetics') || lower.includes('botany') || lower.includes('zoology') || lower.includes('enzyme') || lower.includes('physio')) {
    return 'General Science';
  }
  if (lower.includes('chem') || lower.includes('organic') || lower.includes('bonding') || lower.includes('periodic') || lower.includes('reaction')) {
    return 'General Science';
  }
  if (lower.includes('physic') || lower.includes('kinematics') || lower.includes('mechanics') || lower.includes('optic') || lower.includes('thermo')) {
    return 'General Science';
  }
  if (lower.includes('polity') || lower.includes('constitution') || lower.includes('history') || lower.includes('geography') || lower.includes('economy') || lower.includes('current')) {
    return 'General Awareness';
  }
  if (lower.includes('english') || lower.includes('vocab') || lower.includes('grammar') || lower.includes('comprehension')) {
    return 'English';
  }
  if (lower.includes('computer') || lower.includes('it') || lower.includes('software') || lower.includes('code') || lower.includes('python')) {
    return 'Computer Science';
  }
  return 'General Study';
}

function inferTopic(name: string): string {
  const clean = name.replace(/\.[^/.]+$/, '').replace(/[_\-\.]+/g, ' ').trim();
  return clean.slice(0, 48) || 'Study Document';
}

function inferExam(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('rrb') || lower.includes('ntpc') || lower.includes('railway') || lower.includes('group d') || lower.includes('alp')) return 'RRB NTPC';
  if (lower.includes('ssc') || lower.includes('cgl') || lower.includes('chsl') || lower.includes('mts')) return 'SSC CGL';
  if (lower.includes('upsc') || lower.includes('ias') || lower.includes('ips') || lower.includes('civil services')) return 'UPSC';
  if (lower.includes('bank') || lower.includes('ibps') || lower.includes('sbi') || lower.includes('po') || lower.includes('clerk')) return 'Banking';
  if (lower.includes('neet') || lower.includes('medical') || lower.includes('aiims')) return 'NEET';
  if (lower.includes('jee') || lower.includes('gate') || lower.includes('engineering')) return 'Engineering';
  return 'General';
}

function inferYear(name: string): number | null {
  const match = name.match(/\b(201\d|202\d)\b/);
  return match ? parseInt(match[1], 10) : null;
}

function generateInitialTags(name: string, ext: string): string[] {
  const tags: string[] = [];
  if (ext) tags.push(`#${ext}`);
  const lower = name.toLowerCase();
  if (lower.includes('rrb')) tags.push('#rrb');
  if (lower.includes('ssc')) tags.push('#ssc');
  if (lower.includes('math')) tags.push('#maths');
  if (lower.includes('science')) tags.push('#science');
  if (lower.includes('formula')) tags.push('#formula');
  if (lower.includes('pyq')) tags.push('#pyq');
  if (lower.includes('sdocx')) tags.push('#samsung_notes');
  return tags;
}
