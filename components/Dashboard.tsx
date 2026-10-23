'use client';

import React from 'react';
import {
  Search,
  BookOpen,
  FileText,
  BookMarked,
  HardDrive,
  Star,
  Clock,
  Sparkles,
  ArrowRight,
  FolderSync,
  Cloud,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { VaultFile, LibraryStats } from '@/lib/types';
import { formatBytes } from '@/lib/vault-store';

interface DashboardProps {
  stats: LibraryStats;
  recentlyOpened: VaultFile[];
  recentlyAdded: VaultFile[];
  onOpenSearch: () => void;
  onOpenSync: () => void;
  onOpenAi: () => void;
  onOpenFile: (file: VaultFile) => void;
  onSelectSubject: (subject: string) => void;
  onSelectExam: (exam: string) => void;
  onViewAllFiles: () => void;
}

export function Dashboard({
  stats,
  recentlyOpened,
  recentlyAdded,
  onOpenSearch,
  onOpenSync,
  onOpenAi,
  onOpenFile,
  onSelectSubject,
  onSelectExam,
  onViewAllFiles,
}: DashboardProps) {
  // If zero files in library (Google Drive not synced yet), show clean onboarding
  if (stats.totalFiles === 0) {
    return (
      <div className="space-y-8 py-6 max-w-4xl mx-auto">
        {/* Empty State Banner */}
        <div className="p-8 sm:p-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 mx-auto flex items-center justify-center shadow-md">
            <Cloud className="w-7 h-7" />
          </div>

          <div className="max-w-lg mx-auto space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              NoteVault Cloud
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Turn your Google Drive study notes, PDFs, DOCX files, and Samsung Notes (`.sdocx`) into an organized, fast-search personal knowledge library.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenSync}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-md text-sm"
            >
              <FolderSync className="w-4 h-4" />
              <span>Connect Google Drive & Load Notes</span>
            </button>
            <button
              onClick={onOpenAi}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Study Assistant</span>
            </button>
          </div>

          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left text-xs">
            <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero File Duplication</span>
              </div>
              <p className="text-zinc-500 leading-relaxed">
                Your 96 GB collection stays strictly in your personal Google Drive. No heavy uploads to app servers.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                <FileText className="w-4 h-4 text-red-600" />
                <span>PDF In-Browser Reader</span>
              </div>
              <p className="text-zinc-500 leading-relaxed">
                Seamless embedded preview for your notes, question papers, and textbook PDFs.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                <BookMarked className="w-4 h-4 text-amber-600" />
                <span>Samsung Notes (.sdocx)</span>
              </div>
              <p className="text-zinc-500 leading-relaxed">
                Accurate identification and specialized handling for your Galaxy handwriting notes.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active state with real Google Drive files
  return (
    <div className="space-y-8 pb-12">
      {/* Hero & Universal Search Zone */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Study Vault
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {stats.totalFiles} real documents indexed from your Google Drive storage.
            </p>
          </div>

          <button
            onClick={onOpenSync}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Sync Drive</span>
          </button>
        </div>

        {/* Large Universal Search Bar */}
        <div
          onClick={onOpenSearch}
          className="group relative cursor-pointer flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
        >
          <Search className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors" />
          <span className="text-xs sm:text-sm text-zinc-400 flex-1 truncate">
            Search your notes, subjects, topics, formulas, exams (e.g. &ldquo;maths&rdquo;, &ldquo;pyq&rdquo;, &ldquo;sdocx&rdquo;)...
          </span>
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
              /
            </kbd>
            <span className="text-xs text-zinc-400 font-medium">Search</span>
          </div>
        </div>
      </section>

      {/* Quick Metrics Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-lg border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/60">
          <span className="text-[11px] font-medium text-zinc-500 block">Total Files</span>
          <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums font-mono mt-1 block">
            {stats.totalFiles}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">In Google Drive</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/60">
          <span className="text-[11px] font-medium text-zinc-500 block">PDF Documents</span>
          <span className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums font-mono mt-1 block">
            {stats.pdfCount}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Direct preview</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/60">
          <span className="text-[11px] font-medium text-zinc-500 block">Samsung Notes</span>
          <span className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums font-mono mt-1 block">
            {stats.sdocxCount}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">.sdocx notes</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/60">
          <span className="text-[11px] font-medium text-zinc-500 block">DOCX / Other</span>
          <span className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums font-mono mt-1 block">
            {stats.docxCount + stats.otherCount}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Word & documents</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/60">
          <span className="text-[11px] font-medium text-zinc-500 block">Drive Tracked</span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-1 block">
            {formatBytes(stats.totalSizeBytes)}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Metadata only</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/60">
          <span className="text-[11px] font-medium text-zinc-500 block">Starred</span>
          <span className="text-xl sm:text-2xl font-bold text-amber-500 tabular-nums font-mono mt-1 block">
            {stats.favoritesCount}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">High priority</span>
        </div>
      </section>

      {/* Continue Learning / Recently Opened */}
      {recentlyOpened.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Continue Learning
              </h2>
            </div>
            <button
              onClick={onViewAllFiles}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline flex items-center gap-1"
            >
              <span>All documents</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentlyOpened.map((file) => (
              <div
                key={file.id}
                onClick={() => onOpenFile(file)}
                className="cursor-pointer p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
                    <span className="uppercase">{file.extension}</span>
                    <span>{formatBytes(file.sizeBytes)}</span>
                  </div>
                  <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:underline">
                    {file.name}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 truncate">
                    {file.subject} · {file.exam}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 text-[11px]">
                    {file.extension === 'pdf' ? 'Read in browser' : 'Inspect note'}
                  </span>
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:translate-x-0.5 transition-transform">
                    Open →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently Added Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Recently Added to Vault
          </h2>
          <button
            onClick={onViewAllFiles}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"
          >
            See all {stats.totalFiles} documents
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentlyAdded.map((file) => (
            <div
              key={file.id}
              onClick={() => onOpenFile(file)}
              className="cursor-pointer p-3.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex items-center justify-between"
            >
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate">
                  {file.name}
                </h3>
                <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                  {file.subject} · {file.exam} · {formatBytes(file.sizeBytes)}
                </p>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase shrink-0">
                {file.extension}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
