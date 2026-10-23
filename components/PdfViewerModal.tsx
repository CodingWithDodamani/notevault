'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Star,
  Download,
  ExternalLink,
  BookOpen,
  Maximize2,
  Minimize2,
  FileCheck2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { VaultFile } from '@/lib/types';
import { formatBytes } from '@/lib/vault-store';
import { DocumentViewer } from '@/components/DocumentViewer';
import { getAccessToken } from '@/lib/firebase';

interface PdfViewerModalProps {
  file: VaultFile | null;
  onClose: () => void;
  onRecordProgress: (fileId: string, page: number) => void;
  onToggleFavorite: (id: string) => void;
  onAskAi: (file: VaultFile) => void;
}

export function PdfViewerModal({
  file,
  onClose,
  onRecordProgress,
  onToggleFavorite,
  onAskAi,
}: PdfViewerModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'info'>('preview');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      if (token) {
        setAccessToken(token);
        setTokenError(null);
      } else {
        setAccessToken(null);
        setTokenError(
          'Your Google session has expired. Reconnect from Settings, then reopen this document.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) return null;

  const driveViewUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
  const driveDownloadUrl =
    file.downloadUrl || `https://drive.google.com/uc?export=download&id=${file.id}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = driveDownloadUrl;
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startPage = Math.max(1, file.readingProgress?.currentPage ?? 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-1 sm:p-4">
      <div
        className={`flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl transition-all overflow-hidden ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-6xl h-[94vh]'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {file.name}
              </h3>
              <p className="text-[11px] text-zinc-500 truncate">
                {file.subject} · {file.exam} · {formatBytes(file.sizeBytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Tab Switcher */}
            <div className="flex items-center p-0.5 bg-zinc-200/70 dark:bg-zinc-800 rounded-md text-xs mr-2">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Reader
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeTab === 'info'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Study Details
              </button>
            </div>

            <button
              onClick={() => onToggleFavorite(file.id)}
              className="p-1.5 rounded-md text-zinc-400 hover:text-amber-500 transition-colors"
              title={file.isFavorite ? 'Remove star' : 'Star file'}
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
              title="Study with Gemini AI"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Ask Tutor</span>
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="Open the original in Google Drive"
              aria-label="Download original PDF"
            >
              <Download className="w-4 h-4" />
            </button>

            <a
              href={driveViewUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="Open directly in Google Drive"
              aria-label="Open in Google Drive"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors ml-1"
              aria-label="Close document"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Content */}
        {activeTab === 'preview' ? (
          <div className="flex-1 w-full h-full relative bg-zinc-100 dark:bg-zinc-950 min-h-0">
            {tokenError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm">{tokenError}</p>
              </div>
            ) : accessToken ? (
              <DocumentViewer
                fileId={file.id}
                accessToken={accessToken}
                initialPage={startPage}
                onPageChange={(page) => onRecordProgress(file.id, page)}
                onOpenInDrive={() => window.open(driveViewUrl, '_blank', 'noopener')}
                className="h-full"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs font-mono">Preparing reader…</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-6 sm:p-8 space-y-6 bg-zinc-50 dark:bg-zinc-900/40">
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    File Metadata & Google Drive Index
                  </h4>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-400 block">Subject:</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{file.subject}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Exam Category:</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{file.exam}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">File Size:</span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200">
                      {formatBytes(file.sizeBytes)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Indexed From:</span>
                    <span className="text-zinc-800 dark:text-zinc-200">Google Drive</span>
                  </div>
                  {file.readingProgress && file.readingProgress.totalPages > 0 && (
                    <div className="col-span-2">
                      <span className="text-zinc-400 block">Reading Progress:</span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200">
                        Page {file.readingProgress.currentPage} of {file.readingProgress.totalPages}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {file.tags && file.tags.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Search Tags:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {file.tags.map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Study Assistance Callout */}
              <div className="p-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <h4 className="font-semibold text-xs sm:text-sm">
                    Study with Gemini Assistant
                  </h4>
                </div>
                <p className="text-xs text-zinc-300 dark:text-zinc-600 leading-relaxed">
                  Generate formula summaries, high-yield practice questions, or detailed explanations from this note file.
                </p>
                <button
                  onClick={() => onAskAi(file)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white hover:opacity-90 transition-opacity"
                >
                  Start Tutoring Session →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Footer Action Strip */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-500 shrink-0">
          <span>Source: Google Drive (Secure Read-Only Access)</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="hover:underline flex items-center gap-1 text-zinc-700 dark:text-zinc-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Open Original</span>
            </button>
            <span>·</span>
            <a
              href={driveViewUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline flex items-center gap-1 text-zinc-700 dark:text-zinc-300"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Drive</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
