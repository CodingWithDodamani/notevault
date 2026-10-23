'use client';

import React, { useState } from 'react';
import {
  X,
  BookMarked,
  Download,
  ExternalLink,
  Smartphone,
  Star,
  Info,
  Sparkles,
  Laptop,
  Eye,
  FileText,
} from 'lucide-react';
import { VaultFile } from '@/lib/types';
import { formatBytes } from '@/lib/vault-store';
import { SdocxViewer } from '@/components/SdocxViewer';

interface SamsungNoteModalProps {
  file: VaultFile | null;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onAskAi: (file: VaultFile) => void;
  onRecordProgress?: (fileId: string, page: number) => void;
}

export function SamsungNoteModal({
  file,
  onClose,
  onToggleFavorite,
  onAskAi,
  onRecordProgress,
}: SamsungNoteModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'details'>('preview');

  if (!file) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.downloadUrl || file.webViewLink || '#';
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <BookMarked className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  Samsung Note
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                  .sdocx
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate max-w-sm">{file.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Tab switcher */}
            <div className="flex items-center p-0.5 bg-zinc-200/70 dark:bg-zinc-800 rounded-md text-xs mr-2">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeTab === 'details'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Details
              </button>
            </div>

            <button
              onClick={() => onToggleFavorite(file.id)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-amber-500 transition-colors"
              title={file.isFavorite ? 'Remove favorite' : 'Add favorite'}
              aria-label={file.isFavorite ? 'Remove from starred' : 'Add to starred'}
            >
              <Star
                className={`w-4 h-4 ${
                  file.isFavorite ? 'fill-amber-400 text-amber-500' : ''
                }`}
              />
            </button>

            <button
              onClick={() => onAskAi(file)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              title="Ask Study AI about this Note"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Ask AI</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              aria-label="Close note"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'preview' ? (
          <div className="flex-1 min-h-0 relative">
            <SdocxViewer
              fileId={file.id}
              initialPage={Math.max(1, file.readingProgress?.currentPage ?? 1)}
              onPageChange={
                onRecordProgress
                  ? (page) => onRecordProgress(file.id, page)
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-6 space-y-5 bg-zinc-50 dark:bg-zinc-950/20">
            {/* Compatibility Explainer Banner */}
            <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-xs space-y-2 text-zinc-700 dark:text-zinc-300">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    Proprietary Samsung Notes Document Format
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    &ldquo;.sdocx&rdquo; files contain vector S-Pen handwriting, embedded audio
                    recordings and drawing layers. NoteVault renders the note pages directly in
                    the browser; editing still requires the official Samsung Notes application.
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-[11px] text-zinc-400 block mb-1">Subject &amp; Topic</span>
                <p className="font-medium text-zinc-800 dark:text-zinc-200">{file.subject}</p>
                <p className="text-zinc-500 mt-0.5">{file.topic}</p>
              </div>
              <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <span className="text-[11px] text-zinc-400 block mb-1">Exam &amp; File Size</span>
                <p className="font-medium text-zinc-800 dark:text-zinc-200">{file.exam}</p>
                <p className="font-mono text-zinc-500 mt-0.5">{formatBytes(file.sizeBytes)}</p>
              </div>
            </div>

            {/* Reading progress */}
            {file.readingProgress && file.readingProgress.totalPages > 0 && (
              <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <Eye className="w-4 h-4 shrink-0" />
                <span className="font-mono">
                  Page {file.readingProgress.currentPage} of {file.readingProgress.totalPages}
                </span>
              </div>
            )}

            {/* How to Open Instructions */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                Compatible Opening Options:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-2 p-2.5 rounded border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <Smartphone className="w-4 h-4 text-zinc-500" />
                  <span>Samsung Galaxy Phone / Tablet</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <Laptop className="w-4 h-4 text-zinc-500" />
                  <span>Windows Samsung Notes App</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Rendered in-browser from Google Drive
          </span>

          <div className="flex items-center gap-2">
            {file.webViewLink && (
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Drive</span>
              </a>
            )}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .sdocx</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
