export type FileTypeCategory = 'pdf' | 'docx' | 'sdocx' | 'presentation' | 'spreadsheet' | 'image' | 'archive' | 'text' | 'other';

export interface VaultFile {
  id: string;
  name: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  folderId: string;
  folderPath: string;
  category: string; // e.g., 'Exam Notes', 'Question Bank', 'Formula Sheet', 'Textbook'
  subject: string;  // e.g., 'Mathematics', 'Reasoning', 'General Science', 'General Awareness'
  topic: string;    // e.g., 'Percentage', 'Seating Arrangement', 'Cell Biology'
  exam: string;     // e.g., 'RRB NTPC', 'SSC CGL', 'UPSC', 'Banking', 'General'
  year: number | null;
  tags: string[];
  description: string;
  isFavorite: boolean;
  lastOpenedAt: string | null;
  readingProgress?: {
    currentPage: number;
    totalPages: number;
  };
  samplePages?: string[]; // Text content for in-browser preview simulation
  webViewLink?: string;   // Google Drive web view URL
  downloadUrl?: string;   // Google Drive download URL
  createdTime: string;
  modifiedTime: string;
  indexedAt: string;
  syncStatus: 'synced' | 'local_only' | 'pending';
  source: 'google_drive' | 'sample_vault' | 'manual_upload';
}

export interface VaultFolder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  fileCount: number;
  totalSizeBytes: number;
}

export interface LibraryStats {
  totalFiles: number;
  totalSizeBytes: number;
  pdfCount: number;
  sdocxCount: number;
  docxCount: number;
  otherCount: number;
  favoritesCount: number;
  examsTracked: number;
  subjectsTracked: number;
}

export interface FilterState {
  searchQuery: string;
  format: string; // 'all' | 'pdf' | 'docx' | 'sdocx' | 'other'
  exam: string;   // 'all' or specific exam
  subject: string;// 'all' or specific subject
  topic: string;  // 'all' or specific topic
  year: string;   // 'all' or specific year
  tag: string;    // 'all' or specific tag
  onlyFavorites: boolean;
  sortBy: 'modified_desc' | 'modified_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  thinking?: string;
  groundingUrls?: Array<{ uri: string; title: string }>;
  scienceReference?: {
    type: 'uniprot' | 'pubchem' | 'pubmed';
    title: string;
    id: string;
    summary: string;
  };
}
