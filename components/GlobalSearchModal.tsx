'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  FileText,
  BookMarked,
  ArrowRight,
} from 'lucide-react';
import { VaultFile } from '@/lib/types';
import { formatBytes } from '@/lib/vault-store';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: VaultFile[];
  onSelectFile: (file: VaultFile) => void;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  files,
  onSelectFile,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  // Keyboard shortcut ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files.slice(0, 8); // default to recent/featured notes
    return files
      .filter((f) => {
        return (
          f.name.toLowerCase().includes(q) ||
          f.subject?.toLowerCase().includes(q) ||
          f.topic?.toLowerCase().includes(q) ||
          f.exam?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.tags?.some((t) => t.toLowerCase().includes(q))
        );
      })
      .slice(0, 50);
  }, [files, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-16 sm:pt-24">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, subjects, topics, formulas, exams..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
          <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-400">
            {query.trim()
              ? `Found ${results.length} matching document${results.length === 1 ? '' : 's'}`
              : 'Suggested Study Notes'}
          </div>

          {results.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 space-y-1">
              <p>No notes found matching &ldquo;{query}&rdquo;.</p>
              <p className="text-zinc-400">Try searching for &ldquo;Percentage&rdquo;, &ldquo;Reasoning&rdquo;, or &ldquo;Science&rdquo;.</p>
            </div>
          ) : (
            results.map((file) => {
              const isSamsungNote = file.extension === 'sdocx';
              return (
                <div
                  key={file.id}
                  onClick={() => {
                    onSelectFile(file);
                    handleClose();
                  }}
                  className="group flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                        isSamsungNote
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : file.extension === 'pdf'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {isSamsungNote ? (
                        <BookMarked className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                        {file.name}
                      </h4>
                      {/* Zero-Pill Unboxed Metadata */}
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {file.subject} · {file.exam} · {file.topic} · {formatBytes(file.sizeBytes)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] text-zinc-400 uppercase">
                      {file.extension}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>Search covers file names, topics, formulas, exams, and tags</span>
          <span className="text-zinc-400">Press Esc to dismiss</span>
        </div>
      </div>
    </div>
  );
}
