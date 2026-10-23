'use client';

import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  BookMarked,
  Download,
  ExternalLink,
  Star,
  Eye,
  MoreVertical,
  Check,
} from 'lucide-react';
import { VaultFile } from '@/lib/types';
import { formatBytes } from '@/lib/vault-store';

interface FileCardProps {
  file: VaultFile;
  onOpen: (file: VaultFile) => void;
  onViewDetails: (file: VaultFile) => void;
  onToggleFavorite: (id: string) => void;
  viewMode?: 'grid' | 'list' | 'compact';
}

export function FileCard({
  file,
  onOpen,
  onViewDetails,
  onToggleFavorite,
  viewMode = 'grid',
}: FileCardProps) {
  const isSamsungNote = file.extension === 'sdocx';
  const isPdf = file.extension === 'pdf';

  // Format icon helper
  const renderIcon = () => {
    if (isSamsungNote) {
      return (
        <div className="w-9 h-9 rounded-md bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <BookMarked className="w-4 h-4" />
        </div>
      );
    }
    if (isPdf) {
      return (
        <div className="w-9 h-9 rounded-md bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (file.extension === 'docx' || file.extension === 'doc') {
      return (
        <div className="w-9 h-9 rounded-md bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-md bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  };

  // Compact List Row
  if (viewMode === 'compact') {
    return (
      <div className="group flex items-center justify-between px-3 py-2 text-xs border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => onToggleFavorite(file.id)}
            className="text-zinc-400 hover:text-amber-500 transition-colors shrink-0"
            aria-label={file.isFavorite ? 'Remove favorite' : 'Add favorite'}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                file.isFavorite ? 'fill-amber-400 text-amber-500' : ''
              }`}
            />
          </button>
          <span className="font-mono text-[11px] text-zinc-500 uppercase shrink-0 w-10">
            {file.extension}
          </span>
          <button
            onClick={() => onOpen(file)}
            className="font-medium text-zinc-900 dark:text-zinc-100 truncate text-left hover:underline flex-1"
          >
            {file.name}
          </button>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-zinc-500 text-[11px] tabular-nums">
          <span className="hidden sm:inline">{file.subject}</span>
          <span className="hidden md:inline">{file.exam}</span>
          <span className="w-16 text-right font-mono">{formatBytes(file.sizeBytes)}</span>
          <button
            onClick={() => onViewDetails(file)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            title="Inspect metadata"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Standard Table / List View
  if (viewMode === 'list') {
    return (
      <div className="group flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {renderIcon()}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpen(file)}
                className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate hover:underline text-left"
              >
                {file.name}
              </button>
              {isSamsungNote && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                  Samsung Note
                </span>
              )}
            </div>

            {/* Zero-Pill Unboxed Metadata with middots */}
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <span>{file.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{file.exam}</span>
              {file.year && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{file.year}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatBytes(file.sizeBytes)}</span>
              {file.readingProgress && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-300 font-medium">
                    Page {file.readingProgress.currentPage} of {file.readingProgress.totalPages}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-4">
          <button
            onClick={() => onToggleFavorite(file.id)}
            className="p-2 text-zinc-400 hover:text-amber-500 transition-colors rounded-md"
            aria-label="Toggle star"
          >
            <Star
              className={`w-4 h-4 ${
                file.isFavorite ? 'fill-amber-400 text-amber-500' : ''
              }`}
            />
          </button>
          <button
            onClick={() => onOpen(file)}
            className="px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
          >
            {isSamsungNote ? 'Inspect Note' : isPdf ? 'Read PDF' : 'Open'}
          </button>
          <button
            onClick={() => onViewDetails(file)}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors rounded-md"
            title="File details"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Default Grid View (Card)
  return (
    <div className="group relative flex flex-col justify-between p-4 bg-white dark:bg-zinc-900/50 border border-zinc-200/90 dark:border-zinc-800/90 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all hover:shadow-xs">
      <div>
        <div className="flex items-start justify-between gap-3">
          {renderIcon()}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggleFavorite(file.id)}
              className="p-1.5 text-zinc-400 hover:text-amber-500 transition-colors rounded-md focus:outline-none"
              aria-label="Toggle favorite"
            >
              <Star
                className={`w-4 h-4 ${
                  file.isFavorite ? 'fill-amber-400 text-amber-500' : ''
                }`}
              />
            </button>
            <button
              onClick={() => onViewDetails(file)}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors rounded-md focus:outline-none"
              title="File details"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mt-3">
          <button
            onClick={() => onOpen(file)}
            className="text-left font-medium text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 hover:underline focus:outline-none"
          >
            {file.name}
          </button>
        </div>

        {/* Specialized Samsung Note Subtitle if applicable */}
        {isSamsungNote && (
          <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
            <span>📝 Samsung Note (.sdocx)</span>
          </div>
        )}

        {/* Description snippet */}
        {file.description && (
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
            {file.description}
          </p>
        )}
      </div>

      {/* Unboxed Metadata & Footer */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{file.subject}</span>
          <span aria-hidden="true">·</span>
          <span>{file.exam}</span>
          {file.year && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{file.year}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{formatBytes(file.sizeBytes)}</span>
        </div>

        {/* Reading progress bar for PDF if active */}
        {file.readingProgress && file.readingProgress.totalPages > 0 && (
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1 tabular-nums">
              <span>Page {file.readingProgress.currentPage} of {file.readingProgress.totalPages}</span>
              <span>{Math.round((file.readingProgress.currentPage / file.readingProgress.totalPages) * 100)}%</span>
            </div>
            <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-900 dark:bg-zinc-200 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (file.readingProgress.currentPage / file.readingProgress.totalPages) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Card actions */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={() => onOpen(file)}
            className="flex-1 py-1.5 text-xs font-medium text-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {isSamsungNote ? 'Inspect Note' : isPdf ? 'Read PDF' : 'Preview'}
          </button>
          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Open in Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
